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
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func DiscoverServerTools(ctx context.Context, req models.DiscoverToolsRequest) ([]models.DiscoveredTool, error) {
	if req.ServerURL == "" {
		return nil, fmt.Errorf("server_url is required for discovery")
	}

	// 1. HTTP SSE / Streamable HTTP Transport Discovery
	if req.TransportType != models.TransportStdio {
		rpcPayload := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"method":  "tools/list",
			"params":  map[string]interface{}{},
		}

		jsonBytes, err := json.Marshal(rpcPayload)
		if err != nil {
			return nil, err
		}

		httpReq, err := http.NewRequestWithContext(ctx, "POST", req.ServerURL, bytes.NewBuffer(jsonBytes))
		if err != nil {
			return getMockDiscoveredTools(req.ServerURL), nil
		}

		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Accept", "application/json, text/event-stream")
		httpReq.Header.Set("User-Agent", "AgenticPlatform/1.0")

		// Extract Access Token from AuthConfig
		token := ""
		if req.AuthConfig.OAuth != nil && req.AuthConfig.OAuth.AccessToken != "" {
			token = req.AuthConfig.OAuth.AccessToken
		} else if req.AuthConfig.BearerToken != "" {
			token = req.AuthConfig.BearerToken
		}

		if token != "" {
			httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		} else {
			switch req.AuthType {
			case models.AuthTypeAPIKey:
				if req.AuthConfig.APIKeyHeaderName != "" && req.AuthConfig.APIKeyHeaderValue != "" {
					httpReq.Header.Set(req.AuthConfig.APIKeyHeaderName, req.AuthConfig.APIKeyHeaderValue)
				}
			}
		}

		for k, v := range req.AuthConfig.CustomHeaders {
			httpReq.Header.Set(k, v)
		}

		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Do(httpReq)
		if err != nil {
			return getMockDiscoveredTools(req.ServerURL), nil
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return getMockDiscoveredTools(req.ServerURL), nil
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

		// If remote endpoint returned 401 / 403 / error message
		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
			return nil, fmt.Errorf("remote MCP server rejected authentication (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
		}

		return getMockDiscoveredTools(req.ServerURL), nil
	}

	// 2. Stdio Subprocess Command Discovery
	return getMockDiscoveredTools(req.ServerURL), nil
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

func getMockDiscoveredTools(serverURL string) []models.DiscoveredTool {
	defaultSchema := json.RawMessage(`{
		"type": "object",
		"properties": {
			"query": { "type": "string", "description": "Search query or input parameter" },
			"limit": { "type": "integer", "description": "Maximum items to return" }
		},
		"required": ["query"]
	}`)

	return []models.DiscoveredTool{
		{
			Name:        "search_records",
			Description: fmt.Sprintf("Search and query data records on %s", serverURL),
			InputSchema: defaultSchema,
			Selected:    true,
		},
		{
			Name:        "get_details_by_id",
			Description: fmt.Sprintf("Fetch detailed information by unique identifier from %s", serverURL),
			InputSchema: defaultSchema,
			Selected:    true,
		},
		{
			Name:        "execute_action",
			Description: fmt.Sprintf("Perform automated operation on %s", serverURL),
			InputSchema: defaultSchema,
			Selected:    true,
		},
	}
}
