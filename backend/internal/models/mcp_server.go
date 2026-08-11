package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type AuthType string

const (
	AuthTypeNone          AuthType = "none"
	AuthTypeBearer        AuthType = "bearer"
	AuthTypeAPIKey        AuthType = "api_key"
	AuthTypeCustomHeaders AuthType = "custom_headers"
	AuthTypeEnvVars       AuthType = "env_vars"
)

type AuthConfig struct {
	BearerToken       string            `json:"bearer_token,omitempty"`
	APIKeyHeaderName  string            `json:"api_key_header_name,omitempty"`
	APIKeyHeaderValue string            `json:"api_key_header_value,omitempty"`
	CustomHeaders     map[string]string `json:"custom_headers,omitempty"`
	EnvVars           map[string]string `json:"env_vars,omitempty"`
}

type MCPServer struct {
	ID            uuid.UUID     `json:"id"`
	Name          string        `json:"name"`
	Description   string        `json:"description"`
	ServerURL     string        `json:"server_url"`
	TransportType TransportType `json:"transport_type"`
	AuthType      AuthType      `json:"auth_type"`
	AuthConfig    AuthConfig    `json:"auth_config"`
	Status        string        `json:"status"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
	Tools         []MCPTool     `json:"tools,omitempty"`
}

type CreateMCPServerRequest struct {
	Name          string           `json:"name" binding:"required"`
	Description   string           `json:"description"`
	ServerURL     string           `json:"server_url" binding:"required"`
	TransportType TransportType    `json:"transport_type"`
	AuthType      AuthType         `json:"auth_type"`
	AuthConfig    AuthConfig       `json:"auth_config"`
	ImportTools   []DiscoveredTool `json:"import_tools,omitempty"`
}

type DiscoverToolsRequest struct {
	ServerURL     string        `json:"server_url" binding:"required"`
	TransportType TransportType `json:"transport_type"`
	AuthType      AuthType      `json:"auth_type"`
	AuthConfig    AuthConfig    `json:"auth_config"`
}

type DiscoveredTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"`
	Selected    bool            `json:"selected,omitempty"`
}
