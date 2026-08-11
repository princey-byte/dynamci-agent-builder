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

type OpenAIProvider struct {
	APIKey    string
	ModelName string
	BaseURL   string
}

func NewOpenAIProvider(apiKey string, modelName string) *OpenAIProvider {
	if modelName == "" {
		modelName = "gpt-4o"
	}
	return &OpenAIProvider{
		APIKey:    apiKey,
		ModelName: modelName,
		BaseURL:   "https://api.openai.com/v1",
	}
}

type openAIChatRequest struct {
	Model       string               `json:"model"`
	Messages    []ChatMessage        `json:"messages"`
	Tools       []openAIToolWrapper  `json:"tools,omitempty"`
	Temperature float64              `json:"temperature"`
}

type openAIToolWrapper struct {
	Type     string         `json:"type"` // "function"
	Function ToolDefinition `json:"function"`
}

type openAIChatResponse struct {
	Choices []struct {
		Message struct {
			Role      string `json:"role"`
			Content   string `json:"content"`
			ToolCalls []struct {
				ID       string `json:"id"`
				Type     string `json:"type"`
				Function struct {
					Name      string `json:"name"`
					Arguments string `json:"arguments"`
				} `json:"function"`
			} `json:"tool_calls"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (p *OpenAIProvider) Chat(ctx context.Context, messages []ChatMessage, tools []ToolDefinition, temperature float64) (*LLMResponse, error) {
	if p.APIKey == "" {
		// Mock response if API key is not configured yet
		return &LLMResponse{
			Content:    fmt.Sprintf("[OpenAI Mock Response for model %s]: Processed task successfully with input query context.", p.ModelName),
			StopReason: "stop",
		}, nil
	}

	url := fmt.Sprintf("%s/chat/completions", p.BaseURL)

	var toolWrappers []openAIToolWrapper
	for _, t := range tools {
		toolWrappers = append(toolWrappers, openAIToolWrapper{
			Type:     "function",
			Function: t,
		})
	}

	reqBody := openAIChatRequest{
		Model:       p.ModelName,
		Messages:    messages,
		Tools:       toolWrappers,
		Temperature: temperature,
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
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.APIKey))

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

	var res openAIChatResponse
	if err := json.Unmarshal(bodyBytes, &res); err != nil {
		return nil, fmt.Errorf("failed to parse OpenAI response: %w", err)
	}

	if res.Error != nil && res.Error.Message != "" {
		return nil, fmt.Errorf("OpenAI API error: %s", res.Error.Message)
	}

	if len(res.Choices) == 0 {
		return nil, fmt.Errorf("empty choice array from OpenAI API")
	}

	choice := res.Choices[0]
	var toolCalls []ToolCall
	for _, tc := range choice.Message.ToolCalls {
		toolCalls = append(toolCalls, ToolCall{
			ID:        tc.ID,
			Name:      tc.Function.Name,
			Arguments: tc.Function.Arguments,
		})
	}

	return &LLMResponse{
		Content:    choice.Message.Content,
		ToolCalls:  toolCalls,
		StopReason: choice.FinishReason,
	}, nil
}
