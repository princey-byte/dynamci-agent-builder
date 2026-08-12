package mcp

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"agentic-platform/backend/internal/models"
)

func TestInitiateOAuthFlowDynamicallyRegistersNotionMCPClient(t *testing.T) {
	registerServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST registration request, got %s", r.Method)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Fatalf("expected JSON content type, got %q", got)
		}

		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("failed to decode registration payload: %v", err)
		}
		if payload["token_endpoint_auth_method"] != "none" {
			t.Fatalf("expected public PKCE client registration, got %#v", payload)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"client_id":"dynamic-client-id","client_secret":"dynamic-client-secret"}`))
	}))
	defer registerServer.Close()

	res, err := InitiateOAuthFlow(models.OAuthInitRequest{
		ServerURL:       "https://mcp.notion.com/mcp",
		RegistrationURL: registerServer.URL,
		RedirectURI:     "http://localhost:3001/mcp/oauth/callback",
	})
	if err != nil {
		t.Fatalf("InitiateOAuthFlow returned error: %v", err)
	}

	if res.ClientID != "dynamic-client-id" || res.ClientSecret != "dynamic-client-secret" {
		t.Fatalf("expected dynamic client credentials, got client_id=%q client_secret=%q", res.ClientID, res.ClientSecret)
	}
	if !strings.Contains(res.AuthorizationURL, "client_id=dynamic-client-id") {
		t.Fatalf("expected authorization URL to use dynamic client ID, got %s", res.AuthorizationURL)
	}
}

func TestInitiateOAuthFlowUsesNotionMCPMetadataDefaults(t *testing.T) {
	res, err := InitiateOAuthFlow(models.OAuthInitRequest{
		ServerURL:   "https://mcp.notion.com/mcp",
		ClientID:    "test-client-id",
		RedirectURI: "http://localhost:3001/mcp/oauth/callback",
	})
	if err != nil {
		t.Fatalf("InitiateOAuthFlow returned error: %v", err)
	}

	if !strings.HasPrefix(res.AuthorizationURL, "https://mcp.notion.com/authorize?") {
		t.Fatalf("expected Notion MCP authorization endpoint, got %s", res.AuthorizationURL)
	}
	if !strings.Contains(res.AuthorizationURL, "scope=default") {
		t.Fatalf("expected default Notion MCP scope, got %s", res.AuthorizationURL)
	}
}

func TestExchangeOAuthTokenUsesNotionAPIBasicJSONRequest(t *testing.T) {
	const clientID = "notion-client-id"
	const clientSecret = "notion-client-secret"
	expectedAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte(clientID+":"+clientSecret))

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != expectedAuth {
			t.Fatalf("expected Basic auth header %q, got %q", expectedAuth, got)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Fatalf("expected JSON content type, got %q", got)
		}

		var payload map[string]string
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("failed to decode JSON body: %v", err)
		}
		if payload["grant_type"] != "authorization_code" || payload["code"] != "auth-code" || payload["redirect_uri"] != "http://localhost:3001/mcp/oauth/callback" {
			t.Fatalf("unexpected token payload: %#v", payload)
		}
		if _, exists := payload["client_secret"]; exists {
			t.Fatalf("client_secret must be sent via Basic auth, not JSON body: %#v", payload)
		}
		if _, exists := payload["code_verifier"]; exists {
			t.Fatalf("Notion public API token exchange should not send code_verifier: %#v", payload)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"notion-access-token","refresh_token":"notion-refresh-token","token_type":"bearer"}`))
	}))
	defer server.Close()

	tokens, err := ExchangeOAuthToken(context.Background(), models.OAuthCallbackRequest{
		ServerURL:    "https://api.notion.com/v1/oauth/authorize",
		TokenURL:     server.URL,
		Code:         "auth-code",
		CodeVerifier: "unused-public-api-pkce-verifier",
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURI:  "http://localhost:3001/mcp/oauth/callback",
	})
	if err != nil {
		t.Fatalf("ExchangeOAuthToken returned error: %v", err)
	}
	if tokens.AccessToken != "notion-access-token" {
		t.Fatalf("expected access token, got %q", tokens.AccessToken)
	}
}

func TestExchangeOAuthTokenUsesNotionMCPPKCEFormRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "" {
			t.Fatalf("expected no Basic auth header for Notion MCP public PKCE client, got %q", got)
		}
		if got := r.Header.Get("Content-Type"); got != "application/x-www-form-urlencoded" {
			t.Fatalf("expected form content type, got %q", got)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatalf("failed to parse form: %v", err)
		}
		if r.Form.Get("client_id") != "mcp-client-id" || r.Form.Get("code_verifier") != "pkce-verifier" {
			t.Fatalf("expected client_id and code_verifier in form, got %#v", r.Form)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"mcp-access-token","refresh_token":"mcp-refresh-token","token_type":"bearer"}`))
	}))
	defer server.Close()

	tokens, err := ExchangeOAuthToken(context.Background(), models.OAuthCallbackRequest{
		ServerURL:    "https://mcp.notion.com/mcp",
		TokenURL:     server.URL,
		Code:         "auth-code",
		CodeVerifier: "pkce-verifier",
		ClientID:     "mcp-client-id",
		RedirectURI:  "http://localhost:3001/mcp/oauth/callback",
	})
	if err != nil {
		t.Fatalf("ExchangeOAuthToken returned error: %v", err)
	}
	if tokens.AccessToken != "mcp-access-token" {
		t.Fatalf("expected access token, got %q", tokens.AccessToken)
	}
}
