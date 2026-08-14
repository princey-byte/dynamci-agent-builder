# Intelligent Conditional Routing & Branching Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement dynamic conditional routing in the workflow engine supporting LLM Semantic Classification, deterministic Rule-Based Expression matching (keywords, regex, jsonpath), Default/Fallback paths, and Self-Correction Review Loops with Loop-Guard safety (`max_iterations`).

**Architecture:** Build a dedicated `ConditionEvaluator` and `BranchRouter` in `internal/engine`. During execution of a parent agent node, outgoing edges are evaluated against the agent's output state. Matched edges trigger execution of child nodes, while unmatched branches are explicitly recorded as `BRANCH_SKIPPED` in session logs and SSE streams. Back-edges for critique/review loops are tracked with cycle iteration counters to avoid runaway execution.

**Tech Stack:** Go 1.24 (Regex, JSONPath, LLM Classifier), SSE Stream Protocol, PostgreSQL.

---

## File Structure & Responsibilities

- `backend/internal/engine/condition_evaluator.go`: Evaluates rule-based expressions (`contains`, `matches`, `jsonpath`, `threshold`), LLM semantic classifier calls, and fallback logic.
- `backend/internal/engine/condition_evaluator_test.go`: Unit tests for keyword matching, regex evaluation, numeric thresholds, and invalid condition handling.
- `backend/internal/engine/loop_guard.go`: Tracks edge traversal frequencies per session to prevent infinite execution cycles (`max_loop_count`).
- `backend/internal/engine/loop_guard_test.go`: Unit tests for loop limits and cycle termination.
- `backend/internal/engine/branch_router.go`: Determines active vs skipped branch transitions and coordinates with `GraphExecutor`.
- `backend/internal/models/events.go`: Adds new SSE event constants `EventConditionEvaluated` and `EventBranchSkipped`.

---

### Task 1: SSE Event Constants & Condition Evaluator Types

**Files:**
- Modify: `backend/internal/models/events.go`
- Create: `backend/internal/engine/condition_evaluator_test.go`
- Create: `backend/internal/engine/condition_evaluator.go`

- [ ] **Step 1: Update `backend/internal/models/events.go` with conditional event types**

```go
// In backend/internal/models/events.go
package models

type EventType string

const (
	EventAgentThought       EventType = "AGENT_THOUGHT"
	EventDelegation         EventType = "AGENT_DELEGATION"
	EventToolCall           EventType = "TOOL_CALL"
	EventToolResult         EventType = "TOOL_RESULT"
	EventConditionEvaluated EventType = "CONDITION_EVALUATED"
	EventBranchSkipped      EventType = "BRANCH_SKIPPED"
	EventWorkflowComplete   EventType = "WORKFLOW_COMPLETE"
	EventError              EventType = "ERROR"
)
```

- [ ] **Step 2: Write failing test for ConditionEvaluator**

```go
// backend/internal/engine/condition_evaluator_test.go
package engine

import (
	"context"
	"testing"
	"agentic-platform/backend/internal/models"
)

func TestRuleConditionEvaluator(t *testing.T) {
	evaluator := NewConditionEvaluator(nil)

	// Test 1: Always condition
	edgeAlways := models.WorkflowEdge{ConditionType: "always"}
	matched, reason, err := evaluator.EvaluateCondition(context.Background(), edgeAlways, "Any output")
	if err != nil || !matched {
		t.Errorf("Always condition should match. Matched: %v, err: %v", matched, err)
	}

	// Test 2: Contains rule
	edgeContains := models.WorkflowEdge{
		ConditionType:       "rule_match",
		ConditionExpression: `contains("URGENT")`,
	}
	matched, _, _ = evaluator.EvaluateCondition(context.Background(), edgeContains, "This is an URGENT request")
	if !matched {
		t.Errorf("Expected contains rule to match")
	}

	matchedFail, _, _ := evaluator.EvaluateCondition(context.Background(), edgeContains, "Regular request")
	if matchedFail {
		t.Errorf("Contains rule should have failed for regular request")
	}
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `go test ./internal/engine -run TestRuleConditionEvaluator` in `backend`
Expected: FAIL with "NewConditionEvaluator undefined"

- [ ] **Step 4: Implement `condition_evaluator.go`**

```go
// backend/internal/engine/condition_evaluator.go
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
		return true, "Condition type is unconditional ('always')", nil

	case "fallback", "else":
		return true, "Fallback / Else branch taken", nil

	case "rule_match":
		return ce.evaluateRule(edge.ConditionExpression, output)

	case "llm_decision":
		return ce.evaluateLLMDecision(ctx, edge.ConditionExpression, output)

	default:
		return true, fmt.Sprintf("Unknown condition type '%s', defaulted to pass", edge.ConditionType), nil
	}
}

func (ce *ConditionEvaluator) evaluateRule(expression, output string) (bool, string, error) {
	expr := strings.TrimSpace(expression)

	// Pattern: contains("KEYWORD")
	if strings.HasPrefix(expr, "contains(") && strings.HasSuffix(expr, ")") {
		keyword := strings.Trim(expr[9:len(expr)-1], `"`)
		if strings.Contains(strings.ToLower(output), strings.ToLower(keyword)) {
			return true, fmt.Sprintf("Output contains keyword '%s'", keyword), nil
		}
		return false, fmt.Sprintf("Output does not contain keyword '%s'", keyword), nil
	}

	// Pattern: regex("PATTERN")
	if strings.HasPrefix(expr, "regex(") && strings.HasSuffix(expr, ")") {
		pattern := strings.Trim(expr[6:len(expr)-1], `"`)
		re, err := regexp.Compile(pattern)
		if err != nil {
			return false, "", fmt.Errorf("invalid regex expression: %w", err)
		}
		matched := re.MatchString(output)
		return matched, fmt.Sprintf("Regex '%s' match result: %v", pattern, matched), nil
	}

	// Fallback to substring match
	matched := strings.Contains(strings.ToLower(output), strings.ToLower(expr))
	return matched, fmt.Sprintf("Substring match for '%s': %v", expr, matched), nil
}

func (ce *ConditionEvaluator) evaluateLLMDecision(ctx context.Context, criteria, output string) (bool, string, error) {
	provider, err := ce.llmFactory("openai", "gpt-4o")
	if err != nil {
		return false, "", fmt.Errorf("failed to get LLM provider for condition evaluation: %w", err)
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
	if strings.HasPrefix(content, "MATCH") {
		return true, content, nil
	}

	return false, content, nil
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `go test ./internal/engine -run TestRuleConditionEvaluator -v` in `backend`
Expected: PASS

---

### Task 2: Loop Guard & Self-Correction Reviewer Engine

**Files:**
- Create: `backend/internal/engine/loop_guard.go`
- Create: `backend/internal/engine/loop_guard_test.go`

- [ ] **Step 1: Write test for LoopGuard**

```go
// backend/internal/engine/loop_guard_test.go
package engine

import (
	"testing"
	"github.com/google/uuid"
)

func TestLoopGuard(t *testing.T) {
	guard := NewLoopGuard(3) // Max 3 iterations
	nodeID := uuid.New()

	for i := 0; i < 3; i++ {
		canExec, count := guard.RecordAndCheck(nodeID)
		if !canExec {
			t.Errorf("Iteration %d should be allowed", i+1)
		}
		if count != i+1 {
			t.Errorf("Expected count %d, got %d", i+1, count)
		}
	}

	// 4th iteration should be blocked
	canExec, _ := guard.RecordAndCheck(nodeID)
	if canExec {
		t.Errorf("4th iteration exceeded max loops and should have been blocked")
	}
}
```

- [ ] **Step 2: Implement `loop_guard.go`**

```go
// backend/internal/engine/loop_guard.go
package engine

import (
	"sync"
	"github.com/google/uuid"
)

type LoopGuard struct {
	mu       sync.Mutex
	maxLoops int
	counts   map[uuid.UUID]int
}

func NewLoopGuard(maxLoops int) *LoopGuard {
	if maxLoops <= 0 {
		maxLoops = 5
	}
	return &LoopGuard{
		maxLoops: maxLoops,
		counts:   make(map[uuid.UUID]int),
	}
}

func (lg *LoopGuard) RecordAndCheck(nodeID uuid.UUID) (bool, int) {
	lg.mu.Lock()
	defer lg.mu.Unlock()

	lg.counts[nodeID]++
	curr := lg.counts[nodeID]

	if curr > lg.maxLoops {
		return false, curr
	}
	return true, curr
}

func (lg *LoopGuard) Reset() {
	lg.mu.Lock()
	defer lg.mu.Unlock()
	lg.counts = make(map[uuid.UUID]int)
}
```

- [ ] **Step 3: Run LoopGuard unit tests**

Run: `go test ./internal/engine -run TestLoopGuard -v` in `backend`
Expected: PASS

---

### Task 3: Branch Router & GraphExecutor Integration

**Files:**
- Create: `backend/internal/engine/branch_router.go`
- Modify: `backend/internal/engine/graph_executor.go`

- [ ] **Step 1: Implement `branch_router.go`**

```go
// backend/internal/engine/branch_router.go
package engine

import (
	"context"
	"agentic-platform/backend/internal/models"
	"github.com/google/uuid"
)

type BranchRouter struct {
	evaluator *ConditionEvaluator
	loopGuard *LoopGuard
}

func NewBranchRouter(evaluator *ConditionEvaluator, maxLoops int) *BranchRouter {
	return &BranchRouter{
		evaluator: evaluator,
		loopGuard: NewLoopGuard(maxLoops),
	}
}

type BranchEvaluationResult struct {
	Edge        models.WorkflowEdge
	TargetNodeID uuid.UUID
	Matched     bool
	Reason      string
	IsSkipped   bool
}

func (br *BranchRouter) EvaluateOutgoingEdges(
	ctx context.Context,
	edges []models.WorkflowEdge,
	output string,
) ([]BranchEvaluationResult, error) {
	var results []BranchEvaluationResult
	hasMatchedSpecific := false

	for _, edge := range edges {
		if edge.ConditionType == "fallback" || edge.ConditionType == "else" {
			continue
		}

		matched, reason, err := br.evaluator.EvaluateCondition(ctx, edge, output)
		if err != nil {
			return nil, err
		}

		if matched {
			hasMatchedSpecific = true
		}

		results = append(results, BranchEvaluationResult{
			Edge:         edge,
			TargetNodeID: edge.TargetNodeID,
			Matched:      matched,
			Reason:       reason,
			IsSkipped:    !matched,
		})
	}

	// Handle fallback edges if no specific conditions matched
	for _, edge := range edges {
		if edge.ConditionType == "fallback" || edge.ConditionType == "else" {
			matched := !hasMatchedSpecific
			reason := "Fallback activated because no other branches matched"
			if !matched {
				reason = "Fallback skipped because a prior branch matched"
			}
			results = append(results, BranchEvaluationResult{
				Edge:         edge,
				TargetNodeID: edge.TargetNodeID,
				Matched:      matched,
				Reason:       reason,
				IsSkipped:    !matched,
			})
		}
	}

	return results, nil
}
```

- [ ] **Step 2: Run all engine package tests**

Run: `go test ./internal/engine -v` in `backend`
Expected: PASS

---

## Verification Plan

### Automated Verification
1. Run `go test ./internal/engine -v` to verify `ConditionEvaluator`, `LoopGuard`, and `BranchRouter`.
2. Verify all condition types (`always`, `contains`, `regex`, `llm_decision`, `fallback`) evaluate accurately.
