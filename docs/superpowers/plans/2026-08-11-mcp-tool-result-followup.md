# MCP Tool Result Follow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every successful MCP tool invocation can be incorporated into the worker agent's final response instead of returning an empty workflow output after a tool call.

**Architecture:** Keep the fix at the workflow engine layer, not inside any specific MCP tool or MCP server. After the first LLM response requests tools, the worker executes all requested MCP tools, formats those results into a provider-neutral follow-up message, makes a second LLM call without tools, and returns that final content. This makes the behavior work for GitHub, Atlassian, and future MCP tools because it treats every MCP result as data to synthesize rather than relying on one provider's native tool-result message format.

**Tech Stack:** Go 1.25, backend engine package, existing `llm.LLMProvider`, existing `mcp.ToolRegistry`, existing SSE workflow logs.

---

## File Structure

- Modify: `backend/internal/engine/worker_executor.go`
  - Keep existing tool call streaming/logging behavior.
  - Add generic tool-result follow-up handling after all tool calls finish.
  - Return the second LLM response content when available.
  - Return a readable fallback based on tool results if the second LLM response is empty.

- Create: `backend/internal/engine/tool_result_followup.go`
  - Own provider-neutral formatting of MCP results for the second LLM call.
  - Own fallback rendering when the model still returns empty text.
  - Keep this isolated from `WorkerExecutor` so it can be unit tested without SSE/session plumbing.

- Create: `backend/internal/engine/tool_result_followup_test.go`
  - Test formatting of successful MCP JSON-RPC tool results.
  - Test formatting of MCP `isError: true` tool results.
  - Test fallback output for empty model response.

- Modify: `backend/internal/engine/worker_executor.go` tests if adding an executor-level test is practical after helper coverage.
  - The lowest-risk implementation can be verified through helper tests plus full package tests.
  - Avoid introducing large dependency-injection refactors unless a focused `ExecuteWorker` test becomes necessary.

---

### Task 1: Add Provider-Neutral Tool Result Formatting

**Files:**
- Create: `backend/internal/engine/tool_result_followup.go`
- Test: `backend/internal/engine/tool_result_followup_test.go`

- [ ] **Step 1: Write the failing tests**

Create `backend/internal/engine/tool_result_followup_test.go` with this content:

```go
package engine

import (
	"strings"
	"testing"
)

func TestBuildToolResultFollowUpIncludesSuccessfulMCPContent(t *testing.T) {
	results := []executedToolResult{
		{
			Name: "get_me",
			Arguments: map[string]interface{}{},
			Result: map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      float64(1),
				"result": map[string]interface{}{
					"content": []interface{}{
						map[string]interface{}{
							"type": "text",
							"text": `{"login":"princey-byte","details":{"public_repos":1,"total_private_repos":10}}`,
						},
					},
				},
			},
		},
	}

	message := buildToolResultFollowUp("list all the github repos i have", results)

	assertContains(t, message, "Original task: list all the github repos i have")
	assertContains(t, message, "Tool: get_me")
	assertContains(t, message, "princey-byte")
	assertContains(t, message, "public_repos")
	assertContains(t, message, "Use the tool results above")
}

func TestBuildToolResultFollowUpIncludesMCPToolErrors(t *testing.T) {
	results := []executedToolResult{
		{
			Name: "atlassianUserInfo",
			Arguments: map[string]interface{}{},
			Result: map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      float64(1),
				"result": map[string]interface{}{
					"isError": true,
					"content": []interface{}{
						map[string]interface{}{
							"type": "text",
							"text": `{"error":true,"message":"We are having trouble completing this action. Please try again shortly."}`,
						},
					},
				},
			},
		},
	}

	message := buildToolResultFollowUp("who am i in atlassian", results)

	assertContains(t, message, "Tool: atlassianUserInfo")
	assertContains(t, message, "isError")
	assertContains(t, message, "We are having trouble completing this action")
	assertContains(t, message, "Do not claim unavailable data was retrieved")
}

func TestFallbackToolResultOutputReturnsReadableContent(t *testing.T) {
	results := []executedToolResult{
		{
			Name: "get_me",
			Arguments: map[string]interface{}{},
			Result: map[string]interface{}{
				"jsonrpc": "2.0",
				"result": map[string]interface{}{
					"content": []interface{}{
						map[string]interface{}{
							"type": "text",
							"text": `{"login":"princey-byte","details":{"total_private_repos":10}}`,
						},
					},
				},
			},
		},
	}

	output := fallbackToolResultOutput(results)

	assertContains(t, output, "Tool results were returned, but the model produced no final text")
	assertContains(t, output, "get_me")
	assertContains(t, output, "princey-byte")
	assertContains(t, output, "total_private_repos")
}

func assertContains(t *testing.T, value string, expected string) {
	t.Helper()
	if !strings.Contains(value, expected) {
		t.Fatalf("expected %q to contain %q", value, expected)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd /mnt/agentic-app/backend && go test ./internal/engine
```

Expected result:

```text
FAIL
undefined: executedToolResult
undefined: buildToolResultFollowUp
undefined: fallbackToolResultOutput
```

- [ ] **Step 3: Add the formatter implementation**

Create `backend/internal/engine/tool_result_followup.go` with this content:

```go
package engine

import (
	"encoding/json"
	"fmt"
	"strings"
)

type executedToolResult struct {
	Name      string
	Arguments map[string]interface{}
	Result    interface{}
	Err       error
}

func buildToolResultFollowUp(originalTask string, results []executedToolResult) string {
	var builder strings.Builder

	builder.WriteString("The previous assistant response requested MCP tool calls. The tools have now been executed.\n\n")
	builder.WriteString(fmt.Sprintf("Original task: %s\n\n", originalTask))
	builder.WriteString("MCP tool results:\n")

	for index, result := range results {
		builder.WriteString(fmt.Sprintf("\n%d. Tool: %s\n", index+1, result.Name))
		builder.WriteString(fmt.Sprintf("Arguments: %s\n", marshalToolValue(result.Arguments)))
		if result.Err != nil {
			builder.WriteString(fmt.Sprintf("Execution error: %s\n", result.Err.Error()))
		}
		builder.WriteString(fmt.Sprintf("Result: %s\n", marshalToolValue(result.Result)))
	}

	builder.WriteString("\nUse the tool results above to answer the original task directly. ")
	builder.WriteString("If a tool result contains isError=true or an error payload, explain that the tool returned an error and do not claim unavailable data was retrieved.")

	return builder.String()
}

func fallbackToolResultOutput(results []executedToolResult) string {
	var builder strings.Builder

	builder.WriteString("Tool results were returned, but the model produced no final text.\n\n")
	for index, result := range results {
		builder.WriteString(fmt.Sprintf("### Tool %d: %s\n", index+1, result.Name))
		if result.Err != nil {
			builder.WriteString(fmt.Sprintf("Execution error: %s\n", result.Err.Error()))
		}
		builder.WriteString("```json\n")
		builder.WriteString(marshalToolValue(result.Result))
		builder.WriteString("\n```\n\n")
	}

	return strings.TrimSpace(builder.String())
}

func marshalToolValue(value interface{}) string {
	if value == nil {
		return "null"
	}

	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Sprintf("%v", value)
	}
	return string(data)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd /mnt/agentic-app/backend && go test ./internal/engine
```

Expected result:

```text
ok  	agentic-platform/backend/internal/engine
```

- [ ] **Step 5: Commit this task**

Run:

```bash
cd /mnt/agentic-app && git status --short
```

Expected status includes only:

```text
?? backend/internal/engine/tool_result_followup.go
?? backend/internal/engine/tool_result_followup_test.go
```

Commit command:

```bash
cd /mnt/agentic-app && git add backend/internal/engine/tool_result_followup.go backend/internal/engine/tool_result_followup_test.go && git commit -m "test: add MCP tool result follow-up formatter"
```

---

### Task 2: Feed MCP Tool Results Back Into the Worker Agent

**Files:**
- Modify: `backend/internal/engine/worker_executor.go`
- Test: `backend/internal/engine/tool_result_followup_test.go`

- [ ] **Step 1: Add a unit test for final output selection**

Append this test to `backend/internal/engine/tool_result_followup_test.go`:

```go
func TestChooseWorkerFinalOutputPrefersModelFollowUp(t *testing.T) {
	results := []executedToolResult{
		{Name: "get_me", Result: map[string]interface{}{"ok": true}},
	}

	output := chooseWorkerFinalOutput("You have 11 repositories.", results)

	if output != "You have 11 repositories." {
		t.Fatalf("expected model follow-up output, got %q", output)
	}
}

func TestChooseWorkerFinalOutputFallsBackToToolResults(t *testing.T) {
	results := []executedToolResult{
		{Name: "get_me", Result: map[string]interface{}{"login": "princey-byte"}},
	}

	output := chooseWorkerFinalOutput("   ", results)

	assertContains(t, output, "Tool results were returned")
	assertContains(t, output, "get_me")
	assertContains(t, output, "princey-byte")
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd /mnt/agentic-app/backend && go test ./internal/engine
```

Expected result:

```text
FAIL
undefined: chooseWorkerFinalOutput
```

- [ ] **Step 3: Add final output selection helper**

Append this function to `backend/internal/engine/tool_result_followup.go`:

```go
func chooseWorkerFinalOutput(modelContent string, results []executedToolResult) string {
	if strings.TrimSpace(modelContent) != "" {
		return modelContent
	}
	if len(results) > 0 {
		return fallbackToolResultOutput(results)
	}
	return modelContent
}
```

- [ ] **Step 4: Modify `WorkerExecutor.ExecuteWorker` to make the second LLM call**

In `backend/internal/engine/worker_executor.go`, replace the current tool-call handling block and final return with this implementation shape:

```go
	// 6. Handle tool calls if triggered
	var executedResults []executedToolResult
	if len(resp.ToolCalls) > 0 {
		for _, tc := range resp.ToolCalls {
			*stepNum++
			tStep := *stepNum

			argsMap := map[string]interface{}{}
			if tc.Arguments != "" {
				_ = json.Unmarshal([]byte(tc.Arguments), &argsMap)
			}

			toolCallMsg := models.StreamMessage{
				Event:     models.EventToolCall,
				SessionID: sessionID,
				AgentName: worker.Name,
				Step:      tStep,
				Payload: map[string]interface{}{
					"tool_name": tc.Name,
					"arguments": tc.Arguments,
				},
			}
			eventChan <- toolCallMsg
			_ = we.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &worker.ID, tStep, string(models.EventToolCall), toolCallMsg.Payload)

			toolResult, execErr := we.toolRegistry.ExecuteTool(ctx, tc.Name, argsMap)
			executedResults = append(executedResults, executedToolResult{
				Name:      tc.Name,
				Arguments: argsMap,
				Result:    toolResult,
				Err:       execErr,
			})

			*stepNum++
			rStep := *stepNum

			resultMsg := models.StreamMessage{
				Event:     models.EventToolResult,
				SessionID: sessionID,
				AgentName: worker.Name,
				Step:      rStep,
				Payload: map[string]interface{}{
					"tool_name": tc.Name,
					"result":    toolResult,
					"error":     execErr,
				},
			}
			eventChan <- resultMsg
			_ = we.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &worker.ID, rStep, string(models.EventToolResult), resultMsg.Payload)
		}
	}

	if len(executedResults) > 0 {
		followUpMessages := append([]llm.ChatMessage{}, messages...)
		followUpMessages = append(followUpMessages, llm.ChatMessage{
			Role:    "user",
			Content: buildToolResultFollowUp(taskDescription, executedResults),
		})

		finalResp, followUpErr := provider.Chat(ctx, followUpMessages, nil, worker.Temperature)
		if followUpErr != nil {
			return fallbackToolResultOutput(executedResults), nil
		}
		return chooseWorkerFinalOutput(finalResp.Content, executedResults), nil
	}

	return resp.Content, nil
```

Important implementation constraints:

- Keep the existing `TOOL_CALL` and `TOOL_RESULT` SSE events unchanged.
- Pass `nil` tools to the second call to avoid an accidental infinite tool loop.
- Use the provider-neutral `user` message follow-up so OpenAI, Azure OpenAI, Anthropic, Gemini, and future providers can all receive the tool output as normal text.
- Do not add MCP-tool-specific branching for GitHub, Atlassian, Jira, or any future tool.

- [ ] **Step 5: Run the focused engine tests**

Run:

```bash
cd /mnt/agentic-app/backend && go test ./internal/engine
```

Expected result:

```text
ok  	agentic-platform/backend/internal/engine
```

- [ ] **Step 6: Run the MCP tests to protect recent transport fixes**

Run:

```bash
cd /mnt/agentic-app/backend && go test ./internal/mcp
```

Expected result:

```text
ok  	agentic-platform/backend/internal/mcp
```

- [ ] **Step 7: Commit this task**

Run:

```bash
cd /mnt/agentic-app && git status --short
```

Expected status includes:

```text
 M backend/internal/engine/worker_executor.go
 M backend/internal/engine/tool_result_followup.go
 M backend/internal/engine/tool_result_followup_test.go
```

Commit command:

```bash
cd /mnt/agentic-app && git add backend/internal/engine/worker_executor.go backend/internal/engine/tool_result_followup.go backend/internal/engine/tool_result_followup_test.go && git commit -m "fix: synthesize worker output from MCP tool results"
```

---

### Task 3: Verify End-to-End Behavior With Existing MCP Transports

**Files:**
- No new source files.
- Validate existing changes across backend packages.

- [ ] **Step 1: Format changed Go files**

Run:

```bash
cd /mnt/agentic-app/backend && gofmt -w internal/engine/worker_executor.go internal/engine/tool_result_followup.go internal/engine/tool_result_followup_test.go internal/mcp/sse_client.go internal/mcp/sse_client_test.go
```

Expected result: command exits with status `0` and no output.

- [ ] **Step 2: Run full backend tests**

Run:

```bash
cd /mnt/agentic-app/backend && go test ./...
```

Expected result:

```text
ok      agentic-platform/backend/internal/engine
ok      agentic-platform/backend/internal/mcp
```

Packages without test files may print `[no test files]`.

- [ ] **Step 3: Manually verify GitHub MCP workflow behavior**

Start the backend with the same command used during local development. In another terminal, run the workflow that previously produced this empty output:

```text
list all the github repos i have
```

Expected stream shape:

```text
TOOL_CALL: get_me
TOOL_RESULT: get_me
Workflow Completed Successfully
# Workflow Execution Summary

**Query:** list all the github repos i have

### Output from github agent:
<non-empty natural language response based on get_me result>
```

Acceptable final answer examples:

```text
Your GitHub account is princey-byte. The account reports 1 public repository and 10 private repositories, for 11 repositories visible to the authenticated account.
```

or:

```text
I can see the authenticated GitHub user princey-byte. The returned account details show 1 public repository and 10 total private repositories.
```

- [ ] **Step 4: Manually verify Atlassian MCP error behavior**

Run a workflow that calls `atlassianUserInfo` or `getAccessibleAtlassianResources`.

Expected stream shape when Atlassian still returns its remote error:

```text
TOOL_CALL: atlassianUserInfo
TOOL_RESULT: atlassianUserInfo
Workflow Completed Successfully
# Workflow Execution Summary

### Output from <agent name>:
The Atlassian MCP tool returned an error: We are having trouble completing this action. Please try again shortly.
```

The final response must not be empty, and it must not invent Atlassian user/resource data when the MCP result has `isError: true`.

- [ ] **Step 5: Inspect git diff**

Run:

```bash
cd /mnt/agentic-app && git diff --stat
```

Expected changed areas:

```text
backend/internal/engine/worker_executor.go
backend/internal/engine/tool_result_followup.go
backend/internal/engine/tool_result_followup_test.go
backend/internal/mcp/sse_client.go
backend/internal/mcp/sse_client_test.go
```

The MCP files may already be changed from the previous transport/session work. This task should not introduce frontend changes.

- [ ] **Step 6: Commit final verification updates if needed**

If Task 3 produced formatting-only changes, commit them:

```bash
cd /mnt/agentic-app && git add backend/internal/engine backend/internal/mcp && git commit -m "test: verify MCP tool result synthesis"
```

If Task 3 produced no new changes, do not create an empty commit.

---

## Self-Review

**Spec coverage:**
- Covers the reported GitHub MCP symptom: successful `TOOL_RESULT` followed by empty worker output.
- Covers future MCP tools by formatting generic `interface{}` tool results instead of hardcoding GitHub or Atlassian behavior.
- Preserves tool-call streaming and session logs.
- Avoids provider-specific native tool-result message formats by using a second provider-neutral user message.
- Explicitly handles remote MCP error payloads such as Atlassian `isError: true` without inventing data.

**Known provider limitation:**
- Gemini currently does not pass tool definitions to Gemini's native tool-calling API in `backend/internal/llm/gemini_provider.go`. This plan still helps Gemini if a tool result is produced by the worker path, because the follow-up message is plain text. It does not add native Gemini tool-calling support.

**Risk controls:**
- Second LLM call receives `nil` tools to prevent recursive tool loops.
- If second LLM call fails or returns empty text, worker returns a readable tool-result fallback instead of an empty string.
- Existing MCP transport/session tests remain in place.

**Verification commands:**
- `cd /mnt/agentic-app/backend && go test ./internal/engine`
- `cd /mnt/agentic-app/backend && go test ./internal/mcp`
- `cd /mnt/agentic-app/backend && go test ./...`
