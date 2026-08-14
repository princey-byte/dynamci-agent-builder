package models

import (
	"encoding/json"
	"fmt"
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
	AuthTypeOAuth         AuthType = "oauth2"
)

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

type AuthConfig struct {
	BearerToken       string            `json:"bearer_token,omitempty"`
	APIKeyHeaderName  string            `json:"api_key_header_name,omitempty"`
	APIKeyHeaderValue string            `json:"api_key_header_value,omitempty"`
	CustomHeaders     map[string]string `json:"custom_headers,omitempty"`
	EnvVars           map[string]string `json:"env_vars,omitempty"`
	OAuth             *OAuthTokens      `json:"oauth,omitempty"`
}

type OAuthTokens struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token,omitempty"`
	TokenType    string    `json:"token_type,omitempty"`
	ExpiresAt    time.Time `json:"expires_at,omitempty"`
	Scope        string    `json:"scope,omitempty"`
}

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

type DiscoveredTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"`
	Selected    bool            `json:"selected,omitempty"`
}

// OAuth DTOs
type OAuthInitRequest struct {
	ServerURL       string `json:"server_url" binding:"required"`
	AuthorizeURL    string `json:"authorize_url,omitempty"`
	RegistrationURL string `json:"registration_url,omitempty"`
	ClientID        string `json:"client_id,omitempty"`
	Scopes          string `json:"scopes,omitempty"`
	RedirectURI     string `json:"redirect_uri" binding:"required"`
}

type OAuthInitResponse struct {
	AuthorizationURL string `json:"authorization_url"`
	State            string `json:"state"`
	CodeVerifier     string `json:"code_verifier"`
	ClientID         string `json:"client_id,omitempty"`
	ClientSecret     string `json:"client_secret,omitempty"`
}

type OAuthCallbackRequest struct {
	ServerURL    string `json:"server_url" binding:"required"`
	TokenURL     string `json:"token_url,omitempty"`
	Code         string `json:"code" binding:"required"`
	CodeVerifier string `json:"code_verifier" binding:"required"`
	ClientID     string `json:"client_id,omitempty"`
	ClientSecret string `json:"client_secret,omitempty"`
	RedirectURI  string `json:"redirect_uri" binding:"required"`
}
