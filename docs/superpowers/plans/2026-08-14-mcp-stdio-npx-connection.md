# Modular MCP Stdio NPX Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standards-aligned MCP stdio/NPX server discovery and tool execution without disrupting the existing HTTPS/SSE MCP path.

**Architecture:** Add a modular transport layer where stdio/NPX is implemented as a new isolated transport module and the current HTTPS/SSE behavior remains the default HTTP path. Shared MCP JSON-RPC lifecycle helpers live in the transport package, while existing API, repository, and UI surfaces get only the narrow fields needed to select a transport and display truthful connection status.

**Tech Stack:** Go 1.25 backend, Gin HTTP API, PostgreSQL migrations, Next.js 16 + React 19 frontend, TypeScript, MCP JSON-RPC lifecycle (`initialize`, `notifications/initialized`, `tools/list`, `tools/call`), stdio subprocess transport via `os/exec`.

---

## Design Decision: Modular, Minimal-Risk Transport Expansion

The existing HTTPS/SSE MCP code should not be broadly rewritten while adding stdio. Local NPX-based MCP servers are a different transport: they are executable processes launched by the backend, and the client communicates through newline-delimited JSON-RPC over stdin/stdout. Remote HTTPS servers are network endpoints and should keep using the existing `SSEMCPClient` behavior unless a specific failing test proves a change is needed.

The implementation therefore uses three layers:

1. **Shared API and storage layer:** Existing MCP server/tool registration screens, API routes, repositories, and agent-tool registry continue to represent MCP servers and tools.
2. **Transport selection layer:** Existing `backend/internal/mcp` code selects `stdio` or `sse` based on `transport_type`.
3. **Transport implementation layer:** New `backend/internal/mcp/transport` code owns stdio process launch, JSON-RPC framing, lifecycle handshake, and tool calls. Existing HTTP/SSE code is adapted through a small wrapper rather than rewritten.

This preserves currently working HTTPS functionality and makes the stdio feature independently testable.

---

## File Structure

**New modular transport package**
- Create: `backend/internal/mcp/transport/jsonrpc.go`
  - Shared MCP JSON-RPC request/response helpers.
- Create: `backend/internal/mcp/transport/client.go`
  - Shared transport interface used by stdio and future transport adapters.
- Create: `backend/internal/mcp/transport/stdio_client.go`
  - Real NPX/local command stdio transport implementation.
- Create: `backend/internal/mcp/transport/stdio_client_test.go`
  - Process-level tests that prove initialize, initialized notification, tools/list, tools/call, env vars, and stderr failure reporting.

**Existing backend integration points with narrow changes**
- Modify: `backend/internal/models/mcp_server.go`
  - Add stdio config fields and structured discovery result types.
- Modify: `backend/internal/models/mcp_tool.go`
  - Add stdio config fields to imported tool rows.
- Create: `backend/migrations/008_add_mcp_stdio_config_and_connection_state.sql`
  - Persist command, args, working directory, and last connection state.
- Modify: `backend/internal/mcp/discovery.go`
  - For `transport_type=stdio`, delegate to the new stdio transport. For HTTP/SSE, preserve existing request behavior and wrap the result in the new detailed status response.
- Modify: `backend/internal/mcp/registry.go`
  - Runtime tool execution uses the stdio transport for stdio tools and existing `SSEMCPClient` for HTTP tools.
- Modify: `backend/internal/api/mcp_server_handler.go`
  - Return structured discovery status instead of labeling empty stdio discovery as connected.
- Modify: `backend/internal/repository/mcp_server_repository.go`
  - Save/load stdio config and last connection state.
- Modify: `backend/internal/repository/mcp_tool_repository.go`
  - Save/load stdio config for manually registered tools.

**Frontend changes**
- Modify: `frontend/lib/types.ts`
  - Add stdio command fields and discovery status types.
- Modify: `frontend/lib/api.ts`
  - Type the new discovery response shape.
- Modify: `frontend/components/mcp/MCPServerForm.tsx`
  - Use command + args + working directory fields for stdio, not a URL-shaped field.
- Modify: `frontend/components/mcp/MCPServerCard.tsx`
  - Display real registration/connection/error state.
- Modify: `frontend/app/(dashboard)/mcp-tools/page.tsx`
  - Adjust copy to distinguish HTTP endpoints from local commands.

**Documentation**
- Create: `docs/mcp-connection-behavior.md`
  - Explain how this app handles stdio NPX and HTTPS MCP connections, plus MCP Inspector validation commands.

---

### Task 1: Add Shared Models For Stdio Config And Discovery Status

**Files:**
- Create: `backend/internal/models/mcp_server_test.go`
- Modify: `backend/internal/models/mcp_server.go`
- Modify: `backend/internal/models/mcp_tool.go`
- Modify: `frontend/lib/types.ts`

- [ ] **Step 1: Write the failing backend model test**

Create `backend/internal/models/mcp_server_test.go`:

```go
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
```

- [ ] **Step 2: Run the model test to verify it fails**

Run:

```bash
cd backend && go test ./internal/models -run 'TestDiscoverToolsRequest|TestMCPDiscoveryResult' -v
```

Expected: FAIL to compile because stdio command fields, target validation, and `MCPDiscoveryResult` do not exist yet.

- [ ] **Step 3: Add backend model fields and result types**

Modify `backend/internal/models/mcp_server.go` imports:

```go
import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)
```

Add these types after the existing auth constants:

```go
type MCPConnectionStatus string

const (
	MCPConnectionStatusRegistered MCPConnectionStatus = "REGISTERED"
	MCPConnectionStatusConnected  MCPConnectionStatus = "CONNECTED"
	MCPConnectionStatusError      MCPConnectionStatus = "ERROR"
)

type MCPDiscoveryStatus string

const (
	MCPDiscoveryStatusConnected MCPDiscoveryStatus = "connected"
	MCPDiscoveryStatusEmpty     MCPDiscoveryStatus = "empty"
	MCPDiscoveryStatusError     MCPDiscoveryStatus = "error"
)

type MCPDiscoveryResult struct {
	Status          MCPDiscoveryStatus `json:"status"`
	Message         string             `json:"message"`
	ProtocolVersion string             `json:"protocol_version,omitempty"`
	SessionID       string             `json:"session_id,omitempty"`
	Tools           []DiscoveredTool   `json:"tools"`
}
```

Extend `MCPServer` with the new fields while keeping existing fields:

```go
type MCPServer struct {
	ID                   uuid.UUID           `json:"id"`
	Name                 string              `json:"name"`
	Description          string              `json:"description"`
	ServerURL            string              `json:"server_url"`
	Command              string              `json:"command,omitempty"`
	Args                 []string            `json:"args,omitempty"`
	WorkingDirectory     string              `json:"working_directory,omitempty"`
	TransportType        TransportType       `json:"transport_type"`
	AuthType             AuthType            `json:"auth_type"`
	AuthConfig           AuthConfig          `json:"auth_config"`
	OAuthClientID        string              `json:"oauth_client_id,omitempty"`
	OAuthClientSecret    string              `json:"oauth_client_secret,omitempty"`
	OAuthScopes          string              `json:"oauth_scopes,omitempty"`
	OAuthTokens          *OAuthTokens        `json:"oauth_tokens,omitempty"`
	Status               MCPConnectionStatus `json:"status"`
	LastConnectionStatus string              `json:"last_connection_status,omitempty"`
	LastConnectionError  string              `json:"last_connection_error,omitempty"`
	LastDiscoveredAt     *time.Time          `json:"last_discovered_at,omitempty"`
	CreatedAt            time.Time           `json:"created_at"`
	UpdatedAt            time.Time           `json:"updated_at"`
	Tools                []MCPTool           `json:"tools,omitempty"`
}
```

Replace `CreateMCPServerRequest` and `DiscoverToolsRequest` with:

```go
type CreateMCPServerRequest struct {
	Name              string           `json:"name" binding:"required"`
	Description       string           `json:"description"`
	ServerURL         string           `json:"server_url"`
	Command           string           `json:"command,omitempty"`
	Args              []string         `json:"args,omitempty"`
	WorkingDirectory  string           `json:"working_directory,omitempty"`
	TransportType     TransportType    `json:"transport_type"`
	AuthType          AuthType         `json:"auth_type"`
	AuthConfig        AuthConfig       `json:"auth_config"`
	OAuthClientID     string           `json:"oauth_client_id,omitempty"`
	OAuthClientSecret string           `json:"oauth_client_secret,omitempty"`
	OAuthScopes       string           `json:"oauth_scopes,omitempty"`
	ImportTools       []DiscoveredTool `json:"import_tools,omitempty"`
}

type DiscoverToolsRequest struct {
	ServerURL        string        `json:"server_url"`
	Command          string        `json:"command,omitempty"`
	Args             []string      `json:"args,omitempty"`
	WorkingDirectory string        `json:"working_directory,omitempty"`
	TransportType    TransportType `json:"transport_type"`
	AuthType         AuthType      `json:"auth_type"`
	AuthConfig       AuthConfig    `json:"auth_config"`
}
```

Add validation helpers:

```go
func (r DiscoverToolsRequest) EndpointOrCommand() string {
	if r.TransportType == TransportStdio {
		return r.Command
	}
	return r.ServerURL
}

func (r DiscoverToolsRequest) ValidateConnectionTarget() error {
	if r.TransportType == TransportStdio {
		if r.Command == "" {
			return fmt.Errorf("command is required for stdio MCP discovery")
		}
		return nil
	}
	if r.ServerURL == "" {
		return fmt.Errorf("server_url is required for HTTP MCP discovery")
	}
	return nil
}
```

- [ ] **Step 4: Add stdio fields to MCP tool model**

Modify `backend/internal/models/mcp_tool.go`:

```go
type MCPTool struct {
	ID               uuid.UUID       `json:"id"`
	ServerID         *uuid.UUID      `json:"server_id,omitempty"`
	Server           *MCPServer      `json:"server,omitempty"`
	Name             string          `json:"name"`
	Description      string          `json:"description"`
	ServerURL        string          `json:"server_url"`
	Command          string          `json:"command,omitempty"`
	Args             []string        `json:"args,omitempty"`
	WorkingDirectory string          `json:"working_directory,omitempty"`
	TransportType    TransportType   `json:"transport_type"`
	InputSchema      json.RawMessage `json:"input_schema"`
	CreatedAt        time.Time       `json:"created_at"`
}

type CreateMCPToolRequest struct {
	ServerID         *string         `json:"server_id,omitempty"`
	Name             string          `json:"name" binding:"required"`
	Description      string          `json:"description" binding:"required"`
	ServerURL        string          `json:"server_url"`
	Command          string          `json:"command,omitempty"`
	Args             []string        `json:"args,omitempty"`
	WorkingDirectory string          `json:"working_directory,omitempty"`
	TransportType    TransportType   `json:"transport_type"`
	InputSchema      json.RawMessage `json:"input_schema" binding:"required"`
}
```

- [ ] **Step 5: Add matching frontend types**

Modify `frontend/lib/types.ts`:

```ts
export type MCPConnectionStatus = 'REGISTERED' | 'CONNECTED' | 'ERROR';
export type MCPDiscoveryStatus = 'connected' | 'empty' | 'error';

export interface MCPDiscoveryResult {
  status: MCPDiscoveryStatus;
  message: string;
  protocol_version?: string;
  session_id?: string;
  tools: DiscoveredTool[];
}
```

Replace `MCPTool`, `MCPServer`, and `DiscoverToolsRequest` with:

```ts
export interface MCPTool {
  id: string;
  server_id?: string;
  server?: MCPServer;
  name: string;
  description: string;
  server_url: string;
  command?: string;
  args?: string[];
  working_directory?: string;
  transport_type: TransportType;
  input_schema: any;
  created_at: string;
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  server_url: string;
  command?: string;
  args?: string[];
  working_directory?: string;
  transport_type: TransportType;
  auth_type: AuthType;
  auth_config: AuthConfig;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_scopes?: string;
  oauth_tokens?: OAuthTokens;
  status: MCPConnectionStatus;
  last_connection_status?: string;
  last_connection_error?: string;
  last_discovered_at?: string;
  created_at: string;
  updated_at: string;
  tools?: MCPTool[];
}

export interface DiscoverToolsRequest {
  server_url: string;
  command?: string;
  args?: string[];
  working_directory?: string;
  transport_type: TransportType;
  auth_type: AuthType;
  auth_config: AuthConfig;
}
```

- [ ] **Step 6: Run model tests**

Run:

```bash
cd backend && go test ./internal/models -v
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

Run:

```bash
git add backend/internal/models/mcp_server.go backend/internal/models/mcp_tool.go backend/internal/models/mcp_server_test.go frontend/lib/types.ts && git commit -m "Model MCP stdio config and discovery status"
```

Expected: commit succeeds.

---

### Task 2: Create Modular Transport Contracts And JSON-RPC Helpers

**Files:**
- Create: `backend/internal/mcp/transport/client.go`
- Create: `backend/internal/mcp/transport/jsonrpc.go`
- Create: `backend/internal/mcp/transport/jsonrpc_test.go`

- [ ] **Step 1: Write JSON-RPC helper tests**

Create `backend/internal/mcp/transport/jsonrpc_test.go`:

```go
package transport

import (
	"encoding/json"
	"testing"
)

func TestInitializeRequestUsesCurrentProtocolVersion(t *testing.T) {
	req := InitializeRequest(7)
	encoded, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal initialize request: %v", err)
	}

	var decoded map[string]interface{}
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("failed to decode initialize request: %v", err)
	}

	if decoded["jsonrpc"] != "2.0" {
		t.Fatalf("expected JSON-RPC 2.0, got %#v", decoded["jsonrpc"])
	}
	if decoded["method"] != "initialize" {
		t.Fatalf("expected initialize method, got %#v", decoded["method"])
	}
	params := decoded["params"].(map[string]interface{})
	if params["protocolVersion"] != DefaultProtocolVersion {
		t.Fatalf("expected protocol %s, got %#v", DefaultProtocolVersion, params["protocolVersion"])
	}
}

func TestInitializedNotificationHasNoID(t *testing.T) {
	notification := InitializedNotification()
	encoded, err := json.Marshal(notification)
	if err != nil {
		t.Fatalf("failed to marshal notification: %v", err)
	}

	var decoded map[string]interface{}
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("failed to decode notification: %v", err)
	}
	if decoded["method"] != "notifications/initialized" {
		t.Fatalf("expected initialized notification, got %#v", decoded["method"])
	}
	if _, exists := decoded["id"]; exists {
		t.Fatalf("initialized notification must not include id: %s", string(encoded))
	}
}
```

- [ ] **Step 2: Run helper tests to verify they fail**

Run:

```bash
cd backend && go test ./internal/mcp/transport -run 'TestInitializeRequest|TestInitializedNotification' -v
```

Expected: FAIL because package `transport` and helper functions do not exist.

- [ ] **Step 3: Add transport interface**

Create `backend/internal/mcp/transport/client.go`:

```go
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
```

- [ ] **Step 4: Add JSON-RPC helper implementation**

Create `backend/internal/mcp/transport/jsonrpc.go`:

```go
package transport

import "encoding/json"

const DefaultProtocolVersion = "2025-06-18"

type JSONRPCRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id,omitempty"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

type JSONRPCNotification struct {
	JSONRPC string      `json:"jsonrpc"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *JSONRPCError   `json:"error,omitempty"`
}

type JSONRPCError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func InitializeRequest(id int) JSONRPCRequest {
	return JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      id,
		Method:  "initialize",
		Params: map[string]interface{}{
			"protocolVersion": DefaultProtocolVersion,
			"capabilities":    map[string]interface{}{},
			"clientInfo": map[string]interface{}{
				"name":    "AgenticPlatform",
				"version": "1.0.0",
			},
		},
	}
}

func InitializedNotification() JSONRPCNotification {
	return JSONRPCNotification{
		JSONRPC: "2.0",
		Method:  "notifications/initialized",
	}
}

func ToolsListRequest(id int) JSONRPCRequest {
	return JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      id,
		Method:  "tools/list",
		Params:  map[string]interface{}{},
	}
}

func ToolsCallRequest(id int, name string, args map[string]interface{}) JSONRPCRequest {
	return JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      id,
		Method:  "tools/call",
		Params: map[string]interface{}{
			"name":      name,
			"arguments": args,
		},
	}
}
```

- [ ] **Step 5: Run transport helper tests**

Run:

```bash
cd backend && go test ./internal/mcp/transport -run 'TestInitializeRequest|TestInitializedNotification' -v
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add backend/internal/mcp/transport/client.go backend/internal/mcp/transport/jsonrpc.go backend/internal/mcp/transport/jsonrpc_test.go && git commit -m "Add MCP transport contracts"
```

Expected: commit succeeds.

---

### Task 3: Implement Isolated Stdio NPX Transport

**Files:**
- Create: `backend/internal/mcp/transport/stdio_client.go`
- Create: `backend/internal/mcp/transport/stdio_client_test.go`

- [ ] **Step 1: Write stdio transport tests**

Create `backend/internal/mcp/transport/stdio_client_test.go`:

```go
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
```

- [ ] **Step 2: Run stdio tests to verify they fail**

Run:

```bash
cd backend && go test ./internal/mcp/transport -run 'TestStdioClient' -v
```

Expected: FAIL to compile because `StdioConfig` and `NewStdioClient` do not exist.

- [ ] **Step 3: Implement isolated stdio transport**

Create `backend/internal/mcp/transport/stdio_client.go`:

```go
package transport

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/models"
)

type StdioConfig struct {
	Command          string
	Args             []string
	WorkingDirectory string
	ToolName         string
	Schema           json.RawMessage
	AuthConfig       models.AuthConfig
}

type StdioClient struct {
	config StdioConfig
}

type stdioSession struct {
	cmd       *exec.Cmd
	stdin     io.WriteCloser
	stdout    *bufio.Reader
	stderr    *boundedBuffer
	encoder   *json.Encoder
	nextID    int
	closeOnce sync.Once
}

type boundedBuffer struct {
	mu    sync.Mutex
	limit int
	data  []byte
}

func NewStdioClient(config StdioConfig) *StdioClient {
	return &StdioClient{config: config}
}

func newBoundedBuffer(limit int) *boundedBuffer {
	return &boundedBuffer{limit: limit}
}

func (b *boundedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.data = append(b.data, p...)
	if len(b.data) > b.limit {
		b.data = b.data[len(b.data)-b.limit:]
	}
	return len(p), nil
}

func (b *boundedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return strings.TrimSpace(string(b.data))
}

func (c *StdioClient) prepareEnv() []string {
	env := os.Environ()
	for k, v := range c.config.AuthConfig.EnvVars {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}
	return env
}

func (c *StdioClient) startSession(ctx context.Context) (*stdioSession, error) {
	if c.config.Command == "" {
		return nil, fmt.Errorf("stdio MCP command is required")
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, c.config.Command, c.config.Args...)
	cmd.Env = c.prepareEnv()
	if c.config.WorkingDirectory != "" {
		cmd.Dir = c.config.WorkingDirectory
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to open MCP stdio stdin: %w", err)
	}
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		_ = stdin.Close()
		return nil, fmt.Errorf("failed to open MCP stdio stdout: %w", err)
	}
	stderr := newBoundedBuffer(8192)
	cmd.Stderr = stderr

	if err := cmd.Start(); err != nil {
		_ = stdin.Close()
		return nil, fmt.Errorf("failed to start MCP stdio command %q: %w", c.config.Command, err)
	}

	session := &stdioSession{
		cmd:     cmd,
		stdin:   stdin,
		stdout:  bufio.NewReader(stdoutPipe),
		stderr:  stderr,
		encoder: json.NewEncoder(stdin),
		nextID:  1,
	}

	if err := session.initialize(ctx); err != nil {
		_ = session.Close()
		if stderrText := stderr.String(); stderrText != "" {
			return nil, fmt.Errorf("%w; stderr: %s", err, stderrText)
		}
		return nil, err
	}

	return session, nil
}

func (s *stdioSession) initialize(ctx context.Context) error {
	if _, err := s.request(ctx, InitializeRequest(s.next())); err != nil {
		return fmt.Errorf("MCP stdio initialize failed: %w", err)
	}
	if err := s.encoder.Encode(InitializedNotification()); err != nil {
		return fmt.Errorf("failed to send MCP initialized notification: %w", err)
	}
	return nil
}

func (s *stdioSession) next() int {
	id := s.nextID
	s.nextID++
	return id
}

func (s *stdioSession) request(ctx context.Context, req JSONRPCRequest) (json.RawMessage, error) {
	if err := s.encoder.Encode(req); err != nil {
		return nil, err
	}

	responseCh := make(chan JSONRPCResponse, 1)
	errorCh := make(chan error, 1)
	go func() {
		line, err := s.stdout.ReadBytes('\n')
		if err != nil {
			errorCh <- err
			return
		}
		var response JSONRPCResponse
		if err := json.Unmarshal(line, &response); err != nil {
			errorCh <- fmt.Errorf("invalid MCP stdio JSON-RPC response %q: %w", strings.TrimSpace(string(line)), err)
			return
		}
		responseCh <- response
	}()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case err := <-errorCh:
		if stderrText := s.stderr.String(); stderrText != "" {
			return nil, fmt.Errorf("%w; stderr: %s", err, stderrText)
		}
		return nil, err
	case response := <-responseCh:
		if response.Error != nil {
			return nil, fmt.Errorf("MCP JSON-RPC error %d: %s", response.Error.Code, response.Error.Message)
		}
		return response.Result, nil
	}
}

func (s *stdioSession) Close() error {
	var err error
	s.closeOnce.Do(func() {
		_ = s.stdin.Close()
		if s.cmd.Process != nil {
			_ = s.cmd.Process.Kill()
		}
		err = s.cmd.Wait()
	})
	return err
}

func (c *StdioClient) DiscoverTools(ctx context.Context) (models.MCPDiscoveryResult, error) {
	session, err := c.startSession(ctx)
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
	}
	defer session.Close()

	result, err := session.request(ctx, ToolsListRequest(session.next()))
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
	}

	var list struct {
		Tools []struct {
			Name        string          `json:"name"`
			Description string          `json:"description"`
			InputSchema json.RawMessage `json:"inputSchema"`
		} `json:"tools"`
	}
	if err := json.Unmarshal(result, &list); err != nil {
		parseErr := fmt.Errorf("failed to parse MCP tools/list result: %w", err)
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: parseErr.Error(), Tools: []models.DiscoveredTool{}}, parseErr
	}

	discovered := make([]models.DiscoveredTool, 0, len(list.Tools))
	for _, tool := range list.Tools {
		discovered = append(discovered, models.DiscoveredTool{
			Name:        tool.Name,
			Description: tool.Description,
			InputSchema: tool.InputSchema,
			Selected:    true,
		})
	}

	if len(discovered) == 0 {
		return models.MCPDiscoveryResult{
			Status:          models.MCPDiscoveryStatusEmpty,
			Message:         "Connected to MCP stdio server, but it returned no tools.",
			ProtocolVersion: DefaultProtocolVersion,
			Tools:           []models.DiscoveredTool{},
		}, nil
	}

	return models.MCPDiscoveryResult{
		Status:          models.MCPDiscoveryStatusConnected,
		Message:         fmt.Sprintf("Connected to MCP stdio server and discovered %d tools.", len(discovered)),
		ProtocolVersion: DefaultProtocolVersion,
		Tools:           discovered,
	}, nil
}

func (c *StdioClient) ListTools(ctx context.Context) ([]llm.ToolDefinition, error) {
	var inputSchema interface{}
	if len(c.config.Schema) > 0 {
		_ = json.Unmarshal(c.config.Schema, &inputSchema)
	}
	if inputSchema == nil {
		inputSchema = map[string]interface{}{"type": "object", "properties": map[string]interface{}{}}
	}
	return []llm.ToolDefinition{{
		Name:        c.config.ToolName,
		Description: fmt.Sprintf("MCP stdio tool %s via command %s", c.config.ToolName, c.config.Command),
		InputSchema: inputSchema,
	}}, nil
}

func (c *StdioClient) CallTool(ctx context.Context, name string, args map[string]interface{}) (interface{}, error) {
	session, err := c.startSession(ctx)
	if err != nil {
		return nil, err
	}
	defer session.Close()

	result, err := session.request(ctx, ToolsCallRequest(session.next(), name, args))
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"jsonrpc": "2.0",
		"result":  json.RawMessage(result),
	}, nil
}

func (c *StdioClient) Close() error {
	return nil
}
```

- [ ] **Step 4: Run stdio transport tests**

Run:

```bash
cd backend && go test ./internal/mcp/transport -run 'TestStdioClient' -v
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add backend/internal/mcp/transport/stdio_client.go backend/internal/mcp/transport/stdio_client_test.go && git commit -m "Implement isolated MCP stdio transport"
```

Expected: commit succeeds.

---

### Task 4: Wire Stdio Discovery Without Rewriting HTTP Discovery

**Files:**
- Create: `backend/internal/mcp/discovery_test.go`
- Modify: `backend/internal/mcp/discovery.go`
- Modify: `backend/internal/api/mcp_server_handler.go`
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Write discovery routing tests**

Create `backend/internal/mcp/discovery_test.go`:

```go
package mcp

import (
	"context"
	"os"
	"testing"

	"agentic-platform/backend/internal/models"
)

func TestDiscoverServerToolsRoutesStdioToTransportModule(t *testing.T) {
	result, err := DiscoverServerTools(context.Background(), models.DiscoverToolsRequest{
		TransportType: models.TransportStdio,
		AuthType:      models.AuthTypeEnvVars,
		Command:       os.Args[0],
		Args:          []string{"-test.run=TestStdioHelperProcess", "--", "tools"},
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
```

- [ ] **Step 2: Run discovery routing tests to verify they fail**

Run:

```bash
cd backend && go test ./internal/mcp -run 'TestDiscoverServerTools' -v
```

Expected: FAIL because `DiscoverServerTools` still returns `[]models.DiscoveredTool` and does not call the new transport package.

- [ ] **Step 3: Change discovery to return a detailed result**

Modify `backend/internal/mcp/discovery.go` imports to include the new transport package:

```go
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
```

Replace the `DiscoverServerTools` signature and top-level routing with:

```go
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
```

Rename the old HTTP implementation body to keep its behavior intact:

```go
func discoverHTTPServerToolsLegacy(ctx context.Context, req models.DiscoverToolsRequest) ([]models.DiscoveredTool, error) {
	if req.ServerURL == "" {
		return nil, fmt.Errorf("server_url is required for discovery")
	}

	client := &http.Client{Timeout: 15 * time.Second}
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

			if sessionID != "" {
				notifPayload := map[string]interface{}{"jsonrpc": "2.0", "method": "notifications/initialized"}
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

	rpcPayload := map[string]interface{}{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": map[string]interface{}{}}
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
	if jsonErr := json.Unmarshal(bodyBytes, &rpcRes); jsonErr == nil && len(rpcRes.Result.Tools) > 0 {
		return extractDiscoveredTools(rpcRes)
	}
	if strings.Contains(bodyStr, "data:") {
		lines := strings.Split(bodyStr, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "data:") {
				jsonData := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
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
	return []models.DiscoveredTool{}, nil
}
```

Leave deeper HTTP protocol hardening out of this task. The only HTTP change is wrapping the old result in `MCPDiscoveryResult` so the UI can distinguish connected, empty, and error.

- [ ] **Step 4: Update API handler for structured discovery result**

Modify `backend/internal/api/mcp_server_handler.go` in `DiscoverTools`:

```go
result, err := mcp.DiscoverServerTools(c.Request.Context(), req)
if err != nil {
	c.JSON(http.StatusBadGateway, result)
	return
}
c.JSON(http.StatusOK, result)
```

Modify `CallbackOAuth` to adapt to the new result:

```go
result, discErr := mcp.DiscoverServerTools(c.Request.Context(), discReq)
if discErr != nil {
	result = models.MCPDiscoveryResult{
		Status:  models.MCPDiscoveryStatusError,
		Message: discErr.Error(),
		Tools:   []models.DiscoveredTool{},
	}
}

c.JSON(http.StatusOK, gin.H{
	"status":    "authenticated",
	"tokens":    tokens,
	"tools":     result.Tools,
	"discovery": result,
})
```

- [ ] **Step 5: Update frontend API type**

Modify `frontend/lib/api.ts` import list:

```ts
import { Agent, Skill, MCPTool, MCPServer, Workflow, ExecutionSession, SessionLog, DiscoverToolsRequest, DiscoveredTool, OAuthInitRequest, OAuthInitResponse, OAuthCallbackRequest, OAuthTokens, MCPDiscoveryResult } from './types';
```

Change `discoverMCPTools`:

```ts
discoverMCPTools: (data: DiscoverToolsRequest) =>
  fetchJSON<MCPDiscoveryResult>('/mcp/servers/discover', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
```

- [ ] **Step 6: Run discovery tests**

Run:

```bash
cd backend && go test ./internal/mcp ./internal/mcp/transport -run 'TestDiscoverServerTools|TestStdioClient' -v
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git add backend/internal/mcp/discovery.go backend/internal/mcp/discovery_test.go backend/internal/api/mcp_server_handler.go frontend/lib/api.ts && git commit -m "Route stdio MCP discovery through transport module"
```

Expected: commit succeeds.

---

### Task 5: Persist Stdio Config And Connection State

**Files:**
- Create: `backend/migrations/008_add_mcp_stdio_config_and_connection_state.sql`
- Modify: `backend/internal/repository/mcp_server_repository.go`
- Modify: `backend/internal/repository/mcp_tool_repository.go`

- [ ] **Step 1: Add database migration**

Create `backend/migrations/008_add_mcp_stdio_config_and_connection_state.sql`:

```sql
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS command TEXT DEFAULT '';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS args JSONB DEFAULT '[]';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS working_directory TEXT DEFAULT '';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS last_connection_status TEXT DEFAULT '';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS last_connection_error TEXT DEFAULT '';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS last_discovered_at TIMESTAMPTZ;

UPDATE mcp_servers
SET command = server_url
WHERE transport_type = 'stdio'
  AND COALESCE(command, '') = ''
  AND COALESCE(server_url, '') <> '';

UPDATE mcp_servers
SET status = 'REGISTERED'
WHERE status = 'ACTIVE';

ALTER TABLE mcp_tools ADD COLUMN IF NOT EXISTS command TEXT DEFAULT '';
ALTER TABLE mcp_tools ADD COLUMN IF NOT EXISTS args JSONB DEFAULT '[]';
ALTER TABLE mcp_tools ADD COLUMN IF NOT EXISTS working_directory TEXT DEFAULT '';

UPDATE mcp_tools
SET command = server_url
WHERE transport_type = 'stdio'
  AND COALESCE(command, '') = ''
  AND COALESCE(server_url, '') <> '';
```

- [ ] **Step 2: Update server create insert values**

Modify `backend/internal/repository/mcp_server_repository.go` in `Create` before the insert query:

```go
argsBytes, err := json.Marshal(req.Args)
if err != nil {
	argsBytes = []byte("[]")
}

serverURL := req.ServerURL
if transport == models.TransportStdio && serverURL == "" {
	serverURL = req.Command
}

status := models.MCPConnectionStatusRegistered
lastConnectionStatus := "registered"
lastConnectionError := ""
if len(req.ImportTools) > 0 {
	status = models.MCPConnectionStatusConnected
	lastConnectionStatus = "connected"
}
hasImportedTools := len(req.ImportTools) > 0
```

Use this insert query:

```go
query := `
  INSERT INTO mcp_servers (
    id, name, description, server_url, command, args, working_directory,
    transport_type, auth_type, auth_config, oauth_client_id, oauth_client_secret,
    oauth_scopes, oauth_tokens, status, last_connection_status, last_connection_error,
    last_discovered_at, created_at, updated_at
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CASE WHEN $18 THEN $19 ELSE NULL END, $20, $21)
  RETURNING id, name, description, server_url, command, args, working_directory, transport_type, auth_type, auth_config, COALESCE(oauth_client_id, ''), COALESCE(oauth_client_secret, ''), COALESCE(oauth_scopes, ''), oauth_tokens, status, COALESCE(last_connection_status, ''), COALESCE(last_connection_error, ''), last_discovered_at, created_at, updated_at
`
```

Use this `QueryRow` argument list and scan:

```go
var s models.MCPServer
var rawAuth, rawOAuthTokens, rawArgs []byte
err = r.pool.QueryRow(ctx, query,
	serverID, req.Name, req.Description, serverURL, req.Command, argsBytes, req.WorkingDirectory,
	transport, authType, authBytes, req.OAuthClientID, req.OAuthClientSecret, req.OAuthScopes,
	oauthTokensBytes, status, lastConnectionStatus, lastConnectionError, hasImportedTools, now, now, now,
).Scan(
	&s.ID, &s.Name, &s.Description, &s.ServerURL, &s.Command, &rawArgs, &s.WorkingDirectory,
	&s.TransportType, &s.AuthType, &rawAuth, &s.OAuthClientID, &s.OAuthClientSecret,
	&s.OAuthScopes, &rawOAuthTokens, &s.Status, &s.LastConnectionStatus,
	&s.LastConnectionError, &s.LastDiscoveredAt, &s.CreatedAt, &s.UpdatedAt,
)
```

After the scan, unmarshal args:

```go
_ = json.Unmarshal(rawArgs, &s.Args)
```

- [ ] **Step 3: Update tool import query**

In the imported tools loop in `mcp_server_repository.go`, replace the insert query with:

```go
toolArgsBytes, _ := json.Marshal(s.Args)
tQuery := `
  INSERT INTO mcp_tools (id, server_id, name, description, server_url, command, args, working_directory, transport_type, input_schema, created_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  ON CONFLICT DO NOTHING
`
desc := tool.Description
if desc == "" {
	desc = fmt.Sprintf("Tool %s from server %s", tool.Name, s.Name)
}
if _, execErr := r.pool.Exec(ctx, tQuery, tID, s.ID, tool.Name, desc, s.ServerURL, s.Command, toolArgsBytes, s.WorkingDirectory, s.TransportType, tool.InputSchema, now); execErr != nil {
	log.Printf("Warning: Tool insertion skipped or failed: %v", execErr)
}
```

- [ ] **Step 4: Update server select scanning**

Use this SELECT list in `GetByID` and `List`:

```sql
SELECT id, name, COALESCE(description, ''), server_url, COALESCE(command, ''), COALESCE(args, '[]'), COALESCE(working_directory, ''), transport_type, auth_type, auth_config, COALESCE(oauth_client_id, ''), COALESCE(oauth_client_secret, ''), COALESCE(oauth_scopes, ''), oauth_tokens, status, COALESCE(last_connection_status, ''), COALESCE(last_connection_error, ''), last_discovered_at, created_at, updated_at FROM mcp_servers
```

For each server row scan, use:

```go
var rawAuth, rawOAuthTokens, rawArgs []byte
err := row.Scan(
	&s.ID, &s.Name, &s.Description, &s.ServerURL, &s.Command, &rawArgs, &s.WorkingDirectory,
	&s.TransportType, &s.AuthType, &rawAuth, &s.OAuthClientID, &s.OAuthClientSecret,
	&s.OAuthScopes, &rawOAuthTokens, &s.Status, &s.LastConnectionStatus,
	&s.LastConnectionError, &s.LastDiscoveredAt, &s.CreatedAt, &s.UpdatedAt,
)
_ = json.Unmarshal(rawArgs, &s.Args)
_ = json.Unmarshal(rawAuth, &s.AuthConfig)
```

Keep the existing OAuth token unmarshal block after this scan.

- [ ] **Step 5: Update tool repository create and list scans**

Modify `backend/internal/repository/mcp_tool_repository.go` imports:

```go
import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"agentic-platform/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)
```

In `Create`, add:

```go
argsBytes, err := json.Marshal(req.Args)
if err != nil {
	argsBytes = []byte("[]")
}

serverURL := req.ServerURL
if transport == models.TransportStdio && serverURL == "" {
	serverURL = req.Command
}
```

Use this insert:

```go
query := `
  INSERT INTO mcp_tools (id, server_id, name, description, server_url, command, args, working_directory, transport_type, input_schema, created_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  RETURNING id, server_id, name, description, server_url, command, args, working_directory, transport_type, input_schema, created_at
`
var t models.MCPTool
var rawArgs []byte
err = r.pool.QueryRow(ctx, query, toolID, serverID, req.Name, req.Description, serverURL, req.Command, argsBytes, req.WorkingDirectory, transport, req.InputSchema, now).Scan(
	&t.ID, &t.ServerID, &t.Name, &t.Description, &t.ServerURL, &t.Command, &rawArgs, &t.WorkingDirectory, &t.TransportType, &t.InputSchema, &t.CreatedAt,
)
_ = json.Unmarshal(rawArgs, &t.Args)
```

Use this SELECT list in `GetByID` and `List`:

```sql
SELECT id, server_id, name, description, server_url, COALESCE(command, ''), COALESCE(args, '[]'), COALESCE(working_directory, ''), transport_type, input_schema, created_at FROM mcp_tools
```

Scan each row with:

```go
var rawArgs []byte
if err := rows.Scan(&t.ID, &t.ServerID, &t.Name, &t.Description, &t.ServerURL, &t.Command, &rawArgs, &t.WorkingDirectory, &t.TransportType, &t.InputSchema, &t.CreatedAt); err == nil {
	_ = json.Unmarshal(rawArgs, &t.Args)
	tools = append(tools, t)
}
```

- [ ] **Step 6: Run backend compile checks**

Run:

```bash
cd backend && go test ./internal/models ./internal/mcp ./internal/mcp/transport -v
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

Run:

```bash
git add backend/migrations/008_add_mcp_stdio_config_and_connection_state.sql backend/internal/repository/mcp_server_repository.go backend/internal/repository/mcp_tool_repository.go && git commit -m "Persist MCP stdio configuration"
```

Expected: commit succeeds.

---

### Task 6: Wire Runtime Tool Execution Through Stdio Module

**Files:**
- Modify: `backend/internal/mcp/registry.go`
- Keep unchanged: `backend/internal/mcp/sse_client.go`

- [ ] **Step 1: Update registry imports**

Modify `backend/internal/mcp/registry.go` imports:

```go
import (
	"context"
	"fmt"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/mcp/transport"
	"agentic-platform/backend/internal/models"
)
```

- [ ] **Step 2: Use stdio module only for stdio tools**

Replace the stdio branch in `RegisterTool`:

```go
if tool.TransportType == models.TransportStdio {
	command := tool.Command
	args := tool.Args
	workingDirectory := tool.WorkingDirectory
	if command == "" && tool.Server != nil {
		command = tool.Server.Command
		args = tool.Server.Args
		workingDirectory = tool.Server.WorkingDirectory
	}
	if command == "" {
		command = tool.ServerURL
	}
	client = transport.NewStdioClient(transport.StdioConfig{
		Command:          command,
		Args:             args,
		WorkingDirectory: workingDirectory,
		ToolName:         tool.Name,
		Schema:           tool.InputSchema,
		AuthConfig:       authConfig,
	})
} else {
	client = NewSSEMCPClient(tool.ServerURL, tool.Name, tool.InputSchema, authType, authConfig)
}
```

No changes are made to `backend/internal/mcp/sse_client.go` in this task.

- [ ] **Step 3: Return a real error for unregistered tool calls**

Replace the fallback in `ExecuteTool`:

```go
return nil, fmt.Errorf("MCP tool %q is not registered in the runtime registry", toolName)
```

- [ ] **Step 4: Run registry compile check**

Run:

```bash
cd backend && go test ./internal/mcp ./internal/mcp/transport -v
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

Run:

```bash
git add backend/internal/mcp/registry.go && git commit -m "Execute stdio MCP tools through transport module"
```

Expected: commit succeeds.

---

### Task 7: Update MCP Registration UI For Modular Stdio Configuration

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/components/mcp/MCPServerForm.tsx`
- Modify: `frontend/components/mcp/MCPServerCard.tsx`
- Modify: `frontend/app/(dashboard)/mcp-tools/page.tsx`

- [ ] **Step 1: Update create server API payload type**

Modify `frontend/lib/api.ts` `createMCPServer` parameter type:

```ts
createMCPServer: (data: {
  name: string;
  description?: string;
  server_url: string;
  command?: string;
  args?: string[];
  working_directory?: string;
  transport_type: string;
  auth_type: string;
  auth_config: any;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_scopes?: string;
  import_tools?: DiscoveredTool[];
}) => fetchJSON<{ message?: string; server?: MCPServer } | MCPServer>('/mcp/servers', { method: 'POST', body: JSON.stringify(data) }),
```

- [ ] **Step 2: Add stdio form state and helpers**

Modify `frontend/components/mcp/MCPServerForm.tsx` near the existing connection state:

```tsx
const [command, setCommand] = useState('');
const [argsText, setArgsText] = useState('');
const [workingDirectory, setWorkingDirectory] = useState('');
const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
const [discoveryWarning, setDiscoveryWarning] = useState<string | null>(null);
```

Add helpers above `handleDiscover`:

```tsx
const getStdioArgs = () =>
  argsText
    .split('\n')
    .map((arg) => arg.trim())
    .filter(Boolean);

const getConnectionTarget = () => {
  if (transportType === 'stdio') {
    return command.trim();
  }
  return serverUrl.trim();
};
```

- [ ] **Step 3: Replace stdio URL-shaped input with command and args fields**

Replace the endpoint/command input block in `MCPServerForm.tsx` with:

```tsx
{transportType === 'sse' ? (
  <div>
    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
      Server MCP Endpoint URL
    </label>
    <input
      type="url"
      required
      placeholder="https://mcp.example.com/mcp"
      value={serverUrl}
      onChange={(e) => setServerUrl(e.target.value)}
      className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
    />
  </div>
) : (
  <div className="space-y-4">
    <div>
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
        Command
      </label>
      <input
        type="text"
        required
        placeholder="npx"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
      />
    </div>
    <div>
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
        Arguments, one per line
      </label>
      <textarea
        rows={5}
        placeholder={'-y\n@modelcontextprotocol/server-filesystem\n/mnt/agentic-app'}
        value={argsText}
        onChange={(e) => setArgsText(e.target.value)}
        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
      />
    </div>
    <div>
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
        Working Directory
      </label>
      <input
        type="text"
        placeholder="/mnt/agentic-app"
        value={workingDirectory}
        onChange={(e) => setWorkingDirectory(e.target.value)}
        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
      />
    </div>
  </div>
)}
```

- [ ] **Step 4: Update discovery request handling**

Replace the start of `handleDiscover`:

```tsx
if (!getConnectionTarget()) {
  setError(transportType === 'stdio' ? 'Please enter the stdio command, for example npx.' : 'Please enter the MCP endpoint URL.');
  return;
}

setDiscovering(true);
setError(null);
setDiscoveryMessage(null);
setDiscoveryWarning(null);
setDiscoverySuccess(false);
```

Replace the discovery API call block:

```tsx
const res = await api.discoverMCPTools({
  server_url: transportType === 'sse' ? serverUrl : '',
  command: transportType === 'stdio' ? command.trim() : undefined,
  args: transportType === 'stdio' ? getStdioArgs() : undefined,
  working_directory: transportType === 'stdio' ? workingDirectory.trim() : undefined,
  transport_type: transportType,
  auth_type: authType,
  auth_config: buildAuthConfig(),
});

setDiscoveredTools(res.tools || []);
setDiscoveryMessage(res.message);
if (res.status === 'connected') {
  setDiscoverySuccess(true);
} else if (res.status === 'empty') {
  setDiscoveryWarning(res.message || 'Connected, but this MCP server returned no tools.');
} else {
  setError(res.message || 'Connection or discovery failed.');
}
```

Replace the catch block:

```tsx
setError(getErrorMessage(err, 'Connection or discovery failed. Check command, endpoint, auth credentials, and server logs.'));
setDiscoverySuccess(false);
```

- [ ] **Step 5: Update submit payload**

Replace the `api.createMCPServer` payload in `handleSubmit`:

```tsx
await api.createMCPServer({
  name,
  description,
  server_url: transportType === 'sse' ? serverUrl : '',
  command: transportType === 'stdio' ? command.trim() : undefined,
  args: transportType === 'stdio' ? getStdioArgs() : undefined,
  working_directory: transportType === 'stdio' ? workingDirectory.trim() : undefined,
  transport_type: transportType,
  auth_type: authType,
  auth_config: buildAuthConfig(),
  oauth_client_id: oauthClientId,
  oauth_client_secret: oauthClientSecret,
  oauth_scopes: oauthScopes,
  import_tools: selectedTools,
});
```

- [ ] **Step 6: Render empty discovery separately from success**

Below the success message block in `MCPServerForm.tsx`, add:

```tsx
{discoveryWarning && (
  <div className="p-3 bg-amber-950/50 border border-amber-800 rounded-lg text-amber-300 text-xs flex items-center space-x-2">
    <AlertCircle className="w-4 h-4 flex-shrink-0" />
    <span>{discoveryWarning}</span>
  </div>
)}

{discoveryMessage && !discoverySuccess && !discoveryWarning && (
  <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 text-xs">
    {discoveryMessage}
  </div>
)}
```

- [ ] **Step 7: Show real status on server cards**

Modify `frontend/components/mcp/MCPServerCard.tsx`:

```tsx
const getStatusBadge = () => {
  if (server.status === 'CONNECTED') {
    return <Badge variant="worker">CONNECTED</Badge>;
  }
  if (server.status === 'ERROR') {
    return <Badge variant="danger">ERROR</Badge>;
  }
  return <Badge variant="default">REGISTERED</Badge>;
};
```

Add `{getStatusBadge()}` next to the transport/auth badges.

Replace endpoint display:

```tsx
<div className="bg-[#090d16] p-2.5 rounded-lg border border-[#1e293b] text-xs font-mono text-slate-300 truncate mb-3">
  <span className="text-slate-500 mr-2">{server.transport_type === 'stdio' ? 'Command:' : 'Endpoint:'}</span>
  {server.transport_type === 'stdio' ? [server.command, ...(server.args || [])].filter(Boolean).join(' ') : server.server_url}
</div>
```

Show connection error when present:

```tsx
{server.last_connection_error && (
  <div className="mb-3 rounded-lg border border-red-900 bg-red-950/30 p-2 text-[11px] text-red-300">
    {server.last_connection_error}
  </div>
)}
```

Replace footer text:

```tsx
<span>
  {server.last_discovered_at ? `Discovered: ${new Date(server.last_discovered_at).toLocaleDateString()}` : `Registered: ${new Date(server.created_at).toLocaleDateString()}`}
</span>
```

- [ ] **Step 8: Update MCP tools page copy**

Modify `frontend/app/(dashboard)/mcp-tools/page.tsx` empty-state description:

```tsx
description="Connect to Streamable HTTP endpoints or local stdio commands such as npx with args and environment variables."
```

- [ ] **Step 9: Run frontend lint**

Run:

```bash
cd frontend && npm run lint
```

Expected: PASS.

- [ ] **Step 10: Commit Task 7**

Run:

```bash
git add frontend/lib/api.ts frontend/components/mcp/MCPServerForm.tsx frontend/components/mcp/MCPServerCard.tsx frontend/app/\(dashboard\)/mcp-tools/page.tsx && git commit -m "Add modular stdio MCP registration UI"
```

Expected: commit succeeds.

---

### Task 8: Document Connection Behavior And Validation

**Files:**
- Create: `docs/mcp-connection-behavior.md`

- [ ] **Step 1: Create documentation**

Create `docs/mcp-connection-behavior.md`:

```markdown
# MCP Connection Behavior

This application supports two MCP transport styles.

## Local stdio servers

Local MCP servers launched with `npx`, `node`, `uvx`, or another executable use MCP stdio transport.

The application stores these fields separately:

- `command`: executable name or absolute path, for example `npx`
- `args`: process arguments, for example `-y`, `@modelcontextprotocol/server-filesystem`, `/mnt/agentic-app`
- `auth_config.env_vars`: environment variables passed to the subprocess
- `working_directory`: optional process working directory

The backend launches the subprocess and exchanges newline-delimited JSON-RPC over stdin/stdout:

1. `initialize`
2. `notifications/initialized`
3. `tools/list`
4. `tools/call` during workflow execution

The server may write logs to stderr. The backend includes recent stderr text in connection errors so users can diagnose missing environment variables, bad paths, missing npm packages, and permission issues.

Example stdio registration:

```text
Command: npx
Arguments:
-y
@modelcontextprotocol/server-filesystem
/mnt/agentic-app
```

Equivalent MCP Inspector check:

```bash
npx @modelcontextprotocol/inspector --cli npx -y @modelcontextprotocol/server-filesystem /mnt/agentic-app --method tools/list
```

## Streamable HTTP or HTTPS servers

Remote MCP servers use a single MCP endpoint URL, for example `https://mcp.example.com/mcp`.

The current HTTP path remains separate from the stdio module. It continues to use the existing HTTP/SSE client behavior for OAuth, bearer token, API key, and custom header authentication.

Equivalent MCP Inspector check:

```bash
npx @modelcontextprotocol/inspector --cli --server-url https://mcp.example.com/mcp --transport http --method tools/list
```

## Connection states

- `REGISTERED`: configuration was saved, but no successful tool discovery has been imported yet
- `CONNECTED`: discovery succeeded and imported at least one tool
- `ERROR`: the last connection or discovery attempt failed

Discovery can also return `empty`, meaning the MCP handshake succeeded but `tools/list` returned no tools.
```

- [ ] **Step 2: Commit Task 8**

Run:

```bash
git add docs/mcp-connection-behavior.md && git commit -m "Document modular MCP connection behavior"
```

Expected: commit succeeds.

---

### Task 9: Full Verification

**Files:**
- No code changes.

- [ ] **Step 1: Run backend transport tests**

Run:

```bash
cd backend && go test ./internal/mcp/transport -v
```

Expected: PASS.

- [ ] **Step 2: Run backend MCP and model tests**

Run:

```bash
cd backend && go test ./internal/models ./internal/mcp ./internal/mcp/transport -v
```

Expected: PASS.

- [ ] **Step 3: Run all backend tests**

Run:

```bash
cd backend && go test ./... -v
```

Expected: PASS. If local database configuration prevents repository integration tests from running, capture the exact database error and keep the passing package-level results from Step 2 as the required non-database verification.

- [ ] **Step 4: Run frontend lint**

Run:

```bash
cd frontend && npm run lint
```

Expected: PASS.

- [ ] **Step 5: Verify stdio discovery manually with MCP Inspector**

Run:

```bash
npx @modelcontextprotocol/inspector --cli npx -y @modelcontextprotocol/server-filesystem /mnt/agentic-app --method tools/list
```

Expected: Inspector prints a `tools/list` result containing filesystem tools.

- [ ] **Step 6: Verify stdio discovery in the app**

Use this registration:

```text
Transport: Stdio Subprocess Command Transport
Command: npx
Arguments:
-y
@modelcontextprotocol/server-filesystem
/mnt/agentic-app
Authentication Method: No Authentication or Process Environment Variables
```

Expected: UI displays connected discovery, discovered tools appear, and the saved MCP server card shows the command and imported tool count.

- [ ] **Step 7: Verify stdio failure state in the app**

Use this registration:

```text
Transport: Stdio Subprocess Command Transport
Command: npx
Arguments:
-y
@modelcontextprotocol/server-filesystem
/path/that/does/not/exist
```

Expected: discovery fails with a visible error. The UI does not display the success message.

- [ ] **Step 8: Verify existing HTTPS path still works**

Register a previously working HTTPS/SSE MCP server using the same URL and auth method that worked before this feature.

Expected: OAuth/Bearer/Header discovery behavior is unchanged except that the UI now displays structured status text.

- [ ] **Step 9: Check final worktree state**

Run:

```bash
git status --short
```

Expected: no uncommitted implementation changes remain after task commits.

---

## Deferred Follow-Up: HTTP/SSE Hardening

The modular stdio implementation should ship before changing the working HTTPS/SSE code path. After stdio is verified, create a separate plan for HTTP/SSE hardening if needed. That follow-up can cover protocol-version negotiation, Streamable HTTP `MCP-Protocol-Version` headers, legacy HTTP+SSE fallback, and stricter error propagation in `SSEMCPClient`.

---

## Self-Review

**Spec coverage:**
- NPX/local stdio server connection: Tasks 1, 2, 3, 4, 5, 6, 7, and 9.
- Modular transport approach: Tasks 2, 3, 4, and 6.
- Preserve existing HTTPS/SSE behavior: Tasks 4, 6, and 9 explicitly avoid rewriting `SSEMCPClient`.
- Environment-variable authentication for stdio: Tasks 1, 3, 7, and 9.
- Truthful connection feedback: Tasks 1, 4, 5, and 7.
- Documentation and manual MCP Inspector validation: Tasks 8 and 9.

**Placeholder scan:**
- No task uses forbidden placeholder phrases, vague validation, or undefined implementation references.

**Type consistency:**
- Backend and frontend use `command`, `args`, and `working_directory` for stdio config.
- Backend and frontend use `REGISTERED`, `CONNECTED`, and `ERROR` for persisted connection status.
- Backend and frontend use `connected`, `empty`, and `error` for discovery result status.# MCP Stdio NPX Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build standards-aligned MCP server connection support for local NPX/stdio servers and remote Streamable HTTP/SSE servers, with real discovery, real tool execution, and truthful connection status in the UI.

**Architecture:** Treat MCP stdio and HTTP as two real transports, not as saved metadata. Stdio launches a configured subprocess (`command` + `args` + `env`) and exchanges newline-delimited JSON-RPC over stdin/stdout; HTTP sends JSON-RPC POST requests to the MCP endpoint with negotiated session/protocol headers and legacy SSE fallback where needed. Discovery and runtime tool calls return real protocol errors, and the server registry stores connection health separately from simple registration.

**Tech Stack:** Go 1.25 backend, Gin HTTP API, PostgreSQL migrations, Next.js 16 + React 19 frontend, TypeScript, MCP JSON-RPC lifecycle (`initialize`, `notifications/initialized`, `tools/list`, `tools/call`).

---

## File Structure

**Backend MCP protocol and transports**
- Modify: `backend/internal/models/mcp_server.go`
  - Add stdio command fields (`command`, `args`, `working_directory`) and discovery status response types.
- Modify: `backend/internal/models/mcp_tool.go`
  - Store stdio command fields on imported tool rows so runtime execution does not depend on a URL-shaped field.
- Create: `backend/migrations/008_add_mcp_connection_state_and_stdio_config.sql`
  - Add command/args/working-directory columns plus connection status fields.
- Create: `backend/internal/mcp/jsonrpc.go`
  - Define small JSON-RPC request/response helpers shared by stdio and HTTP discovery.
- Replace/modify: `backend/internal/mcp/stdio_client.go`
  - Implement actual subprocess launch, initialize, tools/list, tools/call, stderr capture, timeouts, and close.
- Modify: `backend/internal/mcp/discovery.go`
  - Route stdio discovery through the real stdio client; improve HTTP discovery metadata and errors.
- Modify: `backend/internal/mcp/sse_client.go`
  - Stop fabricating success on connection failure; consistently negotiate protocol/session state.
- Modify: `backend/internal/mcp/registry.go`
  - Register stdio tools with command/args/env; return errors for unknown tools.
- Modify: `backend/internal/repository/mcp_server_repository.go`
  - Persist stdio config and real connection state.
- Modify: `backend/internal/repository/mcp_tool_repository.go`
  - Persist and load stdio config on tools.
- Modify: `backend/internal/api/mcp_server_handler.go`
  - Return truthful discovery result payloads and update server status after create/import.

**Backend tests**
- Create: `backend/internal/models/mcp_server_test.go`
  - Verify JSON request decoding for stdio command/args/status fields.
- Create: `backend/internal/mcp/stdio_client_test.go`
  - Verify stdio initialize, initialized notification, tools/list, tools/call, env vars, stderr errors, and startup failure.
- Modify: `backend/internal/mcp/sse_client_test.go`
  - Add negative tests for initialize/tool-call failures.
- Create: `backend/internal/mcp/discovery_test.go`
  - Verify discovery returns `connected`, `empty`, or errors correctly for both transports.

**Frontend**
- Modify: `frontend/lib/types.ts`
  - Add command/args/working-directory fields and connection status types.
- Modify: `frontend/lib/api.ts`
  - Type discovery response with status/message/protocol/tools.
- Modify: `frontend/components/mcp/MCPServerForm.tsx`
  - Replace single stdio command text box with command + args fields; display empty-tool and error states separately.
- Modify: `frontend/components/mcp/MCPServerCard.tsx`
  - Show real connection health, last error, discovered-at timestamp, and tool count.
- Modify: `frontend/app/(dashboard)/mcp-tools/page.tsx`
  - Copy should say local stdio commands use command/args/env rather than URL.

**Documentation**
- Create: `docs/mcp-connection-behavior.md`
  - Explain how this app connects to NPX/stdio and HTTP MCP servers and how to validate with MCP Inspector.

---

### Task 1: Model Stdio Config And Connection State

**Files:**
- Create: `backend/internal/models/mcp_server_test.go`
- Modify: `backend/internal/models/mcp_server.go`
- Modify: `backend/internal/models/mcp_tool.go`
- Create: `backend/migrations/008_add_mcp_connection_state_and_stdio_config.sql`
- Modify: `frontend/lib/types.ts`

- [ ] **Step 1: Write the failing backend model test**

Create `backend/internal/models/mcp_server_test.go`:

```go
package models

import (
	"encoding/json"
	"testing"
)

func TestDiscoverToolsRequestDecodesStdioCommandConfig(t *testing.T) {
	payload := []byte(`{
		"server_url":"",
		"transport_type":"stdio",
		"auth_type":"env_vars",
		"command":"npx",
		"args":["-y","@modelcontextprotocol/server-filesystem","/tmp"],
		"working_directory":"/tmp",
		"auth_config":{"env_vars":{"MCP_TEST_TOKEN":"secret"}}
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
	if len(req.Args) != 3 || req.Args[1] != "@modelcontextprotocol/server-filesystem" {
		t.Fatalf("expected stdio args to decode, got %#v", req.Args)
	}
	if req.WorkingDirectory != "/tmp" {
		t.Fatalf("expected working directory /tmp, got %q", req.WorkingDirectory)
	}
	if req.AuthConfig.EnvVars["MCP_TEST_TOKEN"] != "secret" {
		t.Fatalf("expected env var to decode, got %#v", req.AuthConfig.EnvVars)
	}
}

func TestMCPDiscoveryResultReportsEmptyToolsSeparatelyFromError(t *testing.T) {
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
	if decoded.Tools == nil || len(decoded.Tools) != 0 {
		t.Fatalf("expected explicit empty tools slice, got %#v", decoded.Tools)
	}
}
```

- [ ] **Step 2: Run the model test to verify it fails**

Run:

```bash
cd backend && go test ./internal/models -run 'TestDiscoverToolsRequestDecodesStdioCommandConfig|TestMCPDiscoveryResultReportsEmptyToolsSeparatelyFromError' -v
```

Expected: FAIL to compile because `DiscoverToolsRequest.Command`, `DiscoverToolsRequest.Args`, `DiscoverToolsRequest.WorkingDirectory`, `MCPDiscoveryResult`, and `MCPDiscoveryStatusEmpty` do not exist.

- [ ] **Step 3: Add backend model fields and discovery result types**

Modify `backend/internal/models/mcp_server.go` so the relevant structs include these fields and types:

```go
type MCPConnectionStatus string

const (
	MCPConnectionStatusRegistered MCPConnectionStatus = "REGISTERED"
	MCPConnectionStatusConnected  MCPConnectionStatus = "CONNECTED"
	MCPConnectionStatusError      MCPConnectionStatus = "ERROR"
)

type MCPDiscoveryStatus string

const (
	MCPDiscoveryStatusConnected MCPDiscoveryStatus = "connected"
	MCPDiscoveryStatusEmpty     MCPDiscoveryStatus = "empty"
	MCPDiscoveryStatusError     MCPDiscoveryStatus = "error"
)

type MCPDiscoveryResult struct {
	Status          MCPDiscoveryStatus `json:"status"`
	Message         string             `json:"message"`
	ProtocolVersion string             `json:"protocol_version,omitempty"`
	SessionID       string             `json:"session_id,omitempty"`
	Tools           []DiscoveredTool   `json:"tools"`
}
```

Extend `MCPServer`:

```go
type MCPServer struct {
	ID                   uuid.UUID           `json:"id"`
	Name                 string              `json:"name"`
	Description          string              `json:"description"`
	ServerURL            string              `json:"server_url"`
	Command              string              `json:"command,omitempty"`
	Args                 []string            `json:"args,omitempty"`
	WorkingDirectory     string              `json:"working_directory,omitempty"`
	TransportType        TransportType       `json:"transport_type"`
	AuthType             AuthType            `json:"auth_type"`
	AuthConfig           AuthConfig          `json:"auth_config"`
	OAuthClientID        string              `json:"oauth_client_id,omitempty"`
	OAuthClientSecret    string              `json:"oauth_client_secret,omitempty"`
	OAuthScopes          string              `json:"oauth_scopes,omitempty"`
	OAuthTokens          *OAuthTokens        `json:"oauth_tokens,omitempty"`
	Status               MCPConnectionStatus `json:"status"`
	LastConnectionStatus string              `json:"last_connection_status,omitempty"`
	LastConnectionError  string              `json:"last_connection_error,omitempty"`
	LastDiscoveredAt     *time.Time          `json:"last_discovered_at,omitempty"`
	CreatedAt            time.Time           `json:"created_at"`
	UpdatedAt            time.Time           `json:"updated_at"`
	Tools                []MCPTool           `json:"tools,omitempty"`
}
```

Extend `CreateMCPServerRequest` and `DiscoverToolsRequest`:

```go
type CreateMCPServerRequest struct {
	Name              string           `json:"name" binding:"required"`
	Description       string           `json:"description"`
	ServerURL         string           `json:"server_url"`
	Command           string           `json:"command,omitempty"`
	Args              []string         `json:"args,omitempty"`
	WorkingDirectory  string           `json:"working_directory,omitempty"`
	TransportType     TransportType    `json:"transport_type"`
	AuthType          AuthType         `json:"auth_type"`
	AuthConfig        AuthConfig       `json:"auth_config"`
	OAuthClientID     string           `json:"oauth_client_id,omitempty"`
	OAuthClientSecret string           `json:"oauth_client_secret,omitempty"`
	OAuthScopes       string           `json:"oauth_scopes,omitempty"`
	ImportTools       []DiscoveredTool `json:"import_tools,omitempty"`
}

type DiscoverToolsRequest struct {
	ServerURL        string        `json:"server_url"`
	Command          string        `json:"command,omitempty"`
	Args             []string      `json:"args,omitempty"`
	WorkingDirectory string        `json:"working_directory,omitempty"`
	TransportType    TransportType `json:"transport_type"`
	AuthType         AuthType      `json:"auth_type"`
	AuthConfig       AuthConfig    `json:"auth_config"`
}
```

Add helper methods in the same file:

```go
func (r DiscoverToolsRequest) EndpointOrCommand() string {
	if r.TransportType == TransportStdio {
		return r.Command
	}
	return r.ServerURL
}

func (r DiscoverToolsRequest) ValidateConnectionTarget() error {
	if r.TransportType == TransportStdio {
		if r.Command == "" {
			return fmt.Errorf("command is required for stdio MCP discovery")
		}
		return nil
	}
	if r.ServerURL == "" {
		return fmt.Errorf("server_url is required for HTTP MCP discovery")
	}
	return nil
}
```

Add `fmt` to the import block in `mcp_server.go`:

```go
import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)
```

- [ ] **Step 4: Extend MCP tool model for stdio runtime metadata**

Modify `backend/internal/models/mcp_tool.go`:

```go
type MCPTool struct {
	ID               uuid.UUID       `json:"id"`
	ServerID         *uuid.UUID      `json:"server_id,omitempty"`
	Server           *MCPServer      `json:"server,omitempty"`
	Name             string          `json:"name"`
	Description      string          `json:"description"`
	ServerURL        string          `json:"server_url"`
	Command          string          `json:"command,omitempty"`
	Args             []string        `json:"args,omitempty"`
	WorkingDirectory string          `json:"working_directory,omitempty"`
	TransportType    TransportType   `json:"transport_type"`
	InputSchema      json.RawMessage `json:"input_schema"`
	CreatedAt        time.Time       `json:"created_at"`
}

type CreateMCPToolRequest struct {
	ServerID         *string         `json:"server_id,omitempty"`
	Name             string          `json:"name" binding:"required"`
	Description      string          `json:"description" binding:"required"`
	ServerURL        string          `json:"server_url"`
	Command          string          `json:"command,omitempty"`
	Args             []string        `json:"args,omitempty"`
	WorkingDirectory string          `json:"working_directory,omitempty"`
	TransportType    TransportType   `json:"transport_type"`
	InputSchema      json.RawMessage `json:"input_schema" binding:"required"`
}
```

- [ ] **Step 5: Add database migration**

Create `backend/migrations/008_add_mcp_connection_state_and_stdio_config.sql`:

```sql
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS command TEXT DEFAULT '';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS args JSONB DEFAULT '[]';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS working_directory TEXT DEFAULT '';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS last_connection_status TEXT DEFAULT '';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS last_connection_error TEXT DEFAULT '';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS last_discovered_at TIMESTAMPTZ;

UPDATE mcp_servers
SET command = server_url
WHERE transport_type = 'stdio'
  AND COALESCE(command, '') = ''
  AND COALESCE(server_url, '') <> '';

UPDATE mcp_servers
SET status = 'REGISTERED'
WHERE status = 'ACTIVE';

ALTER TABLE mcp_tools ADD COLUMN IF NOT EXISTS command TEXT DEFAULT '';
ALTER TABLE mcp_tools ADD COLUMN IF NOT EXISTS args JSONB DEFAULT '[]';
ALTER TABLE mcp_tools ADD COLUMN IF NOT EXISTS working_directory TEXT DEFAULT '';

UPDATE mcp_tools
SET command = server_url
WHERE transport_type = 'stdio'
  AND COALESCE(command, '') = ''
  AND COALESCE(server_url, '') <> '';
```

- [ ] **Step 6: Extend frontend types**

Modify `frontend/lib/types.ts`:

```ts
export type MCPConnectionStatus = 'REGISTERED' | 'CONNECTED' | 'ERROR';
export type MCPDiscoveryStatus = 'connected' | 'empty' | 'error';

export interface MCPDiscoveryResult {
  status: MCPDiscoveryStatus;
  message: string;
  protocol_version?: string;
  session_id?: string;
  tools: DiscoveredTool[];
}
```

Extend `MCPTool`, `MCPServer`, and `DiscoverToolsRequest`:

```ts
export interface MCPTool {
  id: string;
  server_id?: string;
  server?: MCPServer;
  name: string;
  description: string;
  server_url: string;
  command?: string;
  args?: string[];
  working_directory?: string;
  transport_type: TransportType;
  input_schema: any;
  created_at: string;
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  server_url: string;
  command?: string;
  args?: string[];
  working_directory?: string;
  transport_type: TransportType;
  auth_type: AuthType;
  auth_config: AuthConfig;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_scopes?: string;
  oauth_tokens?: OAuthTokens;
  status: MCPConnectionStatus;
  last_connection_status?: string;
  last_connection_error?: string;
  last_discovered_at?: string;
  created_at: string;
  updated_at: string;
  tools?: MCPTool[];
}

export interface DiscoverToolsRequest {
  server_url: string;
  command?: string;
  args?: string[];
  working_directory?: string;
  transport_type: TransportType;
  auth_type: AuthType;
  auth_config: AuthConfig;
}
```

- [ ] **Step 7: Run model tests**

Run:

```bash
cd backend && go test ./internal/models -v
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

Run:

```bash
git add backend/internal/models/mcp_server.go backend/internal/models/mcp_tool.go backend/internal/models/mcp_server_test.go backend/migrations/008_add_mcp_connection_state_and_stdio_config.sql frontend/lib/types.ts && git commit -m "Model MCP stdio config and connection state"
```

Expected: commit succeeds.

---

### Task 2: Implement Stdio JSON-RPC Client

**Files:**
- Create: `backend/internal/mcp/jsonrpc.go`
- Replace/modify: `backend/internal/mcp/stdio_client.go`
- Create: `backend/internal/mcp/stdio_client_test.go`

- [ ] **Step 1: Write stdio client tests first**

Create `backend/internal/mcp/stdio_client_test.go`:

```go
package mcp

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

func TestStdioMCPClientDiscoversToolsWithInitializeHandshake(t *testing.T) {
	client := NewStdioMCPClient(
		os.Args[0],
		[]string{"-test.run=TestStdioMCPHelperProcess", "--", "tools"},
		"",
		models.AuthTypeEnvVars,
		models.AuthConfig{EnvVars: map[string]string{"GO_WANT_HELPER_PROCESS": "1", "MCP_HELPER_MODE": "tools"}},
	)

	tools, err := client.DiscoverTools(context.Background())
	if err != nil {
		t.Fatalf("DiscoverTools returned error: %v", err)
	}
	if len(tools) != 1 {
		t.Fatalf("expected one discovered tool, got %#v", tools)
	}
	if tools[0].Name != "read_file" {
		t.Fatalf("expected read_file tool, got %q", tools[0].Name)
	}
	if !strings.Contains(string(tools[0].InputSchema), "path") {
		t.Fatalf("expected input schema to include path, got %s", string(tools[0].InputSchema))
	}
}

func TestStdioMCPClientCallsTool(t *testing.T) {
	client := NewStdioMCPClient(
		os.Args[0],
		[]string{"-test.run=TestStdioMCPHelperProcess", "--", "call"},
		"",
		models.AuthTypeEnvVars,
		models.AuthConfig{EnvVars: map[string]string{"GO_WANT_HELPER_PROCESS": "1", "MCP_HELPER_MODE": "call"}},
	)

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

func TestStdioMCPClientReturnsStartupFailureWithStderr(t *testing.T) {
	client := NewStdioMCPClient(
		os.Args[0],
		[]string{"-test.run=TestStdioMCPHelperProcess", "--", "startup-error"},
		"",
		models.AuthTypeEnvVars,
		models.AuthConfig{EnvVars: map[string]string{"GO_WANT_HELPER_PROCESS": "1", "MCP_HELPER_MODE": "startup-error"}},
	)

	_, err := client.DiscoverTools(context.Background())
	if err == nil {
		t.Fatal("expected startup error")
	}
	if !strings.Contains(err.Error(), "helper startup failed") {
		t.Fatalf("expected stderr in error, got %v", err)
	}
}

func TestStdioMCPHelperProcess(t *testing.T) {
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
					"protocolVersion": "2025-06-18",
					"capabilities": map[string]interface{}{
						"tools": map[string]interface{}{},
					},
					"serverInfo": map[string]interface{}{"name": "helper", "version": "1.0.0"},
				},
			})
		case "notifications/initialized":
		case "tools/list":
			_ = encoder.Encode(map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      id,
				"result": map[string]interface{}{
					"tools": []map[string]interface{}{
						{
							"name":        "read_file",
							"description": "Read a file by path.",
							"inputSchema": map[string]interface{}{
								"type": "object",
								"properties": map[string]interface{}{
									"path": map[string]interface{}{"type": "string"},
								},
								"required": []string{"path"},
							},
						},
					},
				},
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
```

- [ ] **Step 2: Run stdio tests to verify they fail**

Run:

```bash
cd backend && go test ./internal/mcp -run 'TestStdioMCPClient' -v
```

Expected: FAIL to compile because `NewStdioMCPClient` still has the old signature and `DiscoverTools` does not exist.

- [ ] **Step 3: Add shared JSON-RPC helpers**

Create `backend/internal/mcp/jsonrpc.go`:

```go
package mcp

import "encoding/json"

const defaultMCPProtocolVersion = "2025-06-18"

type jsonRPCRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id,omitempty"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

type jsonRPCNotification struct {
	JSONRPC string      `json:"jsonrpc"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params,omitempty"`
}

type jsonRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *jsonRPCError   `json:"error,omitempty"`
}

type jsonRPCError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func initializeRequest(id int) jsonRPCRequest {
	return jsonRPCRequest{
		JSONRPC: "2.0",
		ID:      id,
		Method:  "initialize",
		Params: map[string]interface{}{
			"protocolVersion": defaultMCPProtocolVersion,
			"capabilities":    map[string]interface{}{},
			"clientInfo": map[string]interface{}{
				"name":    "AgenticPlatform",
				"version": "1.0.0",
			},
		},
	}
}

func initializedNotification() jsonRPCNotification {
	return jsonRPCNotification{JSONRPC: "2.0", Method: "notifications/initialized"}
}
```

- [ ] **Step 4: Replace stdio placeholder with real transport**

Modify `backend/internal/mcp/stdio_client.go` to this implementation:

```go
package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/models"
)

type StdioMCPClient struct {
	Command          string
	Args             []string
	WorkingDirectory string
	ToolName         string
	Schema           json.RawMessage
	AuthType         models.AuthType
	AuthConfig       models.AuthConfig
}

type stdioSession struct {
	cmd       *exec.Cmd
	stdin     io.WriteCloser
	stdout    *bufio.Reader
	stderr    *boundedBuffer
	encoder   *json.Encoder
	nextID    int
	closeOnce sync.Once
}

type boundedBuffer struct {
	mu    sync.Mutex
	limit int
	data  []byte
}

func newBoundedBuffer(limit int) *boundedBuffer {
	return &boundedBuffer{limit: limit}
}

func (b *boundedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.data = append(b.data, p...)
	if len(b.data) > b.limit {
		b.data = b.data[len(b.data)-b.limit:]
	}
	return len(p), nil
}

func (b *boundedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return strings.TrimSpace(string(b.data))
}

func NewStdioMCPClient(command string, args []string, workingDirectory string, authType models.AuthType, authConfig models.AuthConfig) *StdioMCPClient {
	return &StdioMCPClient{
		Command:          command,
		Args:             args,
		WorkingDirectory: workingDirectory,
		AuthType:         authType,
		AuthConfig:       authConfig,
	}
}

func NewStdioMCPToolClient(command string, args []string, workingDirectory string, toolName string, schema json.RawMessage, authType models.AuthType, authConfig models.AuthConfig) *StdioMCPClient {
	client := NewStdioMCPClient(command, args, workingDirectory, authType, authConfig)
	client.ToolName = toolName
	client.Schema = schema
	return client
}

func (c *StdioMCPClient) prepareEnv() []string {
	env := os.Environ()
	for k, v := range c.AuthConfig.EnvVars {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}
	return env
}

func (c *StdioMCPClient) startSession(ctx context.Context) (*stdioSession, error) {
	if c.Command == "" {
		return nil, fmt.Errorf("stdio MCP command is required")
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, c.Command, c.Args...)
	cmd.Env = c.prepareEnv()
	if c.WorkingDirectory != "" {
		cmd.Dir = c.WorkingDirectory
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to open MCP stdio stdin: %w", err)
	}
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		_ = stdin.Close()
		return nil, fmt.Errorf("failed to open MCP stdio stdout: %w", err)
	}
	stderr := newBoundedBuffer(8192)
	cmd.Stderr = stderr

	if err := cmd.Start(); err != nil {
		_ = stdin.Close()
		return nil, fmt.Errorf("failed to start MCP stdio command %q: %w", c.Command, err)
	}

	session := &stdioSession{
		cmd:     cmd,
		stdin:   stdin,
		stdout:  bufio.NewReader(stdoutPipe),
		stderr:  stderr,
		encoder: json.NewEncoder(stdin),
		nextID:  1,
	}

	if err := session.initialize(ctx); err != nil {
		_ = session.Close()
		if stderrText := stderr.String(); stderrText != "" {
			return nil, fmt.Errorf("%w; stderr: %s", err, stderrText)
		}
		return nil, err
	}

	return session, nil
}

func (s *stdioSession) initialize(ctx context.Context) error {
	if _, err := s.request(ctx, initializeRequest(s.next())); err != nil {
		return fmt.Errorf("MCP stdio initialize failed: %w", err)
	}
	if err := s.encoder.Encode(initializedNotification()); err != nil {
		return fmt.Errorf("failed to send MCP initialized notification: %w", err)
	}
	return nil
}

func (s *stdioSession) next() int {
	id := s.nextID
	s.nextID++
	return id
}

func (s *stdioSession) request(ctx context.Context, req jsonRPCRequest) (json.RawMessage, error) {
	if err := s.encoder.Encode(req); err != nil {
		return nil, err
	}

	responseCh := make(chan jsonRPCResponse, 1)
	errorCh := make(chan error, 1)
	go func() {
		line, err := s.stdout.ReadBytes('\n')
		if err != nil {
			errorCh <- err
			return
		}
		var response jsonRPCResponse
		if err := json.Unmarshal(line, &response); err != nil {
			errorCh <- fmt.Errorf("invalid MCP stdio JSON-RPC response %q: %w", strings.TrimSpace(string(line)), err)
			return
		}
		responseCh <- response
	}()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case err := <-errorCh:
		if stderrText := s.stderr.String(); stderrText != "" {
			return nil, fmt.Errorf("%w; stderr: %s", err, stderrText)
		}
		return nil, err
	case response := <-responseCh:
		if response.Error != nil {
			return nil, fmt.Errorf("MCP JSON-RPC error %d: %s", response.Error.Code, response.Error.Message)
		}
		return response.Result, nil
	}
}

func (s *stdioSession) Close() error {
	var err error
	s.closeOnce.Do(func() {
		_ = s.stdin.Close()
		if s.cmd.Process != nil {
			_ = s.cmd.Process.Kill()
		}
		err = s.cmd.Wait()
	})
	return err
}

func (c *StdioMCPClient) DiscoverTools(ctx context.Context) ([]models.DiscoveredTool, error) {
	session, err := c.startSession(ctx)
	if err != nil {
		return nil, err
	}
	defer session.Close()

	result, err := session.request(ctx, jsonRPCRequest{JSONRPC: "2.0", ID: session.next(), Method: "tools/list", Params: map[string]interface{}{}})
	if err != nil {
		return nil, err
	}

	var list struct {
		Tools []struct {
			Name        string          `json:"name"`
			Description string          `json:"description"`
			InputSchema json.RawMessage `json:"inputSchema"`
		} `json:"tools"`
	}
	if err := json.Unmarshal(result, &list); err != nil {
		return nil, fmt.Errorf("failed to parse MCP tools/list result: %w", err)
	}

	discovered := make([]models.DiscoveredTool, 0, len(list.Tools))
	for _, tool := range list.Tools {
		discovered = append(discovered, models.DiscoveredTool{
			Name:        tool.Name,
			Description: tool.Description,
			InputSchema: tool.InputSchema,
			Selected:    true,
		})
	}
	return discovered, nil
}

func (c *StdioMCPClient) ListTools(ctx context.Context) ([]llm.ToolDefinition, error) {
	var inputSchema interface{}
	if len(c.Schema) > 0 {
		_ = json.Unmarshal(c.Schema, &inputSchema)
	}
	if inputSchema == nil {
		inputSchema = map[string]interface{}{"type": "object", "properties": map[string]interface{}{}}
	}

	return []llm.ToolDefinition{{
		Name:        c.ToolName,
		Description: fmt.Sprintf("MCP stdio tool %s via command %s", c.ToolName, c.Command),
		InputSchema: inputSchema,
	}}, nil
}

func (c *StdioMCPClient) CallTool(ctx context.Context, name string, args map[string]interface{}) (interface{}, error) {
	session, err := c.startSession(ctx)
	if err != nil {
		return nil, err
	}
	defer session.Close()

	result, err := session.request(ctx, jsonRPCRequest{
		JSONRPC: "2.0",
		ID:      session.next(),
		Method:  "tools/call",
		Params: map[string]interface{}{
			"name":      name,
			"arguments": args,
		},
	})
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"jsonrpc": "2.0",
		"result":  json.RawMessage(result),
	}, nil
}

func (c *StdioMCPClient) Close() error {
	return nil
}
```

- [ ] **Step 5: Run stdio client tests**

Run:

```bash
cd backend && go test ./internal/mcp -run 'TestStdioMCPClient' -v
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add backend/internal/mcp/jsonrpc.go backend/internal/mcp/stdio_client.go backend/internal/mcp/stdio_client_test.go && git commit -m "Implement MCP stdio JSON-RPC client"
```

Expected: commit succeeds.

---

### Task 3: Wire Real Discovery For Stdio And HTTP

**Files:**
- Create: `backend/internal/mcp/discovery_test.go`
- Modify: `backend/internal/mcp/discovery.go`
- Modify: `backend/internal/api/mcp_server_handler.go`
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Write discovery tests**

Create `backend/internal/mcp/discovery_test.go`:

```go
package mcp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"agentic-platform/backend/internal/models"
)

func TestDiscoverServerToolsUsesStdioCommand(t *testing.T) {
	result, err := DiscoverServerTools(context.Background(), models.DiscoverToolsRequest{
		TransportType: models.TransportStdio,
		AuthType:      models.AuthTypeEnvVars,
		Command:       os.Args[0],
		Args:          []string{"-test.run=TestStdioMCPHelperProcess", "--", "tools"},
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

func TestDiscoverServerToolsReportsHTTPEmptyTools(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct{ Method string `json:"method"` }
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}
		switch payload.Method {
		case "initialize":
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Mcp-Session-Id", "session-1")
			_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}}}}`))
		case "notifications/initialized":
			w.WriteHeader(http.StatusAccepted)
		case "tools/list":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":2,"result":{"tools":[]}}`))
		default:
			t.Fatalf("unexpected method %q", payload.Method)
		}
	}))
	defer server.Close()

	result, err := DiscoverServerTools(context.Background(), models.DiscoverToolsRequest{
		TransportType: models.TransportSSE,
		ServerURL:     server.URL,
	})
	if err != nil {
		t.Fatalf("DiscoverServerTools returned error: %v", err)
	}
	if result.Status != models.MCPDiscoveryStatusEmpty {
		t.Fatalf("expected empty status, got %q", result.Status)
	}
	if result.SessionID != "session-1" {
		t.Fatalf("expected session id, got %q", result.SessionID)
	}
}
```

- [ ] **Step 2: Run discovery tests to verify they fail**

Run:

```bash
cd backend && go test ./internal/mcp -run 'TestDiscoverServerTools' -v
```

Expected: FAIL because `DiscoverServerTools` still returns `[]models.DiscoveredTool` instead of `models.MCPDiscoveryResult`.

- [ ] **Step 3: Change discovery signature and stdio branch**

Modify `backend/internal/mcp/discovery.go`:

```go
func DiscoverServerTools(ctx context.Context, req models.DiscoverToolsRequest) (models.MCPDiscoveryResult, error) {
	if err := req.ValidateConnectionTarget(); err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Tools: []models.DiscoveredTool{}}, err
	}

	if req.TransportType == models.TransportStdio {
		client := NewStdioMCPClient(req.Command, req.Args, req.WorkingDirectory, req.AuthType, req.AuthConfig)
		tools, err := client.DiscoverTools(ctx)
		if err != nil {
			return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
		}
		if len(tools) == 0 {
			return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusEmpty, Message: "Connected to MCP stdio server, but it returned no tools.", Tools: []models.DiscoveredTool{}}, nil
		}
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusConnected, Message: fmt.Sprintf("Connected to MCP stdio server and discovered %d tools.", len(tools)), ProtocolVersion: defaultMCPProtocolVersion, Tools: tools}, nil
	}

	return discoverHTTPServerTools(ctx, req)
}
```

Move the existing HTTP body into a private helper:

```go
func discoverHTTPServerTools(ctx context.Context, req models.DiscoverToolsRequest) (models.MCPDiscoveryResult, error) {
	client := &http.Client{Timeout: 15 * time.Second}
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
		r.Header.Set("MCP-Protocol-Version", defaultMCPProtocolVersion)
		if token != "" {
			r.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		} else if req.AuthType == models.AuthTypeAPIKey && req.AuthConfig.APIKeyHeaderName != "" && req.AuthConfig.APIKeyHeaderValue != "" {
			r.Header.Set(req.AuthConfig.APIKeyHeaderName, req.AuthConfig.APIKeyHeaderValue)
		}
		if sessionID != "" {
			r.Header.Set("Mcp-Session-Id", sessionID)
		}
		for k, v := range req.AuthConfig.CustomHeaders {
			r.Header.Set(k, v)
		}
	}

	initBytes, err := json.Marshal(initializeRequest(1))
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Tools: []models.DiscoveredTool{}}, err
	}
	initReq, err := http.NewRequestWithContext(ctx, http.MethodPost, req.ServerURL, bytes.NewBuffer(initBytes))
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Tools: []models.DiscoveredTool{}}, err
	}
	applyHeaders(initReq, "")

	initResp, err := client.Do(initReq)
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
	}
	defer initResp.Body.Close()
	if initResp.StatusCode == http.StatusNotFound || initResp.StatusCode == http.StatusMethodNotAllowed {
		return discoverLegacySSETools(ctx, client, req)
	}
	initBody, _ := io.ReadAll(initResp.Body)
	if initResp.StatusCode >= 400 {
		err := fmt.Errorf("MCP HTTP initialize failed with HTTP %d: %s", initResp.StatusCode, string(initBody))
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
	}

	sessionID := initResp.Header.Get("Mcp-Session-Id")
	protocolVersion := defaultMCPProtocolVersion
	var initResult struct {
		Result struct {
			ProtocolVersion string `json:"protocolVersion"`
		} `json:"result"`
	}
	if json.Unmarshal(initBody, &initResult) == nil && initResult.Result.ProtocolVersion != "" {
		protocolVersion = initResult.Result.ProtocolVersion
	}

	notifBytes, _ := json.Marshal(initializedNotification())
	notifReq, err := http.NewRequestWithContext(ctx, http.MethodPost, req.ServerURL, bytes.NewBuffer(notifBytes))
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Tools: []models.DiscoveredTool{}}, err
	}
	applyHeaders(notifReq, sessionID)
	notifResp, err := client.Do(notifReq)
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
	}
	_ = notifResp.Body.Close()

	rpcPayload := jsonRPCRequest{JSONRPC: "2.0", ID: 2, Method: "tools/list", Params: map[string]interface{}{}}
	jsonBytes, err := json.Marshal(rpcPayload)
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Tools: []models.DiscoveredTool{}}, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, req.ServerURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Tools: []models.DiscoveredTool{}}, err
	}
	applyHeaders(httpReq, sessionID)

	resp, err := client.Do(httpReq)
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
	}
	defer resp.Body.Close()
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
	}

	return parseHTTPToolsListDiscovery(resp.StatusCode, bodyBytes, sessionID, protocolVersion)
}
```

In the HTTP helper, replace the initialize protocol version value with:

```go
"protocolVersion": defaultMCPProtocolVersion,
```

Set this header on initialize, initialized, and tools/list requests:

```go
r.Header.Set("MCP-Protocol-Version", defaultMCPProtocolVersion)
```

Return an explicit empty result when tools/list succeeds with no tools:

```go
if len(rpcRes.Result.Tools) == 0 && resp.StatusCode == http.StatusOK && rpcRes.Error == nil {
	return models.MCPDiscoveryResult{
		Status:    models.MCPDiscoveryStatusEmpty,
		Message:   "Connected to MCP HTTP server, but it returned no tools.",
		SessionID: sessionID,
		Tools:     []models.DiscoveredTool{},
	}, nil
}
```

Return connected when tools are found:

```go
tools, err := extractDiscoveredTools(rpcRes)
if err != nil {
	return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
}
return models.MCPDiscoveryResult{
	Status:    models.MCPDiscoveryStatusConnected,
	Message:   fmt.Sprintf("Connected to MCP HTTP server and discovered %d tools.", len(tools)),
	SessionID: sessionID,
	Tools:     tools,
}, nil
```

- [ ] **Step 4: Update API handler response shape**

Modify `backend/internal/api/mcp_server_handler.go` in `DiscoverTools`:

```go
result, err := mcp.DiscoverServerTools(c.Request.Context(), req)
if err != nil {
	c.JSON(http.StatusBadGateway, result)
	return
}
c.JSON(http.StatusOK, result)
```

Modify `CallbackOAuth` so it receives `result`:

```go
result, discErr := mcp.DiscoverServerTools(c.Request.Context(), discReq)
if discErr != nil {
	result = models.MCPDiscoveryResult{
		Status:  models.MCPDiscoveryStatusError,
		Message: discErr.Error(),
		Tools:   []models.DiscoveredTool{},
	}
}

c.JSON(http.StatusOK, gin.H{
	"status": "authenticated",
	"tokens": tokens,
	"tools":  result.Tools,
	"discovery": result,
})
```

- [ ] **Step 5: Update frontend API typing**

Modify `frontend/lib/api.ts` import list to include `MCPDiscoveryResult` and change `discoverMCPTools`:

```ts
import { Agent, Skill, MCPTool, MCPServer, Workflow, ExecutionSession, SessionLog, DiscoverToolsRequest, DiscoveredTool, OAuthInitRequest, OAuthInitResponse, OAuthCallbackRequest, OAuthTokens, MCPDiscoveryResult } from './types';
```

```ts
discoverMCPTools: (data: DiscoverToolsRequest) =>
  fetchJSON<MCPDiscoveryResult>('/mcp/servers/discover', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
```

- [ ] **Step 6: Run discovery tests**

Run:

```bash
cd backend && go test ./internal/mcp -run 'TestDiscoverServerTools|TestStdioMCPClient' -v
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add backend/internal/mcp/discovery.go backend/internal/mcp/discovery_test.go backend/internal/api/mcp_server_handler.go frontend/lib/api.ts && git commit -m "Wire real MCP discovery results"
```

Expected: commit succeeds.

---

### Task 4: Persist Stdio Config And Connection Health

**Files:**
- Modify: `backend/internal/repository/mcp_server_repository.go`
- Modify: `backend/internal/repository/mcp_tool_repository.go`
- Modify: `backend/internal/mcp/registry.go`

- [ ] **Step 1: Update server repository insert and scan**

Modify `backend/internal/repository/mcp_server_repository.go` in `Create`:

```go
argsBytes, err := json.Marshal(req.Args)
if err != nil {
	argsBytes = []byte("[]")
}

serverURL := req.ServerURL
if transport == models.TransportStdio && serverURL == "" {
	serverURL = req.Command
}

status := models.MCPConnectionStatusRegistered
lastConnectionStatus := "registered"
lastConnectionError := ""
if len(req.ImportTools) > 0 {
	status = models.MCPConnectionStatusConnected
	lastConnectionStatus = "connected"
}
```

Change the insert query columns to include `command`, `args`, `working_directory`, `last_connection_status`, `last_connection_error`, and `last_discovered_at`:

```sql
INSERT INTO mcp_servers (
  id, name, description, server_url, command, args, working_directory,
  transport_type, auth_type, auth_config, oauth_client_id, oauth_client_secret,
  oauth_scopes, oauth_tokens, status, last_connection_status, last_connection_error,
  last_discovered_at, created_at, updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CASE WHEN $18 THEN $19 ELSE NULL END, $20, $21)
```

Pass these values:

```go
hasImportedTools := len(req.ImportTools) > 0
err = r.pool.QueryRow(ctx, query,
	serverID, req.Name, req.Description, serverURL, req.Command, argsBytes, req.WorkingDirectory,
	transport, authType, authBytes, req.OAuthClientID, req.OAuthClientSecret, req.OAuthScopes,
	oauthTokensBytes, status, lastConnectionStatus, lastConnectionError, hasImportedTools, now, now, now,
).Scan(
	&s.ID, &s.Name, &s.Description, &s.ServerURL, &s.Command, &rawArgs, &s.WorkingDirectory,
	&s.TransportType, &s.AuthType, &rawAuth, &s.OAuthClientID, &s.OAuthClientSecret,
	&s.OAuthScopes, &rawOAuthTokens, &s.Status, &s.LastConnectionStatus,
	&s.LastConnectionError, &s.LastDiscoveredAt, &s.CreatedAt, &s.UpdatedAt,
)
```

- [ ] **Step 2: Update server scan helpers**

Add a helper in `mcp_server_repository.go`:

```go
func scanMCPServer(row interface {
	Scan(dest ...interface{}) error
}, s *models.MCPServer) error {
	var rawAuth, rawOAuthTokens, rawArgs []byte
	err := row.Scan(
		&s.ID, &s.Name, &s.Description, &s.ServerURL, &s.Command, &rawArgs, &s.WorkingDirectory,
		&s.TransportType, &s.AuthType, &rawAuth, &s.OAuthClientID, &s.OAuthClientSecret,
		&s.OAuthScopes, &rawOAuthTokens, &s.Status, &s.LastConnectionStatus,
		&s.LastConnectionError, &s.LastDiscoveredAt, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return err
	}
	_ = json.Unmarshal(rawArgs, &s.Args)
	_ = json.Unmarshal(rawAuth, &s.AuthConfig)
	if len(rawOAuthTokens) > 0 {
		var oauthTokens models.OAuthTokens
		if jsonErr := json.Unmarshal(rawOAuthTokens, &oauthTokens); jsonErr == nil && oauthTokens.AccessToken != "" {
			s.OAuthTokens = &oauthTokens
			s.AuthConfig.OAuth = &oauthTokens
		}
	}
	return nil
}
```

Use the same SELECT list in `GetByID` and `List`:

```sql
SELECT id, name, COALESCE(description, ''), server_url, COALESCE(command, ''), COALESCE(args, '[]'), COALESCE(working_directory, ''), transport_type, auth_type, auth_config, COALESCE(oauth_client_id, ''), COALESCE(oauth_client_secret, ''), COALESCE(oauth_scopes, ''), oauth_tokens, status, COALESCE(last_connection_status, ''), COALESCE(last_connection_error, ''), last_discovered_at, created_at, updated_at FROM mcp_servers
```

- [ ] **Step 3: Persist stdio metadata on imported tools**

In the loop that imports tools in `mcp_server_repository.go`, marshal `s.Args` and insert command metadata:

```go
toolArgsBytes, _ := json.Marshal(s.Args)
tQuery := `
  INSERT INTO mcp_tools (id, server_id, name, description, server_url, command, args, working_directory, transport_type, input_schema, created_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  ON CONFLICT DO NOTHING
`
_, execErr := r.pool.Exec(ctx, tQuery, tID, s.ID, tool.Name, desc, s.ServerURL, s.Command, toolArgsBytes, s.WorkingDirectory, s.TransportType, tool.InputSchema, now)
```

- [ ] **Step 4: Update tool repository scan and create**

Modify `backend/internal/repository/mcp_tool_repository.go` to marshal `req.Args` and include the new columns on insert and select:

```go
argsBytes, err := json.Marshal(req.Args)
if err != nil {
	argsBytes = []byte("[]")
}

serverURL := req.ServerURL
if transport == models.TransportStdio && serverURL == "" {
	serverURL = req.Command
}
```

Use this insert:

```sql
INSERT INTO mcp_tools (id, server_id, name, description, server_url, command, args, working_directory, transport_type, input_schema, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING id, server_id, name, description, server_url, command, args, working_directory, transport_type, input_schema, created_at
```

Scan with:

```go
var rawArgs []byte
err := row.Scan(&t.ID, &t.ServerID, &t.Name, &t.Description, &t.ServerURL, &t.Command, &rawArgs, &t.WorkingDirectory, &t.TransportType, &t.InputSchema, &t.CreatedAt)
_ = json.Unmarshal(rawArgs, &t.Args)
```

Add `encoding/json` to the import block.

- [ ] **Step 5: Update registry to use real stdio metadata and real errors**

Modify `backend/internal/mcp/registry.go`:

```go
if tool.TransportType == models.TransportStdio {
	command := tool.Command
	args := tool.Args
	workingDirectory := tool.WorkingDirectory
	if command == "" && tool.Server != nil {
		command = tool.Server.Command
		args = tool.Server.Args
		workingDirectory = tool.Server.WorkingDirectory
	}
	if command == "" {
		command = tool.ServerURL
	}
	client = NewStdioMCPToolClient(command, args, workingDirectory, tool.Name, tool.InputSchema, authType, authConfig)
} else {
	client = NewSSEMCPClient(tool.ServerURL, tool.Name, tool.InputSchema, authType, authConfig)
}
```

Change `ExecuteTool` missing-client fallback:

```go
return nil, fmt.Errorf("MCP tool %q is not registered in the runtime registry", toolName)
```

Add `fmt` to the import block.

- [ ] **Step 6: Run backend package tests**

Run:

```bash
cd backend && go test ./internal/mcp ./internal/models ./internal/repository -v
```

Expected: PASS or repository package compiles. If repository tests require a database, run `cd backend && go test ./internal/mcp ./internal/models -v` and then `cd backend && go test ./...` after local database config is available.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git add backend/internal/repository/mcp_server_repository.go backend/internal/repository/mcp_tool_repository.go backend/internal/mcp/registry.go && git commit -m "Persist MCP stdio config and connection health"
```

Expected: commit succeeds.

---

### Task 5: Harden HTTP MCP Errors And Legacy SSE Behavior

**Files:**
- Modify: `backend/internal/mcp/sse_client_test.go`
- Modify: `backend/internal/mcp/sse_client.go`
- Modify: `backend/internal/mcp/discovery.go`

- [ ] **Step 1: Add HTTP negative tests**

Append to `backend/internal/mcp/sse_client_test.go`:

```go
func TestSSEMCPClientReturnsInitializeHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"missing bearer token"}`))
	}))
	defer server.Close()

	client := NewSSEMCPClient(server.URL, "testTool", nil, models.AuthTypeNone, models.AuthConfig{})
	_, err := client.CallTool(context.Background(), "testTool", map[string]interface{}{})
	if err == nil {
		t.Fatal("expected initialize error")
	}
	if !strings.Contains(err.Error(), "HTTP 401") {
		t.Fatalf("expected HTTP 401 in error, got %v", err)
	}
}

func TestSSEMCPClientReturnsToolCallHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload struct{ Method string `json:"method"` }
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}
		switch payload.Method {
		case "initialize":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}}}}`))
		case "notifications/initialized":
			w.WriteHeader(http.StatusAccepted)
		case "tools/call":
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			_, _ = w.Write([]byte(`{"error":"upstream unavailable"}`))
		}
	}))
	defer server.Close()

	client := NewSSEMCPClient(server.URL, "testTool", nil, models.AuthTypeNone, models.AuthConfig{})
	_, err := client.CallTool(context.Background(), "testTool", map[string]interface{}{})
	if err == nil {
		t.Fatal("expected tool call error")
	}
	if !strings.Contains(err.Error(), "HTTP 502") {
		t.Fatalf("expected HTTP 502 in error, got %v", err)
	}
}
```

Add `strings` to the import block.

- [ ] **Step 2: Run HTTP negative tests to verify they fail**

Run:

```bash
cd backend && go test ./internal/mcp -run 'TestSSEMCPClientReturns' -v
```

Expected: FAIL because current `SSEMCPClient` fabricates success or swallows initialize failures.

- [ ] **Step 3: Return real initialization errors**

Change `ensureInitialized` in `backend/internal/mcp/sse_client.go` to return `error`:

```go
func (c *SSEMCPClient) ensureInitialized(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.initialized {
		return nil
	}

	client := &http.Client{Timeout: 15 * time.Second}
	initPayload := initializeRequest(1)
	body, err := json.Marshal(initPayload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.ServerURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	c.applyHeaders(req)
	req.Header.Del("Mcp-Session-Id")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to initialize MCP HTTP server %s: %w", c.ServerURL, err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("MCP HTTP initialize failed with HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	if sessionID := resp.Header.Get("Mcp-Session-Id"); sessionID != "" {
		c.SessionID = sessionID
	}
	c.updateProtocolVersion(respBody)

	if err := c.sendInitializedNotification(ctx, client); err != nil {
		return err
	}
	c.initialized = true
	return nil
}
```

Change `sendInitializedNotification` to return `error` and validate non-2xx/202:

```go
func (c *SSEMCPClient) sendInitializedNotification(ctx context.Context, client *http.Client) error {
	notifPayload := initializedNotification()
	body, err := json.Marshal(notifPayload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.ServerURL, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	c.applyHeaders(req)
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("MCP initialized notification failed with HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}
	return nil
}
```

In `CallTool`, replace `c.ensureInitialized(ctx)` with:

```go
if err := c.ensureInitialized(ctx); err != nil {
	return nil, err
}
```

Replace fabricated fallback returns in `CallTool` with real errors:

```go
if err != nil {
	return nil, err
}
```

After reading the response body:

```go
if resp.StatusCode >= 400 {
	return nil, fmt.Errorf("MCP HTTP tools/call failed with HTTP %d: %s", resp.StatusCode, string(body))
}
```

- [ ] **Step 4: Add legacy HTTP+SSE fallback to discovery**

In `backend/internal/mcp/discovery.go`, when initialize returns 404 or 405 for HTTP transport, call a helper:

```go
if initResp.StatusCode == http.StatusNotFound || initResp.StatusCode == http.StatusMethodNotAllowed {
	return discoverLegacySSETools(ctx, client, req)
}
```

Add this helper:

```go
func discoverLegacySSETools(ctx context.Context, client *http.Client, req models.DiscoverToolsRequest) (models.MCPDiscoveryResult, error) {
	getReq, err := http.NewRequestWithContext(ctx, http.MethodGet, req.ServerURL, nil)
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Tools: []models.DiscoveredTool{}}, err
	}
	getReq.Header.Set("Accept", "text/event-stream")
	getReq.Header.Set("User-Agent", "AgenticPlatform/1.0")

	resp, err := client.Do(getReq)
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Tools: []models.DiscoveredTool{}}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		err := fmt.Errorf("legacy MCP SSE discovery failed with HTTP %d: %s", resp.StatusCode, string(bodyBytes))
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
	}

	return models.MCPDiscoveryResult{
		Status:  models.MCPDiscoveryStatusError,
		Message: "Legacy HTTP+SSE endpoint was detected. Tool discovery for legacy endpoint events must be completed before registering this server.",
		Tools:   []models.DiscoveredTool{},
	}, fmt.Errorf("legacy HTTP+SSE discovery endpoint detected but endpoint-event POST routing is not implemented")
}
```

This helper deliberately returns an actionable error instead of pretending success, so legacy HTTP+SSE servers are never labeled connected without a completed `tools/list` response.

- [ ] **Step 5: Run HTTP transport tests**

Run:

```bash
cd backend && go test ./internal/mcp -run 'TestSSEMCPClient|TestDiscoverServerTools' -v
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add backend/internal/mcp/sse_client.go backend/internal/mcp/sse_client_test.go backend/internal/mcp/discovery.go && git commit -m "Return real MCP HTTP connection errors"
```

Expected: commit succeeds.

---

### Task 6: Update MCP Registration UI For Command Args And Truthful Status

**Files:**
- Modify: `frontend/components/mcp/MCPServerForm.tsx`
- Modify: `frontend/components/mcp/MCPServerCard.tsx`
- Modify: `frontend/app/(dashboard)/mcp-tools/page.tsx`

- [ ] **Step 1: Add stdio form state**

Modify `frontend/components/mcp/MCPServerForm.tsx` near existing connection state:

```tsx
const [command, setCommand] = useState('');
const [argsText, setArgsText] = useState('');
const [workingDirectory, setWorkingDirectory] = useState('');
const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
const [discoveryWarning, setDiscoveryWarning] = useState<string | null>(null);
```

Add helper functions above `handleDiscover`:

```tsx
const getStdioArgs = () =>
  argsText
    .split('\n')
    .map((arg) => arg.trim())
    .filter(Boolean);

const getConnectionTarget = () => {
  if (transportType === 'stdio') {
    return command.trim();
  }
  return serverUrl.trim();
};
```

- [ ] **Step 2: Replace the stdio single command input with command/args fields**

In the connection section, keep the HTTP URL input only for HTTP:

```tsx
{transportType === 'sse' ? (
  <div>
    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
      Server MCP Endpoint URL
    </label>
    <input
      type="url"
      required
      placeholder="https://mcp.example.com/mcp"
      value={serverUrl}
      onChange={(e) => setServerUrl(e.target.value)}
      className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
    />
  </div>
) : (
  <div className="space-y-4">
    <div>
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
        Command
      </label>
      <input
        type="text"
        required
        placeholder="npx"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
      />
    </div>
    <div>
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
        Arguments, one per line
      </label>
      <textarea
        rows={5}
        placeholder={'-y\n@modelcontextprotocol/server-filesystem\n/home/prince/Desktop'}
        value={argsText}
        onChange={(e) => setArgsText(e.target.value)}
        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
      />
    </div>
    <div>
      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
        Working Directory
      </label>
      <input
        type="text"
        placeholder="/mnt/agentic-app"
        value={workingDirectory}
        onChange={(e) => setWorkingDirectory(e.target.value)}
        className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
      />
    </div>
  </div>
)}
```

- [ ] **Step 3: Update discovery request and status handling**

Replace the start of `handleDiscover`:

```tsx
if (!getConnectionTarget()) {
  setError(transportType === 'stdio' ? 'Please enter the stdio command, for example npx.' : 'Please enter the MCP endpoint URL.');
  return;
}

setDiscovering(true);
setError(null);
setDiscoveryMessage(null);
setDiscoveryWarning(null);
setDiscoverySuccess(false);
```

Replace the API call body:

```tsx
const res = await api.discoverMCPTools({
  server_url: transportType === 'sse' ? serverUrl : '',
  command: transportType === 'stdio' ? command.trim() : undefined,
  args: transportType === 'stdio' ? getStdioArgs() : undefined,
  working_directory: transportType === 'stdio' ? workingDirectory.trim() : undefined,
  transport_type: transportType,
  auth_type: authType,
  auth_config: buildAuthConfig(),
});

setDiscoveredTools(res.tools || []);
setDiscoveryMessage(res.message);
if (res.status === 'connected') {
  setDiscoverySuccess(true);
} else if (res.status === 'empty') {
  setDiscoveryWarning(res.message || 'Connected, but this MCP server returned no tools.');
} else {
  setError(res.message || 'Connection or discovery failed.');
}
```

Replace the catch block:

```tsx
setError(getErrorMessage(err, 'Connection or discovery failed. Check command, endpoint, auth credentials, and server logs.'));
setDiscoverySuccess(false);
```

- [ ] **Step 4: Update submit payload**

In `handleSubmit`, send stdio metadata:

```tsx
await api.createMCPServer({
  name,
  description,
  server_url: transportType === 'sse' ? serverUrl : '',
  command: transportType === 'stdio' ? command.trim() : undefined,
  args: transportType === 'stdio' ? getStdioArgs() : undefined,
  working_directory: transportType === 'stdio' ? workingDirectory.trim() : undefined,
  transport_type: transportType,
  auth_type: authType,
  auth_config: buildAuthConfig(),
  oauth_client_id: oauthClientId,
  oauth_client_secret: oauthClientSecret,
  oauth_scopes: oauthScopes,
  import_tools: selectedTools,
});
```

Update `frontend/lib/api.ts` `createMCPServer` parameter type:

```ts
createMCPServer: (data: {
  name: string;
  description?: string;
  server_url: string;
  command?: string;
  args?: string[];
  working_directory?: string;
  transport_type: string;
  auth_type: string;
  auth_config: any;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_scopes?: string;
  import_tools?: DiscoveredTool[];
}) => fetchJSON<{ message?: string; server?: MCPServer } | MCPServer>('/mcp/servers', { method: 'POST', body: JSON.stringify(data) }),
```

- [ ] **Step 5: Render empty discovery separately**

Below the success block in `MCPServerForm.tsx`, add:

```tsx
{discoveryWarning && (
  <div className="p-3 bg-amber-950/50 border border-amber-800 rounded-lg text-amber-300 text-xs flex items-center space-x-2">
    <AlertCircle className="w-4 h-4 flex-shrink-0" />
    <span>{discoveryWarning}</span>
  </div>
)}

{discoveryMessage && !discoverySuccess && !discoveryWarning && (
  <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 text-xs">
    {discoveryMessage}
  </div>
)}
```

- [ ] **Step 6: Show real status on server cards**

Modify `frontend/components/mcp/MCPServerCard.tsx`:

```tsx
const getStatusBadge = () => {
  if (server.status === 'CONNECTED') {
    return <Badge variant="worker">CONNECTED</Badge>;
  }
  if (server.status === 'ERROR') {
    return <Badge variant="danger">ERROR</Badge>;
  }
  return <Badge variant="default">REGISTERED</Badge>;
};
```

Add `{getStatusBadge()}` next to the transport/auth badges.

Replace endpoint display:

```tsx
<div className="bg-[#090d16] p-2.5 rounded-lg border border-[#1e293b] text-xs font-mono text-slate-300 truncate mb-3">
  <span className="text-slate-500 mr-2">{server.transport_type === 'stdio' ? 'Command:' : 'Endpoint:'}</span>
  {server.transport_type === 'stdio' ? [server.command, ...(server.args || [])].filter(Boolean).join(' ') : server.server_url}
</div>
```

Show connection error when present:

```tsx
{server.last_connection_error && (
  <div className="mb-3 rounded-lg border border-red-900 bg-red-950/30 p-2 text-[11px] text-red-300">
    {server.last_connection_error}
  </div>
)}
```

Replace footer text:

```tsx
<span>
  {server.last_discovered_at ? `Discovered: ${new Date(server.last_discovered_at).toLocaleDateString()}` : `Registered: ${new Date(server.created_at).toLocaleDateString()}`}
</span>
```

- [ ] **Step 7: Update page copy**

Modify `frontend/app/(dashboard)/mcp-tools/page.tsx` empty state description:

```tsx
description="Connect to Streamable HTTP endpoints or local stdio commands such as npx with args and environment variables."
```

- [ ] **Step 8: Run frontend lint**

Run:

```bash
cd frontend && npm run lint
```

Expected: PASS.

- [ ] **Step 9: Commit Task 6**

Run:

```bash
git add frontend/lib/api.ts frontend/components/mcp/MCPServerForm.tsx frontend/components/mcp/MCPServerCard.tsx frontend/app/\(dashboard\)/mcp-tools/page.tsx && git commit -m "Improve MCP registration status UI"
```

Expected: commit succeeds.

---

### Task 7: Document MCP Connection Behavior And Manual Validation

**Files:**
- Create: `docs/mcp-connection-behavior.md`

- [ ] **Step 1: Create documentation**

Create `docs/mcp-connection-behavior.md`:

```markdown
# MCP Connection Behavior

This application supports two MCP transports.

## Local stdio servers

Local MCP servers launched with `npx`, `node`, `uvx`, or another executable use the MCP stdio transport.

The application stores these values separately:

- `command`: executable name or absolute path, for example `npx`
- `args`: process arguments, for example `-y`, `@modelcontextprotocol/server-filesystem`, `/home/prince/Desktop`
- `auth_config.env_vars`: environment variables passed to the subprocess
- `working_directory`: optional process working directory

The backend launches the subprocess and speaks newline-delimited JSON-RPC over stdin/stdout:

1. `initialize`
2. `notifications/initialized`
3. `tools/list`
4. `tools/call` during workflow execution

The server may write logs to stderr. The backend includes recent stderr text in connection errors so users can diagnose missing environment variables, bad paths, missing npm packages, or permission issues.

Example stdio registration:

```text
Command: npx
Arguments:
-y
@modelcontextprotocol/server-filesystem
/home/prince/Desktop
```

Equivalent Inspector check:

```bash
npx @modelcontextprotocol/inspector --cli npx -y @modelcontextprotocol/server-filesystem /home/prince/Desktop --method tools/list
```

## Streamable HTTP servers

Remote MCP servers use a single MCP endpoint URL, for example `https://mcp.example.com/mcp`.

The backend sends JSON-RPC POST requests with these headers:

- `Accept: application/json, text/event-stream`
- `Content-Type: application/json`
- `MCP-Protocol-Version: 2025-06-18`
- `Mcp-Session-Id` after the server returns one during initialize
- Authentication headers from OAuth, bearer token, API key, or custom headers

The backend runs:

1. `initialize`
2. `notifications/initialized`
3. `tools/list`
4. `tools/call` during workflow execution

Equivalent Inspector check:

```bash
npx @modelcontextprotocol/inspector --cli --server-url https://mcp.example.com/mcp --transport http --method tools/list
```

## Connection states

- `REGISTERED`: saved configuration; no successful discovery has been imported yet
- `CONNECTED`: last discovery succeeded and imported at least one tool
- `ERROR`: last connection or discovery attempt failed

Discovery can also return `empty`, meaning the MCP handshake succeeded but `tools/list` returned no tools.
```

- [ ] **Step 2: Commit Task 7**

Run:

```bash
git add docs/mcp-connection-behavior.md && git commit -m "Document MCP connection behavior"
```

Expected: commit succeeds.

---

### Task 8: Full Verification

**Files:**
- No code changes.

- [ ] **Step 1: Run backend MCP tests**

Run:

```bash
cd backend && go test ./internal/mcp ./internal/models -v
```

Expected: PASS.

- [ ] **Step 2: Run all backend tests**

Run:

```bash
cd backend && go test ./... -v
```

Expected: PASS. If database-backed repository tests fail because local PostgreSQL is not configured, capture the failure and rerun the focused non-database packages from Step 1.

- [ ] **Step 3: Run frontend lint**

Run:

```bash
cd frontend && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Manually verify stdio discovery with a known server**

Run the reference Inspector command first:

```bash
npx @modelcontextprotocol/inspector --cli npx -y @modelcontextprotocol/server-filesystem /mnt/agentic-app --method tools/list
```

Expected: Inspector prints a `tools/list` result containing filesystem tools.

Then in the app, register:

```text
Transport: Stdio Subprocess Command Transport
Command: npx
Arguments:
-y
@modelcontextprotocol/server-filesystem
/mnt/agentic-app
Authentication Method: No Authentication or Process Environment Variables
```

Expected: UI displays `CONNECTED`, discovered tools appear, and the saved MCP server card shows the command and imported tool count.

- [ ] **Step 5: Manually verify failure status**

Register a stdio server with:

```text
Command: npx
Arguments:
-y
@modelcontextprotocol/server-filesystem
/path/that/does/not/exist
```

Expected: discovery fails with a visible error. The UI must not show “Successfully connected.”

- [ ] **Step 6: Final commit**

Run:

```bash
git status --short
```

Expected: no uncommitted implementation changes remain after the task commits.

---

## Self-Review

**Spec coverage:**
- NPX/local stdio server connection: covered by Tasks 1, 2, 3, 4, 6, and 8.
- MCP standard lifecycle (`initialize`, `notifications/initialized`, `tools/list`, `tools/call`): covered by Tasks 2, 3, and 5.
- Environment-variable authentication for stdio: covered by Tasks 1, 2, 6, and 8.
- HTTPS/Streamable HTTP connection behavior: covered by Tasks 3 and 5.
- User feedback for connected/error/empty tools: covered by Tasks 1, 3, 4, and 6.
- Documentation and manual validation: covered by Task 7 and Task 8.

**Placeholder scan:**
- No task uses forbidden placeholder phrases, vague validation, or undefined implementation references.

**Type consistency:**
- Backend `MCPDiscoveryResult` maps to frontend `MCPDiscoveryResult`.
- Backend stdio config fields are `command`, `args`, and `working_directory`; frontend uses the same JSON property names.
- Connection status values are `REGISTERED`, `CONNECTED`, and `ERROR` across backend and frontend.