package mcp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"agentic-platform/backend/internal/models"
)

func TestSSEMCPClientInitializesSessionBeforeCallingTool(t *testing.T) {
	const sessionID = "test-session-id"

	var sawInitialize bool
	var sawInitialized bool
	var sawToolCallWithSession bool

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Method string `json:"method"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}

		switch payload.Method {
		case "initialize":
			sawInitialize = true
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Mcp-Session-Id", sessionID)
			_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}}}}`))
		case "notifications/initialized":
			sawInitialized = true
			if got := r.Header.Get("Mcp-Session-Id"); got != sessionID {
				t.Fatalf("initialized notification missing session header: got %q", got)
			}
			w.WriteHeader(http.StatusAccepted)
		case "tools/call":
			if got := r.Header.Get("Mcp-Session-Id"); got != sessionID {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"jsonrpc":"2.0","error":{"code":-32600,"message":"Request must be an initialize request if no session ID is provided."}}`))
				return
			}
			sawToolCallWithSession = true
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":2,"result":{"ok":true}}`))
		default:
			t.Fatalf("unexpected MCP method %q", payload.Method)
		}
	}))
	defer server.Close()

	client := NewSSEMCPClient(server.URL, "testTool", nil, models.AuthTypeNone, models.AuthConfig{})

	result, err := client.CallTool(context.Background(), "testTool", map[string]interface{}{})
	if err != nil {
		t.Fatalf("CallTool returned error: %v", err)
	}

	resultMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map result, got %T", result)
	}
	if _, hasError := resultMap["error"]; hasError {
		t.Fatalf("unexpected JSON-RPC error result: %#v", resultMap["error"])
	}
	if !sawInitialize || !sawInitialized || !sawToolCallWithSession {
		t.Fatalf("expected initialize, initialized notification, and session-bound tool call; got initialize=%v initialized=%v toolCall=%v", sawInitialize, sawInitialized, sawToolCallWithSession)
	}
}

func TestSSEMCPClientParsesSSEToolResult(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Method string `json:"method"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}

		switch payload.Method {
		case "initialize":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}}}}`))
		case "notifications/initialized":
			w.WriteHeader(http.StatusAccepted)
		case "tools/call":
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("event: message\n" +
				`data: {"result":{"content":[{"type":"text","text":"{\"error\":true,\"message\":\"We are having trouble completing this action. Please try again shortly.\"}"}],"isError":true},"jsonrpc":"2.0","id":2}` +
				"\n\n"))
		default:
			t.Fatalf("unexpected MCP method %q", payload.Method)
		}
	}))
	defer server.Close()

	client := NewSSEMCPClient(server.URL, "testTool", nil, models.AuthTypeNone, models.AuthConfig{})

	result, err := client.CallTool(context.Background(), "testTool", map[string]interface{}{})
	if err != nil {
		t.Fatalf("CallTool returned error: %v", err)
	}

	resultMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected parsed JSON-RPC map result, got %T", result)
	}
	if resultMap["jsonrpc"] != "2.0" {
		t.Fatalf("expected JSON-RPC response, got %#v", resultMap)
	}
	if _, raw := result.(string); raw {
		t.Fatalf("expected SSE data payload to be parsed, got raw string")
	}
}
