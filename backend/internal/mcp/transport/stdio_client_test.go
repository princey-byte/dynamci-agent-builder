package transport

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"

	"agentic-platform/backend/internal/models"
)

func TestStdioClientDiscoversToolsWithInitializeHandshake(t *testing.T) {
	client := NewStdioClient(StdioConfig{
		Command: os.Args[0],
		Args:    []string{"-test.run=TestStdioHelperProcess", "--", "tools"},
		AuthConfig: models.AuthConfig{EnvVars: map[string]string{
			"GO_WANT_HELPER_PROCESS": "1",
			"MCP_HELPER_MODE":        "tools",
		}},
	})

	result, err := client.DiscoverTools(context.Background())
	if err != nil {
		t.Fatalf("DiscoverTools returned error: %v", err)
	}
	if result.Status != models.MCPDiscoveryStatusConnected {
		t.Fatalf("expected connected status, got %q", result.Status)
	}
	if len(result.Tools) != 1 || result.Tools[0].Name != "read_file" {
		t.Fatalf("expected read_file discovery, got %#v", result.Tools)
	}
}

func TestStdioClientReportsEmptyTools(t *testing.T) {
	client := NewStdioClient(StdioConfig{
		Command: os.Args[0],
		Args:    []string{"-test.run=TestStdioHelperProcess", "--", "empty"},
		AuthConfig: models.AuthConfig{EnvVars: map[string]string{
			"GO_WANT_HELPER_PROCESS": "1",
			"MCP_HELPER_MODE":        "empty",
		}},
	})

	result, err := client.DiscoverTools(context.Background())
	if err != nil {
		t.Fatalf("DiscoverTools returned error: %v", err)
	}
	if result.Status != models.MCPDiscoveryStatusEmpty {
		t.Fatalf("expected empty status, got %q", result.Status)
	}
	if len(result.Tools) != 0 {
		t.Fatalf("expected zero tools, got %#v", result.Tools)
	}
}

func TestStdioClientCallsTool(t *testing.T) {
	client := NewStdioClient(StdioConfig{
		Command:  os.Args[0],
		Args:     []string{"-test.run=TestStdioHelperProcess", "--", "call"},
		ToolName: "read_file",
		AuthConfig: models.AuthConfig{EnvVars: map[string]string{
			"GO_WANT_HELPER_PROCESS": "1",
			"MCP_HELPER_MODE":        "call",
		}},
	})

	result, err := client.CallTool(context.Background(), "read_file", map[string]interface{}{"path": "/tmp/example.txt"})
	if err != nil {
		t.Fatalf("CallTool returned error: %v", err)
	}
	resultMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map result, got %T", result)
	}
	if resultMap["jsonrpc"] != "2.0" {
		t.Fatalf("expected JSON-RPC response, got %#v", resultMap)
	}
	if resultMap["result"] == nil {
		t.Fatalf("expected result payload, got %#v", resultMap)
	}
}

func TestStdioClientReturnsStartupFailureWithStderr(t *testing.T) {
	client := NewStdioClient(StdioConfig{
		Command: os.Args[0],
		Args:    []string{"-test.run=TestStdioHelperProcess", "--", "startup-error"},
		AuthConfig: models.AuthConfig{EnvVars: map[string]string{
			"GO_WANT_HELPER_PROCESS": "1",
			"MCP_HELPER_MODE":        "startup-error",
		}},
	})

	_, err := client.DiscoverTools(context.Background())
	if err == nil {
		t.Fatal("expected startup error")
	}
	if !strings.Contains(err.Error(), "helper startup failed") {
		t.Fatalf("expected stderr in error, got %v", err)
	}
}

func TestStdioHelperProcess(t *testing.T) {
	if os.Getenv("GO_WANT_HELPER_PROCESS") != "1" {
		return
	}

	mode := os.Getenv("MCP_HELPER_MODE")
	if mode == "startup-error" {
		_, _ = fmt.Fprintln(os.Stderr, "helper startup failed")
		os.Exit(2)
	}

	reader := bufio.NewScanner(os.Stdin)
	encoder := json.NewEncoder(os.Stdout)

	for reader.Scan() {
		var request map[string]interface{}
		if err := json.Unmarshal(reader.Bytes(), &request); err != nil {
			_, _ = fmt.Fprintln(os.Stderr, "invalid json")
			os.Exit(3)
		}

		method, _ := request["method"].(string)
		id := request["id"]

		switch method {
		case "initialize":
			_ = encoder.Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      id,
				"result": map[string]interface{}{
					"protocolVersion": DefaultProtocolVersion,
					"capabilities": map[string]interface{}{
						"tools": map[string]interface{}{},
					},
					"serverInfo": map[string]interface{}{"name": "helper", "version": "1.0.0"},
				},
			})
		case "notifications/initialized":
		case "tools/list":
			tools := []map[string]interface{}{}
			if mode != "empty" {
				tools = append(tools, map[string]interface{}{
					"name":        "read_file",
					"description": "Read a file by path.",
					"inputSchema": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"path": map[string]interface{}{"type": "string"},
						},
						"required": []string{"path"},
					},
				})
			}
			_ = encoder.Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      id,
				"result":  map[string]interface{}{"tools": tools},
			})
		case "tools/call":
			_ = encoder.Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      id,
				"result": map[string]interface{}{
					"content": []map[string]interface{}{{"type": "text", "text": "file contents"}},
				},
			})
		default:
			_ = encoder.Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      id,
				"error":   map[string]interface{}{"code": -32601, "message": "method not found"},
			})
		}
	}

	os.Exit(0)
}