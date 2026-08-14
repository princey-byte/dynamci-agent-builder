package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"agentic-platform/backend/internal/mcp/transport"
	"agentic-platform/backend/internal/models"
)

func TestDiscoverServerToolsRoutesStdioToTransportModule(t *testing.T) {
	result, err := DiscoverServerTools(context.Background(), models.DiscoverToolsRequest{
		TransportType: models.TransportStdio,
		AuthType:      models.AuthTypeEnvVars,
		Command:       os.Args[0],
		Args:          []string{"-test.run=TestDiscoverStdioHelperProcess", "--", "tools"},
		AuthConfig: models.AuthConfig{EnvVars: map[string]string{
			"GO_WANT_HELPER_PROCESS": "1",
			"MCP_HELPER_MODE":        "tools",
		}},
	})
	if err != nil {
		t.Fatalf("DiscoverServerTools returned error: %v", err)
	}
	if result.Status != models.MCPDiscoveryStatusConnected {
		t.Fatalf("expected connected status, got %q", result.Status)
	}
	if len(result.Tools) != 1 || result.Tools[0].Name != "read_file" {
		t.Fatalf("expected read_file discovery, got %#v", result.Tools)
	}
}

func TestDiscoverServerToolsRejectsMissingStdioCommand(t *testing.T) {
	result, err := DiscoverServerTools(context.Background(), models.DiscoverToolsRequest{TransportType: models.TransportStdio})
	if err == nil {
		t.Fatal("expected missing command error")
	}
	if result.Status != models.MCPDiscoveryStatusError {
		t.Fatalf("expected error status, got %q", result.Status)
	}
}

func TestDiscoverStdioHelperProcess(t *testing.T) {
	if os.Getenv("GO_WANT_HELPER_PROCESS") != "1" {
		return
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
					"protocolVersion": transport.DefaultProtocolVersion,
					"capabilities":    map[string]interface{}{"tools": map[string]interface{}{}},
				},
			})
		case "notifications/initialized":
		case "tools/list":
			_ = encoder.Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      id,
				"result": map[string]interface{}{
					"tools": []map[string]interface{}{{
						"name":        "read_file",
						"description": "Read a file by path.",
						"inputSchema": map[string]interface{}{
							"type":       "object",
							"properties": map[string]interface{}{"path": map[string]interface{}{"type": "string"}},
						},
					}},
				},
			})
		}
	}
	os.Exit(0)
}