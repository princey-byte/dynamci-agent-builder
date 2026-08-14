package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type TransportType string

const (
	TransportSSE   TransportType = "sse"
	TransportStdio TransportType = "stdio"
)

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
