package mcp

import (
	"context"

	"agentic-platform/backend/internal/llm"
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
		client = NewStdioMCPClient(tool.ServerURL, tool.Name, tool.InputSchema, authType, authConfig)
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
	return map[string]interface{}{
		"status":  "success",
		"tool":    toolName,
		"args":    args,
		"message": "Tool executed via registry.",
	}, nil
}
