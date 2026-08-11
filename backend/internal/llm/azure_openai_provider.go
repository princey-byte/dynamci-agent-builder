package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type AzureOpenAIProvider struct {
	APIKey      string
	Endpoint    string
	APIVersion  string
	ModelName   string
	Deployments map[string]string
}

func NewAzureOpenAIProvider(apiKey, endpoint, apiVersion, modelName string, deployments map[string]string) *AzureOpenAIProvider {
	if apiVersion == "" {
		apiVersion = "2024-02-15-preview"
	}
	return &AzureOpenAIProvider{
		APIKey:      apiKey,
		Endpoint:    strings.TrimSuffix(endpoint, "/"),
		APIVersion:  apiVersion,
		ModelName:   modelName,
		Deployments: deployments,
	}
}

func (p *AzureOpenAIProvider) Chat(ctx context.Context, messages []ChatMessage, tools []ToolDefinition, temperature float64) (*LLMResponse, error) {
	if p.APIKey == "" || p.Endpoint == "" {
		return &LLMResponse{
			Content:    fmt.Sprintf("[Azure OpenAI Mock Response for model %s]: Processed request successfully.", p.ModelName),
			StopReason: "stop",
		}, nil
	}

	deploymentName := p.ModelName
	if mapped, ok := p.Deployments[p.ModelName]; ok && mapped != "" {
		deploymentName = mapped
	}

	url := fmt.Sprintf("%s/openai/deployments/%s/chat/completions?api-version=%s", p.Endpoint, deploymentName, p.APIVersion)

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
	req.Header.Set("api-key", p.APIKey)

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
		return nil, fmt.Errorf("failed to parse Azure OpenAI response: %w", err)
	}

	if res.Error != nil && res.Error.Message != "" {
		return nil, fmt.Errorf("Azure OpenAI API error: %s", res.Error.Message)
	}

	if len(res.Choices) == 0 {
		return nil, fmt.Errorf("empty choices array from Azure OpenAI API")
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
