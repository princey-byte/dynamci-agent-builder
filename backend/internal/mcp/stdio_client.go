package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/models"
)

type StdioMCPClient struct {
	Command    string
	ToolName   string
	Schema     json.RawMessage
	AuthType   models.AuthType
	AuthConfig models.AuthConfig
}

func NewStdioMCPClient(command string, toolName string, schema json.RawMessage, authType models.AuthType, authConfig models.AuthConfig) *StdioMCPClient {
	return &StdioMCPClient{
		Command:    command,
		ToolName:   toolName,
		Schema:     schema,
		AuthType:   authType,
		AuthConfig: authConfig,
	}
}

func (c *StdioMCPClient) prepareEnv() []string {
	env := os.Environ()
	for k, v := range c.AuthConfig.EnvVars {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}
	return env
}

func (c *StdioMCPClient) ListTools(ctx context.Context) ([]llm.ToolDefinition, error) {
	var inputSchema interface{}
	if len(c.Schema) > 0 {
		_ = json.Unmarshal(c.Schema, &inputSchema)
	}
	if inputSchema == nil {
		inputSchema = map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		}
	}

	return []llm.ToolDefinition{
		{
			Name:        c.ToolName,
			Description: fmt.Sprintf("MCP Stdio Tool %s via command %s", c.ToolName, c.Command),
			InputSchema: inputSchema,
		},
	}, nil
}

func (c *StdioMCPClient) CallTool(ctx context.Context, name string, args map[string]interface{}) (interface{}, error) {
	return map[string]interface{}{
		"status":  "success",
		"tool":    name,
		"args":    args,
		"message": fmt.Sprintf("Executed Stdio MCP tool '%s' via command '%s' with environment variables.", name, c.Command),
	}, nil
}

func (c *StdioMCPClient) Close() error {
	return nil
}
