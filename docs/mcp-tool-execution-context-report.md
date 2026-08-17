# MCP Tool Execution Context Report

Date: 2026-08-15

## Question

When agents have MCP tool capability through attached MCP tools and MCP servers, what context is sent to the LLM during workflow execution?

Specifically:

- Is the entire MCP server/tool context sent directly to the agent?
- Is only the available tool title/name sent?
- How does the model know how to invoke a tool?
- What happens when a tool is actually invoked?

## Short Answer

The current implementation does **not** send the entire MCP server context to the model.

For worker agents, the current implementation sends MCP tool information through two channels:

1. **System prompt text:** a short list of attached MCP tools containing tool name, transport type, and stored tool description.
2. **Structured LLM tool definitions:** tool name, generated tool description, and input schema are passed to providers that support tool/function calling.

The actual MCP server connection details, auth configuration, OAuth tokens, custom headers, env vars, and server object are used by the backend runtime to execute the tool. They are not appended wholesale to the model prompt.

There is no intent-based MCP tool retrieval or filtering layer. All MCP tools attached to the executing worker agent are registered and exposed as available tools for that worker execution. The model then chooses whether to call one of them.

Important provider caveat: OpenAI, Azure OpenAI, and Anthropic receive structured tool definitions. The current Gemini provider ignores the `tools` argument, so Gemini only receives the prompt text listing MCP tools and cannot use the backend's structured tool-calling loop as implemented.

## Current Runtime Flow

```text
MCP server discovery/import
  -> discovers tools/list from MCP server
  -> stores selected/imported tools in mcp_tools
  -> stores server connection/auth details in mcp_servers

Agent tool attachment
  -> stores relationship in agent_mcp_tools

Workflow execution
  -> WorkflowRepository.GetByID
  -> AgentRepository.GetByID for supervisor and workers
  -> loads attached MCP tool rows for each agent
  -> also loads parent MCP server auth/config for each tool when available

Worker execution
  -> ContextAggregator.BuildSystemPrompt(worker)
     -> appends short textual MCP tool list
  -> ToolRegistry.GetTools(worker.MCPTools)
     -> registers every attached tool in backend runtime
     -> creates structured LLM tool definitions
  -> provider.Chat(messages, toolDefs, temperature)
     -> model sees prompt + available tool definitions

If model returns tool calls
  -> WorkerExecutor parses tool call name + arguments
  -> ToolRegistry.ExecuteTool(toolName, args)
  -> backend calls the actual MCP server/tool
  -> tool result is sent back to the model in a follow-up user message
```

## Evidence From Current Implementation

### 1. MCP Tool And Server Models Store More Than The LLM Receives

`backend/internal/models/mcp_tool.go` defines stored tool fields:

```go
type MCPTool struct {
    ID               uuid.UUID       `json:"id"`
    ServerID         *uuid.UUID      `json:"server_id,omitempty"`
    Server           *MCPServer      `json:"server,omitempty"`
    Name             string          `json:"name"`
    Description      string          `json:"description"`
    ServerURL        string          `json:"server_url"`
    Command          string          `json:"command,omitempty"`
    Args             []string        `json:"args,omitempty"`
    WorkingDirectory string          `json:"working_directory,omitempty"`
    TransportType    TransportType   `json:"transport_type"`
    InputSchema      json.RawMessage `json:"input_schema"`
    CreatedAt        time.Time       `json:"created_at"`
}
```

`backend/internal/models/mcp_server.go` includes server connection and auth fields such as:

- `ServerURL`
- `Command`
- `Args`
- `WorkingDirectory`
- `AuthType`
- `AuthConfig`
- OAuth client fields
- OAuth tokens
- connection status fields
- imported tool list

Those stored fields exist in backend state, but only a subset is sent to the model.

## How MCP Tools Are Attached To Agents

`backend/internal/repository/agent_repository.go` attaches tools by inserting into `agent_mcp_tools`:

```go
func (r *AgentRepository) AttachMCPTool(ctx context.Context, agentID, toolID uuid.UUID) error {
    _, err := r.pool.Exec(ctx, "INSERT INTO agent_mcp_tools (agent_id, mcp_tool_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", agentID, toolID)
    return err
}
```

When an agent is loaded, `GetByID` fetches all attached MCP tools:

```sql
SELECT
    t.id, t.server_id, t.name, t.description, t.server_url,
    COALESCE(t.command, ''), COALESCE(t.args, '[]'),
    COALESCE(t.working_directory, ''), t.transport_type,
    t.input_schema, t.created_at,
    s.id, s.name, COALESCE(s.description, ''), s.server_url,
    COALESCE(s.command, ''), COALESCE(s.args, '[]'),
    COALESCE(s.working_directory, ''), s.transport_type,
    s.auth_type, s.auth_config,
    COALESCE(s.oauth_client_id, ''),
    COALESCE(s.oauth_client_secret, ''),
    COALESCE(s.oauth_scopes, ''), s.oauth_tokens,
    s.status, s.created_at, s.updated_at
FROM mcp_tools t
JOIN agent_mcp_tools amt ON t.id = amt.mcp_tool_id
LEFT JOIN mcp_servers s ON t.server_id = s.id
WHERE amt.agent_id = $1
```

This loads every attached tool for the agent. There is no query-time filtering by user intent, routing condition, or semantic relevance.

When a tool belongs to a server, the repository also hydrates `tool.Server` with the server auth/config needed for execution.

## What Goes Into The System Prompt

The system prompt is built in `backend/internal/engine/context_aggregator.go`.

For MCP tools, it appends this text:

```go
if len(agent.MCPTools) > 0 {
    builder.WriteString("# Available Model Context Protocol (MCP) Tools:\n")
    for _, tool := range agent.MCPTools {
        builder.WriteString(fmt.Sprintf("- Tool: %s (Transport: %s)\n  Description: %s\n", tool.Name, tool.TransportType, tool.Description))
    }
    builder.WriteString("\nIf a tool call is needed to fulfill the request, invoke it using structured tool execution format.\n\n")
}
```

So the prompt receives:

- Tool name
- Transport type (`sse` or `stdio`)
- Stored tool description
- A generic instruction to invoke tools through structured tool execution

The prompt does **not** include the full MCP server object, full auth config, OAuth token values, custom headers, env vars, or complete server connection metadata.

## What Goes Into Structured Tool Definitions

Worker execution prepares structured tool definitions in `backend/internal/engine/worker_executor.go`:

```go
systemPrompt := we.aggregator.BuildSystemPrompt(worker)
toolDefs := we.toolRegistry.GetTools(worker.MCPTools)

messages := []llm.ChatMessage{
    {Role: "system", Content: systemPrompt},
    {Role: "user", Content: taskDescription},
}

resp, err := provider.Chat(ctx, messages, toolDefs, worker.Temperature)
```

`ToolRegistry.GetTools` registers every attached tool and calls `ListTools` on each backend MCP client:

```go
func (r *ToolRegistry) GetTools(tools []models.MCPTool) []llm.ToolDefinition {
    var defs []llm.ToolDefinition
    for _, tool := range tools {
        c := r.RegisterTool(tool)
        if toolDefs, err := c.ListTools(context.Background()); err == nil {
            defs = append(defs, toolDefs...)
        }
    }
    return defs
}
```

The shared LLM tool definition shape is in `backend/internal/llm/provider.go`:

```go
type ToolDefinition struct {
    Name        string      `json:"name"`
    Description string      `json:"description"`
    InputSchema interface{} `json:"input_schema"`
}
```

So the structured tool context sent to capable providers is:

- Tool name
- Tool description
- Tool input schema

It is not the full MCP server context.

## Runtime Tool Definition Details

### SSE / HTTP MCP Tools

For SSE tools, `backend/internal/mcp/sse_client.go` returns:

```go
return []llm.ToolDefinition{
    {
        Name:        c.ToolName,
        Description: fmt.Sprintf("MCP Tool %s on SSE server %s", c.ToolName, c.ServerURL),
        InputSchema: inputSchema,
    },
}, nil
```

The `InputSchema` comes from the stored `MCPTool.InputSchema`.

Note: the structured description includes the server URL. It does not include auth headers, bearer tokens, OAuth tokens, or custom headers.

### Stdio MCP Tools

For stdio tools, `backend/internal/mcp/transport/stdio_client.go` returns:

```go
return []llm.ToolDefinition{{
    Name:        c.config.ToolName,
    Description: fmt.Sprintf("MCP stdio tool %s via command %s", c.config.ToolName, c.config.Command),
    InputSchema: inputSchema,
}}, nil
```

The structured description includes the command string. It does not include env var values from `AuthConfig.EnvVars`.

## Provider-Specific Behavior

### OpenAI

`backend/internal/llm/openai_provider.go` wraps each `ToolDefinition` as a function tool:

```go
for _, t := range tools {
    toolWrappers = append(toolWrappers, openAIToolWrapper{
        Type:     "function",
        Function: t,
    })
}
```

These are sent as `tools` in the chat completions request.

### Azure OpenAI

`backend/internal/llm/azure_openai_provider.go` uses the same OpenAI-compatible wrapper and sends tool definitions in the `tools` request field.

### Anthropic

`backend/internal/llm/anthropic_provider.go` converts each `ToolDefinition` into Anthropic's `tools` shape:

```go
for _, t := range tools {
    anthTools = append(anthTools, anthropicTool{
        Name:        t.Name,
        Description: t.Description,
        InputSchema: t.InputSchema,
    })
}
```

The prompt's system message is sent as Anthropic's `system` field, and structured tools are sent in `tools`.

### Gemini

`backend/internal/llm/gemini_provider.go` accepts the `tools []ToolDefinition` argument but does not use it when building `geminiRequest`:

```go
type geminiRequest struct {
    Contents []geminiContent `json:"contents"`
}
```

The current Gemini request includes only `Contents`. Therefore, for Gemini-backed agents, MCP tools are only mentioned in the text system prompt. The structured tool definitions are not sent, and the current `WorkerExecutor` tool-call loop has no Gemini tool-call response parsing path.

## What Happens When The Model Invokes A Tool

If a provider returns structured tool calls, `backend/internal/engine/worker_executor.go` handles them:

```go
if len(resp.ToolCalls) > 0 {
    for _, tc := range resp.ToolCalls {
        argsMap := map[string]interface{}{}
        if tc.Arguments != "" {
            _ = json.Unmarshal([]byte(tc.Arguments), &argsMap)
        }

        toolResult, execErr := we.toolRegistry.ExecuteTool(ctx, tc.Name, argsMap)
        executedResults = append(executedResults, executedToolResult{
            Name:      tc.Name,
            Arguments: argsMap,
            Result:    toolResult,
            Err:       execErr,
        })
    }
}
```

Then, if any tools were executed, the backend sends a second LLM call with the tool results:

```go
followUpMessages := append([]llm.ChatMessage{}, messages...)
followUpMessages = append(followUpMessages, llm.ChatMessage{
    Role:    "user",
    Content: buildToolResultFollowUp(taskDescription, executedResults),
})

finalResp, followUpErr := provider.Chat(ctx, followUpMessages, nil, worker.Temperature)
```

The follow-up call includes:

- the original system prompt
- the original task
- the executed tool name
- the tool arguments
- the tool result or error

It passes `nil` tools, so tools are not available for another tool-call round in that follow-up request.

## What The Backend Uses But Does Not Send Directly To The Model

The backend uses these MCP server/tool fields to register and execute tools:

- `ServerURL`
- `Command`
- `Args`
- `WorkingDirectory`
- `TransportType`
- `AuthType`
- `AuthConfig`
- OAuth tokens
- custom headers
- API key headers
- env vars for stdio tools

These are operational backend details. They are not appended wholesale to the system prompt and are not included as structured tool definition fields.

However, some connection identity can leak into structured tool descriptions:

- SSE tool definitions include the server URL in generated description text.
- Stdio tool definitions include the command in generated description text.

Auth secrets are not intentionally sent to the model in the reviewed implementation.

## Supervisor Versus Worker Behavior

### Supervisor Agent

`SupervisorRouter` builds a system prompt for the supervisor with `BuildSystemPrompt(supervisor)`. Therefore, if a supervisor has MCP tools attached, their names, transports, and descriptions appear in the supervisor prompt.

But `SupervisorRouter` calls the provider with `tools` set to `nil`:

```go
supResp, err := provider.Chat(ctx, []llm.ChatMessage{
    {Role: "system", Content: fullSystemPrompt},
    {Role: "user", Content: fmt.Sprintf("Analyze task and prepare subtasks for workers if necessary: %s", query)},
}, nil, supervisor.Temperature)
```

So supervisors currently see a text list of their MCP tools but do not receive structured tool definitions and do not execute MCP tool calls through the current supervisor path.

### Worker Agents

Workers receive both:

- textual MCP list in the system prompt
- structured tool definitions through `provider.Chat(..., toolDefs, ...)`, when the provider supports them

Workers are the path where MCP tool calls are actually executed.

## Direct Answer To The User Question

An agent does **not** receive the entire MCP server/tool context in the prompt.

For worker agents, the model receives enough context to know available tools:

- in prompt text: tool name, transport, stored description
- in structured tool definitions: tool name, generated description, input schema

It does not receive the full MCP server object, server auth config, OAuth token values, custom headers, or env vars as prompt context.

It also does not receive only a bare tool title. For providers with structured tool support, it receives the tool name plus schema and description. The input schema is the most important part because it tells the model what arguments it can provide.

## Current Limitations And Risks

1. **No intent-based tool filtering.** All MCP tools attached to the executing worker are exposed for that worker execution.
2. **Provider inconsistency.** Gemini currently ignores structured tool definitions.
3. **Supervisor tool mismatch.** Supervisor prompts can list MCP tools, but supervisors do not receive structured tool definitions and do not execute them in the current path.
4. **Generated tool descriptions differ from stored descriptions.** The system prompt uses `MCPTool.Description`, but structured `ListTools` descriptions are generated from transport details, not the stored description.
5. **No runtime tools/list refresh for attached tools.** Runtime `ListTools` uses stored tool name and stored input schema; it does not re-query the MCP server's current tool list before every worker run.
6. **No multi-step tool loop.** After tool execution, the follow-up model call is made with `nil` tools, so the model cannot chain another structured tool call in that second response.
7. **Tool registry keyed by tool name.** `ToolRegistry` stores clients by `tool.Name`; duplicate tool names across servers could collide.

## Conclusion

The current implementation treats MCP tools as structured callable capabilities, not as large context documents. Attached MCP tools are all exposed to the executing worker. The model receives a short textual list plus structured tool definitions containing name, description, and input schema. The backend keeps the full MCP server connection/auth context for execution and only sends tool results back to the model after the model chooses a tool call.
