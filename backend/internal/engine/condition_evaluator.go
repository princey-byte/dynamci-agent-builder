package engine

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/models"
)

type ConditionEvaluator struct {
	llmFactory func(provider, model string) (llm.LLMProvider, error)
}

func NewConditionEvaluator(factory func(provider, model string) (llm.LLMProvider, error)) *ConditionEvaluator {
	if factory == nil {
		factory = llm.GetLLMProvider
	}
	return &ConditionEvaluator{llmFactory: factory}
}

func (ce *ConditionEvaluator) EvaluateCondition(
	ctx context.Context,
	edge models.WorkflowEdge,
	output string,
) (bool, string, error) {
	switch edge.ConditionType {
	case "always", "":
		return true, "Condition is unconditional ('always')", nil

	case "fallback", "else":
		return true, "Fallback / Else branch", nil

	case "rule_match":
		return ce.evaluateRule(edge.ConditionExpression, output)

	case "llm_decision":
		return ce.evaluateLLMDecision(ctx, edge.ConditionExpression, output)

	default:
		return true, fmt.Sprintf("Unknown condition type '%s', defaulted to match", edge.ConditionType), nil
	}
}

func (ce *ConditionEvaluator) evaluateRule(expression, output string) (bool, string, error) {
	expr := strings.TrimSpace(expression)
	if expr == "" {
		return true, "Empty rule expression defaulted to match", nil
	}

	// Pattern: contains("KEYWORD")
	if strings.HasPrefix(expr, "contains(") && strings.HasSuffix(expr, ")") {
		keyword := strings.Trim(expr[9:len(expr)-1], `"' `)
		if strings.Contains(strings.ToLower(output), strings.ToLower(keyword)) {
			return true, fmt.Sprintf("Output contains keyword '%s'", keyword), nil
		}
		return false, fmt.Sprintf("Output does not contain keyword '%s'", keyword), nil
	}

	// Pattern: regex("PATTERN")
	if strings.HasPrefix(expr, "regex(") && strings.HasSuffix(expr, ")") {
		pattern := strings.Trim(expr[6:len(expr)-1], `"' `)
		re, err := regexp.Compile(pattern)
		if err != nil {
			return false, "", fmt.Errorf("invalid regex expression: %w", err)
		}
		matched := re.MatchString(output)
		return matched, fmt.Sprintf("Regex '%s' match: %v", pattern, matched), nil
	}

	// Direct substring fallback
	matched := strings.Contains(strings.ToLower(output), strings.ToLower(expr))
	return matched, fmt.Sprintf("Substring '%s' match: %v", expr, matched), nil
}

func (ce *ConditionEvaluator) evaluateLLMDecision(ctx context.Context, criteria, output string) (bool, string, error) {
	if strings.TrimSpace(criteria) == "" {
		return true, "Empty LLM decision criteria defaulted to match", nil
	}

	provider, err := ce.llmFactory("openai", "gpt-4o")
	if err != nil {
		return false, "", fmt.Errorf("failed to initialize LLM provider for condition routing: %w", err)
	}

	prompt := fmt.Sprintf(`You are a binary classification evaluator in an AI agent workflow.
Evaluation Criteria: "%s"
Agent Output to evaluate:
"""
%s
"""

Determine if the agent output satisfies the criteria.
Respond ONLY with either:
MATCH: <brief reason>
or
NO_MATCH: <brief reason>`, criteria, output)

	resp, err := provider.Chat(ctx, []llm.ChatMessage{
		{Role: "user", Content: prompt},
	}, nil, 0.0)

	if err != nil {
		return false, "", err
	}

	content := strings.TrimSpace(resp.Content)
	if strings.HasPrefix(strings.ToUpper(content), "MATCH") {
		return true, content, nil
	}

	return false, content, nil
}
