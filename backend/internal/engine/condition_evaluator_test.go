package engine

import (
	"context"
	"testing"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/models"
)

type mockLLMProvider struct {
	responseContent string
	shouldError     bool
}

func (m *mockLLMProvider) Chat(ctx context.Context, messages []llm.ChatMessage, tools []llm.ToolDefinition, temperature float64) (*llm.LLMResponse, error) {
	if m.shouldError {
		return nil, context.DeadlineExceeded
	}
	return &llm.LLMResponse{
		Content: m.responseContent,
	}, nil
}

func TestRuleConditionEvaluator(t *testing.T) {
	evaluator := NewConditionEvaluator(nil)

	// Test 1: Always condition
	edgeAlways := models.WorkflowEdge{ConditionType: "always"}
	matched, _, err := evaluator.EvaluateCondition(context.Background(), edgeAlways, "Any output")
	if err != nil || !matched {
		t.Errorf("Always condition should match. Matched: %v, err: %v", matched, err)
	}

	// Test 2: Contains rule
	edgeContains := models.WorkflowEdge{
		ConditionType:       "rule_match",
		ConditionExpression: `contains("URGENT")`,
	}
	matched, _, _ = evaluator.EvaluateCondition(context.Background(), edgeContains, "This is an urgent priority request")
	if !matched {
		t.Errorf("Expected contains rule to match case-insensitively")
	}

	matchedFail, _, _ := evaluator.EvaluateCondition(context.Background(), edgeContains, "Regular priority request")
	if matchedFail {
		t.Errorf("Contains rule should have failed for regular request")
	}

	// Test 3: Regex rule
	edgeRegex := models.WorkflowEdge{
		ConditionType:       "rule_match",
		ConditionExpression: `regex("ERR_[0-9]+")`,
	}
	matchedRegex, _, _ := evaluator.EvaluateCondition(context.Background(), edgeRegex, "System threw ERR_404 during execution")
	if !matchedRegex {
		t.Errorf("Expected regex rule to match ERR_404")
	}

	matchedRegexFail, _, _ := evaluator.EvaluateCondition(context.Background(), edgeRegex, "No errors found")
	if matchedRegexFail {
		t.Errorf("Regex rule should fail when pattern is absent")
	}

	// Test 4: Invalid regex edge case
	edgeBadRegex := models.WorkflowEdge{
		ConditionType:       "rule_match",
		ConditionExpression: `regex("[a-z(5")`,
	}
	_, _, badRegexErr := evaluator.EvaluateCondition(context.Background(), edgeBadRegex, "test")
	if badRegexErr == nil {
		t.Errorf("Expected error for invalid regex expression")
	}

	// Test 5: Fallback condition
	edgeFallback := models.WorkflowEdge{ConditionType: "fallback"}
	matchedFallback, _, _ := evaluator.EvaluateCondition(context.Background(), edgeFallback, "Output text")
	if !matchedFallback {
		t.Errorf("Expected fallback condition to return true")
	}
}

func TestLLMDecisionEvaluator(t *testing.T) {
	mockFactory := func(provider, model string) (llm.LLMProvider, error) {
		return &mockLLMProvider{responseContent: "MATCH: The query is asking for financial calculation."}, nil
	}

	evaluator := NewConditionEvaluator(mockFactory)

	edgeLLM := models.WorkflowEdge{
		ConditionType:       "llm_decision",
		ConditionExpression: "Query asks for financial computation",
	}

	matched, reason, err := evaluator.EvaluateCondition(context.Background(), edgeLLM, "Calculate 15% ROI on $50,000 investment")
	if err != nil {
		t.Fatalf("Unexpected error from LLM evaluator: %v", err)
	}
	if !matched {
		t.Errorf("Expected LLM evaluator to match")
	}
	if reason == "" {
		t.Errorf("Expected non-empty reason")
	}
}
