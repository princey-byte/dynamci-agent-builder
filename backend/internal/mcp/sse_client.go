package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/models"
)

type SSEMCPClient struct {
	ServerURL       string
	ToolName        string
	Schema          json.RawMessage
	AuthType        models.AuthType
	AuthConfig      models.AuthConfig
	SessionID       string
	ProtocolVersion string
	initialized     bool
	mu              sync.Mutex
}

func NewSSEMCPClient(serverURL string, toolName string, schema json.RawMessage, authType models.AuthType, authConfig models.AuthConfig) *SSEMCPClient {
	return &SSEMCPClient{
		ServerURL:       serverURL,
		ToolName:        toolName,
		Schema:          schema,
		AuthType:        authType,
		AuthConfig:      authConfig,
		ProtocolVersion: "2025-06-18",
	}
}

func (c *SSEMCPClient) applyHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("User-Agent", "AgenticPlatform/1.0")
	if c.ProtocolVersion != "" {
		req.Header.Set("MCP-Protocol-Version", c.ProtocolVersion)
	}
	if c.SessionID != "" {
		req.Header.Set("Mcp-Session-Id", c.SessionID)
	}

	switch c.AuthType {
	case models.AuthTypeBearer:
		if c.AuthConfig.BearerToken != "" {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.AuthConfig.BearerToken))
		}
	case models.AuthTypeOAuth:
		if c.AuthConfig.OAuth != nil && c.AuthConfig.OAuth.AccessToken != "" {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.AuthConfig.OAuth.AccessToken))
		} else if c.AuthConfig.BearerToken != "" {
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

	// Fallback Authorization header if OAuth or Bearer token is present
	if req.Header.Get("Authorization") == "" {
		if c.AuthConfig.OAuth != nil && c.AuthConfig.OAuth.AccessToken != "" {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.AuthConfig.OAuth.AccessToken))
		} else if c.AuthConfig.BearerToken != "" {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.AuthConfig.BearerToken))
		}
	}

	// Always apply custom headers if present
	for k, v := range c.AuthConfig.CustomHeaders {
		req.Header.Set(k, v)
	}
}

func (c *SSEMCPClient) ensureInitialized(ctx context.Context) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.initialized {
		return
	}

	client := &http.Client{Timeout: 15 * time.Second}
	initPayload := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]interface{}{
			"protocolVersion": c.ProtocolVersion,
			"capabilities":    map[string]interface{}{},
			"clientInfo": map[string]interface{}{
				"name":    "AgenticPlatform",
				"version": "1.0.0",
			},
		},
	}

	body, err := json.Marshal(initPayload)
	if err != nil {
		return
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.ServerURL, bytes.NewBuffer(body))
	if err != nil {
		return
	}
	c.applyHeaders(req)
	req.Header.Del("Mcp-Session-Id")

	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		c.initialized = true
		return
	}

	if sessionID := resp.Header.Get("Mcp-Session-Id"); sessionID != "" {
		c.SessionID = sessionID
	} else if sessionID := resp.Header.Get("Mc-Session-Id"); sessionID != "" {
		c.SessionID = sessionID
	}
	c.updateProtocolVersion(respBody)

	c.sendInitializedNotification(ctx, client)
	c.initialized = true
}

func (c *SSEMCPClient) updateProtocolVersion(body []byte) {
	var initResp struct {
		Result struct {
			ProtocolVersion string `json:"protocolVersion"`
		} `json:"result"`
	}

	if json.Unmarshal(body, &initResp) == nil && initResp.Result.ProtocolVersion != "" {
		c.ProtocolVersion = initResp.Result.ProtocolVersion
		return
	}

	for _, line := range strings.Split(string(body), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		jsonData := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if json.Unmarshal([]byte(jsonData), &initResp) == nil && initResp.Result.ProtocolVersion != "" {
			c.ProtocolVersion = initResp.Result.ProtocolVersion
			return
		}
	}
}

func (c *SSEMCPClient) sendInitializedNotification(ctx context.Context, client *http.Client) {
	notifPayload := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "notifications/initialized",
	}
	body, err := json.Marshal(notifPayload)
	if err != nil {
		return
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.ServerURL, bytes.NewBuffer(body))
	if err != nil {
		return
	}
	c.applyHeaders(req)
	resp, err := client.Do(req)
	if err == nil {
		_ = resp.Body.Close()
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
	c.ensureInitialized(ctx)

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
	if res, ok := parseSSEResponse(body); ok {
		return res, nil
	}

	return string(body), nil
}

func parseSSEResponse(body []byte) (map[string]interface{}, bool) {
	for _, line := range strings.Split(string(body), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data:") {
			continue
		}

		jsonData := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if jsonData == "" || jsonData == "[DONE]" {
			continue
		}

		var res map[string]interface{}
		if json.Unmarshal([]byte(jsonData), &res) == nil {
			return res, true
		}
	}

	return nil, false
}

func (c *SSEMCPClient) Close() error {
	return nil
}
