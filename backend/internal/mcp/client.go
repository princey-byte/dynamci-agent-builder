package mcp

import (
	"context"

	"agentic-platform/backend/internal/llm"
)

type MCPClient interface {
	ListTools(ctx context.Context) ([]llm.ToolDefinition, error)
	CallTool(ctx context.Context, name string, args map[string]interface{}) (interface{}, error)
	Close() error
}
