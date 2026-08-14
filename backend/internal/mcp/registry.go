package mcp

import (
	"context"
	"fmt"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/mcp/transport"
	"agentic-platform/backend/internal/models"
)

type ToolRegistry struct {
	clients map[string]MCPClient
}

func NewToolRegistry() *ToolRegistry {
	return &ToolRegistry{
		clients: make(map[string]MCPClient),
	}
}

func (r *ToolRegistry) RegisterTool(tool models.MCPTool) MCPClient {
	var client MCPClient

	var authType models.AuthType = models.AuthTypeNone
	var authConfig models.AuthConfig

	if tool.Server != nil {
		authType = tool.Server.AuthType
		authConfig = tool.Server.AuthConfig
	}

	if tool.TransportType == models.TransportStdio {
		command := tool.Command
		args := tool.Args
		workingDirectory := tool.WorkingDirectory
		if command == "" && tool.Server != nil {
			command = tool.Server.Command
			args = tool.Server.Args
			workingDirectory = tool.Server.WorkingDirectory
		}
		if command == "" {
			command = tool.ServerURL
		}
		client = transport.NewStdioClient(transport.StdioConfig{
			Command:          command,
			Args:             args,
			WorkingDirectory: workingDirectory,
			ToolName:         tool.Name,
			Schema:           tool.InputSchema,
			AuthConfig:       authConfig,
		})
	} else {
		client = NewSSEMCPClient(tool.ServerURL, tool.Name, tool.InputSchema, authType, authConfig)
	}
	r.clients[tool.Name] = client
	return client
}

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

func (r *ToolRegistry) ExecuteTool(ctx context.Context, toolName string, args map[string]interface{}) (interface{}, error) {
	if client, exists := r.clients[toolName]; exists {
		return client.CallTool(ctx, toolName, args)
	}
	return nil, fmt.Errorf("MCP tool %q is not registered in the runtime registry", toolName)
}
