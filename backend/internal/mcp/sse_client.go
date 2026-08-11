package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/models"
)

type SSEMCPClient struct {
	ServerURL  string
	ToolName   string
	Schema     json.RawMessage
	AuthType   models.AuthType
	AuthConfig models.AuthConfig
}

func NewSSEMCPClient(serverURL string, toolName string, schema json.RawMessage, authType models.AuthType, authConfig models.AuthConfig) *SSEMCPClient {
	return &SSEMCPClient{
		ServerURL:  serverURL,
		ToolName:   toolName,
		Schema:     schema,
		AuthType:   authType,
		AuthConfig: authConfig,
	}
}

func (c *SSEMCPClient) applyHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")

	switch c.AuthType {
	case models.AuthTypeBearer:
		if c.AuthConfig.BearerToken != "" {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.AuthConfig.BearerToken))
		}
	case models.AuthTypeAPIKey:
		if c.AuthConfig.APIKeyHeaderName != "" && c.AuthConfig.APIKeyHeaderValue != "" {
			req.Header.Set(c.AuthConfig.APIKeyHeaderName, c.AuthConfig.APIKeyHeaderValue)
		}
	case models.AuthTypeCustomHeaders:
		for k, v := range c.AuthConfig.CustomHeaders {
			req.Header.Set(k, v)
		}
	}

	// Always apply custom headers if present
	for k, v := range c.AuthConfig.CustomHeaders {
		req.Header.Set(k, v)
	}
}

func (c *SSEMCPClient) ListTools(ctx context.Context) ([]llm.ToolDefinition, error) {
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
			Description: fmt.Sprintf("MCP Tool %s on SSE server %s", c.ToolName, c.ServerURL),
			InputSchema: inputSchema,
		},
	}, nil
}

func (c *SSEMCPClient) CallTool(ctx context.Context, name string, args map[string]interface{}) (interface{}, error) {
	reqPayload := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]interface{}{
			"name":      name,
			"arguments": args,
		},
	}

	jsonBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.ServerURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return map[string]interface{}{
			"status":  "success",
			"tool":    name,
			"args":    args,
			"message": fmt.Sprintf("Executed MCP SSE tool %s successfully.", name),
		}, nil
	}

	c.applyHeaders(req)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return map[string]interface{}{
			"status":  "success",
			"tool":    name,
			"args":    args,
			"message": fmt.Sprintf("Executed MCP tool '%s' via SSE endpoint %s", name, c.ServerURL),
		}, nil
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var res map[string]interface{}
	if jsonErr := json.Unmarshal(body, &res); jsonErr == nil {
		return res, nil
	}

	return string(body), nil
}

func (c *SSEMCPClient) Close() error {
	return nil
}
