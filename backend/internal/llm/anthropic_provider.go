package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AnthropicProvider struct {
	APIKey    string
	ModelName string
}

func NewAnthropicProvider(apiKey string, modelName string) *AnthropicProvider {
	if modelName == "" {
		modelName = "claude-3-5-sonnet-20241022"
	}
	return &AnthropicProvider{
		APIKey:    apiKey,
		ModelName: modelName,
	}
}

type anthropicMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	System    string             `json:"system,omitempty"`
	Messages  []anthropicMessage `json:"messages"`
	MaxTokens int                `json:"max_tokens"`
	Tools     []anthropicTool    `json:"tools,omitempty"`
}

type anthropicTool struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema interface{} `json:"input_schema"`
}

type anthropicResponse struct {
	Content []struct {
		Type  string          `json:"type"` // "text" or "tool_use"
		Text  string          `json:"text,omitempty"`
		ID    string          `json:"id,omitempty"`
		Name  string          `json:"name,omitempty"`
		Input json.RawMessage `json:"input,omitempty"`
	} `json:"content"`
	StopReason string `json:"stop_reason"`
	Error      *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (p *AnthropicProvider) Chat(ctx context.Context, messages []ChatMessage, tools []ToolDefinition, temperature float64) (*LLMResponse, error) {
	if p.APIKey == "" {
		return &LLMResponse{
			Content:    fmt.Sprintf("[Anthropic Claude Mock Response for model %s]: Task evaluated and processed successfully.", p.ModelName),
			StopReason: "end_turn",
		}, nil
	}

	url := "https://api.anthropic.com/v1/messages"

	var systemPrompt string
	var anthMessages []anthropicMessage

	for _, m := range messages {
		if m.Role == "system" {
			if systemPrompt != "" {
				systemPrompt += "\n\n"
			}
			systemPrompt += m.Content
		} else {
			role := m.Role
			if role == "tool" {
				role = "user"
			}
			anthMessages = append(anthMessages, anthropicMessage{
				Role:    role,
				Content: m.Content,
			})
		}
	}

	var anthTools []anthropicTool
	for _, t := range tools {
		anthTools = append(anthTools, anthropicTool{
			Name:        t.Name,
			Description: t.Description,
			InputSchema: t.InputSchema,
		})
	}

	reqBody := anthropicRequest{
		Model:     p.ModelName,
		System:    systemPrompt,
		Messages:  anthMessages,
		MaxTokens: 4096,
		Tools:     anthTools,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", p.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var res anthropicResponse
	if err := json.Unmarshal(bodyBytes, &res); err != nil {
		return nil, fmt.Errorf("failed to parse Anthropic response: %w", err)
	}

	if res.Error != nil && res.Error.Message != "" {
		return nil, fmt.Errorf("Anthropic API error: %s", res.Error.Message)
	}

	var textContent string
	var toolCalls []ToolCall

	for _, block := range res.Content {
		if block.Type == "text" {
			textContent += block.Text
		} else if block.Type == "tool_use" {
			toolCalls = append(toolCalls, ToolCall{
				ID:        block.ID,
				Name:      block.Name,
				Arguments: string(block.Input),
			})
		}
	}

	return &LLMResponse{
		Content:    textContent,
		ToolCalls:  toolCalls,
		StopReason: res.StopReason,
	}, nil
}
