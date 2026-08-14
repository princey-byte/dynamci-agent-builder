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