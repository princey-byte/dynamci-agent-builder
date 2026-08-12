package mcp

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"agentic-platform/backend/internal/models"
)

func GenerateCodeVerifier() (string, error) {
	b := make([]byte, 64)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func GenerateCodeChallenge(verifier string) string {
	h := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

func GenerateState() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func InitiateOAuthFlow(req models.OAuthInitRequest) (*models.OAuthInitResponse, error) {
	verifier, err := GenerateCodeVerifier()
	if err != nil {
		return nil, fmt.Errorf("failed to generate PKCE verifier: %w", err)
	}

	challenge := GenerateCodeChallenge(verifier)
	state := GenerateState()

	authURL := req.AuthorizeURL
	if authURL == "" {
		sURL := strings.ToLower(req.ServerURL)
		if strings.Contains(sURL, "github") {
			authURL = "https://github.com/login/oauth/authorize"
		} else if isNotionMCPServer(req.ServerURL, "") {
			authURL = "https://mcp.notion.com/authorize"
		} else if strings.Contains(sURL, "notion") {
			authURL = "https://api.notion.com/v1/oauth/authorize"
		} else if strings.Contains(sURL, "atlassian") {
			authURL = "https://auth.atlassian.com/authorize"
		} else {
			authURL = fmt.Sprintf("%s/oauth/authorize", strings.TrimSuffix(req.ServerURL, "/"))
		}
	}

	if req.ClientID == "" && (strings.Contains(authURL, "github.com") || strings.Contains(req.ServerURL, "github")) {
		return nil, fmt.Errorf("GitHub OAuth requires a Client ID. Please enter your GitHub OAuth App Client ID (or use Bearer Token auth).")
	}

	registeredClientSecret := ""
	if req.ClientID == "" && isNotionMCPServer(req.ServerURL, authURL) {
		registeredClientID, clientSecret, registerErr := RegisterOAuthClient(context.Background(), req)
		if registerErr != nil {
			return nil, registerErr
		}
		req.ClientID = registeredClientID
		registeredClientSecret = clientSecret
	}

	if req.ClientID == "" && (strings.Contains(authURL, "notion.com") || strings.Contains(req.ServerURL, "notion")) {
		return nil, fmt.Errorf("Notion OAuth requires a Client ID. Please enter your Notion Public Integration Client ID from https://www.notion.so/my-integrations (or use Bearer Token auth).")
	}

	if req.ClientID == "" && (strings.Contains(authURL, "atlassian.com") || strings.Contains(req.ServerURL, "atlassian")) {
		return nil, fmt.Errorf("Atlassian OAuth requires a Client ID. Please enter your Atlassian App Client ID from https://developer.atlassian.com/console/myapps (or use Bearer Token auth).")
	}

	parsed, err := url.Parse(authURL)
	if err != nil {
		return nil, fmt.Errorf("invalid authorization URL: %w", err)
	}

	q := parsed.Query()
	q.Set("response_type", "code")
	if isNotionAPIOAuth(req.ServerURL, authURL) {
		q.Set("owner", "user")
	}
	if strings.Contains(authURL, "atlassian") || strings.Contains(req.ServerURL, "atlassian") {
		q.Set("audience", "api.atlassian.com")
		q.Set("prompt", "consent")
	}
	if req.ClientID != "" {
		q.Set("client_id", req.ClientID)
	}
	if req.RedirectURI != "" {
		q.Set("redirect_uri", req.RedirectURI)
	}
	if req.Scopes != "" {
		q.Set("scope", req.Scopes)
	} else if isNotionMCPServer(req.ServerURL, authURL) {
		q.Set("scope", "default")
	}
	q.Set("state", state)
	q.Set("code_challenge", challenge)
	q.Set("code_challenge_method", "S256")

	parsed.RawQuery = q.Encode()

	return &models.OAuthInitResponse{
		AuthorizationURL: parsed.String(),
		State:            state,
		CodeVerifier:     verifier,
		ClientID:         req.ClientID,
		ClientSecret:     registeredClientSecret,
	}, nil
}

type oauthClientRegistrationResponse struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret,omitempty"`
}

func RegisterOAuthClient(ctx context.Context, req models.OAuthInitRequest) (string, string, error) {
	registrationURL := req.RegistrationURL
	if registrationURL == "" {
		registrationURL = "https://mcp.notion.com/register"
	}

	payload := map[string]interface{}{
		"client_name":                "AgenticPlatform MCP Client",
		"redirect_uris":              []string{req.RedirectURI},
		"grant_types":                []string{"authorization_code", "refresh_token"},
		"response_types":             []string{"code"},
		"token_endpoint_auth_method": "none",
	}
	if req.Scopes != "" {
		payload["scope"] = req.Scopes
	} else if isNotionMCPServer(req.ServerURL, registrationURL) {
		payload["scope"] = "default"
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return "", "", err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", registrationURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", "AgenticPlatform/1.0")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", "", fmt.Errorf("failed to register OAuth client (%s): %w", registrationURL, err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", fmt.Errorf("failed to read OAuth registration response: %w", err)
	}
	if resp.StatusCode >= 400 {
		return "", "", fmt.Errorf("OAuth client registration failed with HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var res oauthClientRegistrationResponse
	if err := json.Unmarshal(bodyBytes, &res); err != nil {
		return "", "", fmt.Errorf("failed to parse OAuth registration response: %s", string(bodyBytes))
	}
	if res.ClientID == "" {
		return "", "", fmt.Errorf("OAuth registration returned empty client ID. Response: %s", string(bodyBytes))
	}

	return res.ClientID, res.ClientSecret, nil
}

type oauthTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	TokenType    string `json:"token_type,omitempty"`
	ExpiresIn    int    `json:"expires_in,omitempty"`
	Scope        string `json:"scope,omitempty"`
	Error        string `json:"error,omitempty"`
	ErrorDesc    string `json:"error_description,omitempty"`
}

func ExchangeOAuthToken(ctx context.Context, req models.OAuthCallbackRequest) (*models.OAuthTokens, error) {
	tokenURL := req.TokenURL
	if tokenURL == "" {
		sURL := strings.ToLower(req.ServerURL)
		if strings.Contains(sURL, "github") {
			tokenURL = "https://github.com/login/oauth/access_token"
		} else if isNotionMCPServer(req.ServerURL, "") {
			tokenURL = "https://mcp.notion.com/token"
		} else if strings.Contains(sURL, "notion") {
			tokenURL = "https://api.notion.com/v1/oauth/token"
		} else if strings.Contains(sURL, "atlassian") {
			tokenURL = "https://auth.atlassian.com/oauth/token"
		} else {
			tokenURL = fmt.Sprintf("%s/oauth/token", strings.TrimSuffix(req.ServerURL, "/"))
		}
	}

	var httpReq *http.Request
	var err error

	if strings.Contains(tokenURL, "atlassian") || strings.Contains(req.ServerURL, "atlassian") {
		// Atlassian strictly requires application/json body
		jsonPayload := map[string]string{
			"grant_type":    "authorization_code",
			"client_id":     req.ClientID,
			"client_secret": req.ClientSecret,
			"code":          req.Code,
			"redirect_uri":  req.RedirectURI,
		}
		if req.CodeVerifier != "" {
			jsonPayload["code_verifier"] = req.CodeVerifier
		}
		jsonBytes, _ := json.Marshal(jsonPayload)
		httpReq, err = http.NewRequestWithContext(ctx, "POST", tokenURL, bytes.NewBuffer(jsonBytes))
		if err != nil {
			return nil, err
		}
		httpReq.Header.Set("Content-Type", "application/json")
	} else if isNotionAPIOAuth(req.ServerURL, tokenURL) {
		if req.ClientID == "" || req.ClientSecret == "" {
			return nil, fmt.Errorf("Notion OAuth token exchange requires both Client ID and Client Secret")
		}

		jsonPayload := map[string]string{
			"grant_type":   "authorization_code",
			"code":         req.Code,
			"redirect_uri": req.RedirectURI,
		}
		jsonBytes, _ := json.Marshal(jsonPayload)
		httpReq, err = http.NewRequestWithContext(ctx, "POST", tokenURL, bytes.NewBuffer(jsonBytes))
		if err != nil {
			return nil, err
		}
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", fmt.Sprintf("Basic %s", base64.StdEncoding.EncodeToString([]byte(req.ClientID+":"+req.ClientSecret))))
		httpReq.Header.Set("Notion-Version", "2026-03-11")
	} else {
		// Form-encoded format (GitHub / Notion)
		form := url.Values{}
		form.Set("grant_type", "authorization_code")
		form.Set("code", req.Code)
		form.Set("redirect_uri", req.RedirectURI)
		form.Set("code_verifier", req.CodeVerifier)
		if req.ClientID != "" {
			form.Set("client_id", req.ClientID)
		}
		if req.ClientSecret != "" {
			form.Set("client_secret", req.ClientSecret)
		}
		httpReq, err = http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(form.Encode()))
		if err != nil {
			return nil, err
		}
		httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}

	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", "AgenticPlatform/1.0")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to reach OAuth token endpoint (%s): %w", tokenURL, err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read OAuth token response: %w", err)
	}

	var res oauthTokenResponse
	if err := json.Unmarshal(bodyBytes, &res); err != nil {
		// Try parsing URL-encoded response (e.g. GitHub default format)
		parsedQuery, parseErr := url.ParseQuery(string(bodyBytes))
		if parseErr == nil && parsedQuery.Get("access_token") != "" {
			res.AccessToken = parsedQuery.Get("access_token")
			res.TokenType = parsedQuery.Get("token_type")
			res.Scope = parsedQuery.Get("scope")
			res.RefreshToken = parsedQuery.Get("refresh_token")
		} else {
			return nil, fmt.Errorf("failed to parse OAuth token response: %s", string(bodyBytes))
		}
	}

	if res.Error != "" {
		return nil, fmt.Errorf("OAuth token error: %s - %s", res.Error, res.ErrorDesc)
	}

	if res.AccessToken == "" {
		return nil, fmt.Errorf("OAuth server returned empty access token. Response: %s", string(bodyBytes))
	}

	expiresAt := time.Time{}
	if res.ExpiresIn > 0 {
		expiresAt = time.Now().Add(time.Duration(res.ExpiresIn) * time.Second)
	}

	return &models.OAuthTokens{
		AccessToken:  res.AccessToken,
		RefreshToken: res.RefreshToken,
		TokenType:    res.TokenType,
		ExpiresAt:    expiresAt,
		Scope:        res.Scope,
	}, nil
}

func isNotionMCPServer(serverURL string, endpointURL string) bool {
	serverURL = strings.ToLower(serverURL)
	endpointURL = strings.ToLower(endpointURL)
	return strings.Contains(serverURL, "mcp.notion.com") || strings.Contains(endpointURL, "mcp.notion.com")
}

func isNotionAPIOAuth(serverURL string, endpointURL string) bool {
	if isNotionMCPServer(serverURL, endpointURL) {
		return false
	}
	serverURL = strings.ToLower(serverURL)
	endpointURL = strings.ToLower(endpointURL)
	return strings.Contains(serverURL, "api.notion.com") || strings.Contains(endpointURL, "api.notion.com")
}
