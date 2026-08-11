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

type GeminiProvider struct {
	APIKey    string
	ModelName string
}

func NewGeminiProvider(apiKey string, modelName string) *GeminiProvider {
	if modelName == "" {
		modelName = "gemini-1.5-pro"
	}
	return &GeminiProvider{
		APIKey:    apiKey,
		ModelName: modelName,
	}
}

type geminiPart struct {
	Text string `json:"text,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role"`
	Parts []geminiPart `json:"parts"`
}

type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
			Role string `json:"role"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (p *GeminiProvider) Chat(ctx context.Context, messages []ChatMessage, tools []ToolDefinition, temperature float64) (*LLMResponse, error) {
	if p.APIKey == "" {
		return &LLMResponse{
			Content:    fmt.Sprintf("[Google Gemini Mock Response for model %s]: Query evaluated and executed successfully.", p.ModelName),
			StopReason: "STOP",
		}, nil
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", p.ModelName, p.APIKey)

	var contents []geminiContent
	for _, m := range messages {
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		}
		contents = append(contents, geminiContent{
			Role: role,
			Parts: []geminiPart{
				{Text: m.Content},
			},
		})
	}

	reqBody := geminiRequest{
		Contents: contents,
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

	var res geminiResponse
	if err := json.Unmarshal(bodyBytes, &res); err != nil {
		return nil, fmt.Errorf("failed to parse Gemini response: %w", err)
	}

	if res.Error != nil && res.Error.Message != "" {
		return nil, fmt.Errorf("Gemini API error: %s", res.Error.Message)
	}

	if len(res.Candidates) == 0 {
		return nil, fmt.Errorf("empty candidates from Gemini API")
	}

	cand := res.Candidates[0]
	var text string
	for _, part := range cand.Content.Parts {
		text += part.Text
	}

	return &LLMResponse{
		Content:    text,
		StopReason: cand.FinishReason,
	}, nil
}
