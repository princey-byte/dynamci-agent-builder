package transport

import (
	"context"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/models"
)

type Client interface {
	DiscoverTools(ctx context.Context) (models.MCPDiscoveryResult, error)
	ListTools(ctx context.Context) ([]llm.ToolDefinition, error)
	CallTool(ctx context.Context, name string, args map[string]interface{}) (interface{}, error)
	Close() error
}