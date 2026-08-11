package llm

import (
	"context"
)

type ChatMessage struct {
	Role    string `json:"role"`    // "system", "user", "assistant", "tool"
	Content string `json:"content"`
	Name    string `json:"name,omitempty"`
}

type ToolDefinition struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema interface{} `json:"input_schema"`
}

type ToolCall struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type LLMResponse struct {
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	StopReason string     `json:"stop_reason"`
}

type LLMProvider interface {
	Chat(ctx context.Context, messages []ChatMessage, tools []ToolDefinition, temperature float64) (*LLMResponse, error)
}
