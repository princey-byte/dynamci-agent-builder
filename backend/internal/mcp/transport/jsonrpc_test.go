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