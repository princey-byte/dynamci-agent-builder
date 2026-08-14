package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"agentic-platform/backend/internal/mcp/transport"
	"agentic-platform/backend/internal/models"
)

type MCPToolsListResponse struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Result  struct {
		Tools []struct {
			Name        string          `json:"name"`
			Description string          `json:"description"`
			InputSchema json.RawMessage `json:"inputSchema"`
		} `json:"tools"`
	} `json:"result"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func DiscoverServerTools(ctx context.Context, req models.DiscoverToolsRequest) (models.MCPDiscoveryResult, error) {
	if err := req.ValidateConnectionTarget(); err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
	}

	if req.TransportType == models.TransportStdio {
		client := transport.NewStdioClient(transport.StdioConfig{
			Command:          req.Command,
			Args:             req.Args,
			WorkingDirectory: req.WorkingDirectory,
			AuthConfig:       req.AuthConfig,
		})
		return client.DiscoverTools(ctx)
	}

	tools, err := discoverHTTPServerToolsLegacy(ctx, req)
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
	}
	if len(tools) == 0 {
		return models.MCPDiscoveryResult{
			Status:  models.MCPDiscoveryStatusEmpty,
			Message: "Connected to MCP HTTP server, but it returned no tools.",
			Tools:   []models.DiscoveredTool{},
		}, nil
	}
	return models.MCPDiscoveryResult{
		Status:  models.MCPDiscoveryStatusConnected,
		Message: fmt.Sprintf("Connected to MCP HTTP server and discovered %d tools.", len(tools)),
		Tools:   tools,
	}, nil
}

func discoverHTTPServerToolsLegacy(ctx context.Context, req models.DiscoverToolsRequest) ([]models.DiscoveredTool, error) {
	if req.ServerURL == "" {
		return nil, fmt.Errorf("server_url is required for discovery")
	}

	client := &http.Client{Timeout: 15 * time.Second}

	// Prepare Auth Header
	token := ""
	if req.AuthConfig.OAuth != nil && req.AuthConfig.OAuth.AccessToken != "" {
		token = req.AuthConfig.OAuth.AccessToken
	} else if req.AuthConfig.BearerToken != "" {
		token = req.AuthConfig.BearerToken
	}

	applyHeaders := func(r *http.Request, sessionID string) {
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Accept", "application/json, text/event-stream")
		r.Header.Set("User-Agent", "AgenticPlatform/1.0")

		if token != "" {
			r.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		} else if req.AuthType == models.AuthTypeAPIKey && req.AuthConfig.APIKeyHeaderName != "" && req.AuthConfig.APIKeyHeaderValue != "" {
			r.Header.Set(req.AuthConfig.APIKeyHeaderName, req.AuthConfig.APIKeyHeaderValue)
		}

		if sessionID != "" {
			r.Header.Set("Mcp-Session-Id", sessionID)
			r.Header.Set("Mc-Session-Id", sessionID)
		}

		for k, v := range req.AuthConfig.CustomHeaders {
			r.Header.Set(k, v)
		}
	}

	// Step A: Perform MCP Initialize protocol step to obtain Session ID if required by server
	initPayload := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"capabilities":    map[string]interface{}{},
			"clientInfo": map[string]interface{}{
				"name":    "AgenticPlatform",
				"version": "1.0.0",
			},
		},
	}

	sessionID := ""
	initBytes, _ := json.Marshal(initPayload)
	initReq, err := http.NewRequestWithContext(ctx, "POST", req.ServerURL, bytes.NewBuffer(initBytes))
	if err == nil {
		applyHeaders(initReq, "")
		initResp, initErr := client.Do(initReq)
		if initErr == nil {
			sessionID = initResp.Header.Get("Mcp-Session-Id")
			if sessionID == "" {
				sessionID = initResp.Header.Get("Mc-Session-Id")
			}
			_ = initResp.Body.Close()

			// Send initialized notification if session started
			if sessionID != "" {
				notifPayload := map[string]interface{}{
					"jsonrpc": "2.0",
					"method":  "notifications/initialized",
				}
				notifBytes, _ := json.Marshal(notifPayload)
				notifReq, _ := http.NewRequestWithContext(ctx, "POST", req.ServerURL, bytes.NewBuffer(notifBytes))
				if notifReq != nil {
					applyHeaders(notifReq, sessionID)
					notifResp, notifErr := client.Do(notifReq)
					if notifErr == nil {
						_ = notifResp.Body.Close()
					}
				}
			}
		}
	}

	// Step B: Send tools/list JSON-RPC request
	rpcPayload := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/list",
		"params":  map[string]interface{}{},
	}

	jsonBytes, err := json.Marshal(rpcPayload)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", req.ServerURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create discovery request: %w", err)
	}

	applyHeaders(httpReq, sessionID)

	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MCP server (%s): %w", req.ServerURL, err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response from MCP server: %w", err)
	}

	bodyStr := string(bodyBytes)
	var rpcRes MCPToolsListResponse

	// Try unmarshaling standard JSON response
	if jsonErr := json.Unmarshal(bodyBytes, &rpcRes); jsonErr == nil && len(rpcRes.Result.Tools) > 0 {
		return extractDiscoveredTools(rpcRes)
	}

	// Try unmarshaling SSE Stream response (data: {"jsonrpc":"2.0",...})
	if strings.Contains(bodyStr, "data:") {
		lines := strings.Split(bodyStr, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "data:") {
				jsonData := strings.TrimPrefix(line, "data:")
				jsonData = strings.TrimSpace(jsonData)
				var sseRpc MCPToolsListResponse
				if jsonErr := json.Unmarshal([]byte(jsonData), &sseRpc); jsonErr == nil && len(sseRpc.Result.Tools) > 0 {
					return extractDiscoveredTools(sseRpc)
				}
			}
		}
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("MCP server returned HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	if rpcRes.Error != nil && rpcRes.Error.Message != "" {
		return nil, fmt.Errorf("MCP server returned JSON-RPC error: %s", rpcRes.Error.Message)
	}

	// Return empty tools list if server exposes no tools
	return []models.DiscoveredTool{}, nil
}

func extractDiscoveredTools(rpcRes MCPToolsListResponse) ([]models.DiscoveredTool, error) {
	var discovered []models.DiscoveredTool
	for _, t := range rpcRes.Result.Tools {
		discovered = append(discovered, models.DiscoveredTool{
			Name:        t.Name,
			Description: t.Description,
			InputSchema: t.InputSchema,
			Selected:    true,
		})
	}
	return discovered, nil
}
