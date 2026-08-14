package models

import (
	"encoding/json"
	"testing"
)

func TestDiscoverToolsRequestDecodesStdioCommandConfig(t *testing.T) {
	payload := []byte(`{
		"transport_type":"stdio",
		"auth_type":"env_vars",
		"command":"npx",
		"args":["-y","@modelcontextprotocol/server-filesystem","/mnt/agentic-app"],
		"working_directory":"/mnt/agentic-app",
		"auth_config":{"env_vars":{"GITHUB_PERSONAL_ACCESS_TOKEN":"secret"}}
	}`)

	var req DiscoverToolsRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		t.Fatalf("failed to decode request: %v", err)
	}

	if req.TransportType != TransportStdio {
		t.Fatalf("expected stdio transport, got %q", req.TransportType)
	}
	if req.Command != "npx" {
		t.Fatalf("expected command npx, got %q", req.Command)
	}
	if len(req.Args) != 3 {
		t.Fatalf("expected three args, got %#v", req.Args)
	}
	if req.Args[1] != "@modelcontextprotocol/server-filesystem" {
		t.Fatalf("expected package arg, got %#v", req.Args)
	}
	if req.WorkingDirectory != "/mnt/agentic-app" {
		t.Fatalf("expected working directory, got %q", req.WorkingDirectory)
	}
	if req.AuthConfig.EnvVars["GITHUB_PERSONAL_ACCESS_TOKEN"] != "secret" {
		t.Fatalf("expected env var auth config, got %#v", req.AuthConfig.EnvVars)
	}
}

func TestDiscoverToolsRequestValidatesTransportTarget(t *testing.T) {
	stdioReq := DiscoverToolsRequest{TransportType: TransportStdio, Command: "npx"}
	if err := stdioReq.ValidateConnectionTarget(); err != nil {
		t.Fatalf("expected stdio command to validate, got %v", err)
	}

	httpReq := DiscoverToolsRequest{TransportType: TransportSSE, ServerURL: "https://example.com/mcp"}
	if err := httpReq.ValidateConnectionTarget(); err != nil {
		t.Fatalf("expected HTTP endpoint to validate, got %v", err)
	}

	missingCommand := DiscoverToolsRequest{TransportType: TransportStdio}
	if err := missingCommand.ValidateConnectionTarget(); err == nil {
		t.Fatal("expected missing stdio command to fail")
	}

	missingURL := DiscoverToolsRequest{TransportType: TransportSSE}
	if err := missingURL.ValidateConnectionTarget(); err == nil {
		t.Fatal("expected missing HTTP server_url to fail")
	}
}

func TestMCPDiscoveryResultPreservesEmptyToolsState(t *testing.T) {
	result := MCPDiscoveryResult{
		Status:  MCPDiscoveryStatusEmpty,
		Message: "Connected to MCP server, but it returned no tools.",
		Tools:   []DiscoveredTool{},
	}

	encoded, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("failed to marshal discovery result: %v", err)
	}

	var decoded MCPDiscoveryResult
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("failed to decode discovery result: %v", err)
	}
	if decoded.Status != MCPDiscoveryStatusEmpty {
		t.Fatalf("expected empty status, got %q", decoded.Status)
	}
	if decoded.Tools == nil {
		t.Fatal("expected explicit empty tools slice")
	}
}