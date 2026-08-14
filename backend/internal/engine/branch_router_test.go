package engine

import (
	"context"
	"testing"

	"agentic-platform/backend/internal/models"

	"github.com/google/uuid"
)

func TestBranchRouterEvaluation(t *testing.T) {
	evaluator := NewConditionEvaluator(nil)
	router := NewBranchRouter(evaluator, 5)

	target1 := uuid.New()
	target2 := uuid.New()
	targetFallback := uuid.New()

	edges := []models.WorkflowEdge{
		{
			ID:                  uuid.New(),
			SourceNodeID:        uuid.New(),
			TargetNodeID:        target1,
			ConditionType:       "rule_match",
			ConditionExpression: `contains("PAYMENT")`,
			Label:               "Payment Branch",
		},
		{
			ID:                  uuid.New(),
			SourceNodeID:        uuid.New(),
			TargetNodeID:        target2,
			ConditionType:       "rule_match",
			ConditionExpression: `contains("REFUND")`,
			Label:               "Refund Branch",
		},
		{
			ID:           uuid.New(),
			SourceNodeID: uuid.New(),
			TargetNodeID: targetFallback,
			ConditionType: "fallback",
			Label:        "General Inquiries",
		},
	}

	// Scenario 1: Output mentions PAYMENT
	resultsPayment, err := router.EvaluateOutgoingEdges(context.Background(), edges, "User is asking for PAYMENT invoice receipt")
	if err != nil {
		t.Fatalf("Unexpected error evaluating branches: %v", err)
	}

	if len(resultsPayment) != 3 {
		t.Fatalf("Expected 3 branch evaluation results, got %d", len(resultsPayment))
	}

	if !resultsPayment[0].Matched || resultsPayment[0].IsSkipped {
		t.Errorf("Expected Payment branch to match and not be skipped")
	}
	if resultsPayment[1].Matched || !resultsPayment[1].IsSkipped {
		t.Errorf("Expected Refund branch to not match and be skipped")
	}
	if resultsPayment[2].Matched || !resultsPayment[2].IsSkipped {
		t.Errorf("Expected Fallback branch to be skipped since Payment branch matched")
	}

	// Scenario 2: Output mentions unknown topic -> Fallback should match
	resultsFallback, err := router.EvaluateOutgoingEdges(context.Background(), edges, "User asking for general company address")
	if err != nil {
		t.Fatalf("Unexpected error evaluating branches: %v", err)
	}

	if resultsFallback[0].Matched || !resultsFallback[0].IsSkipped {
		t.Errorf("Payment branch should be skipped")
	}
	if resultsFallback[1].Matched || !resultsFallback[1].IsSkipped {
		t.Errorf("Refund branch should be skipped")
	}
	if !resultsFallback[2].Matched || resultsFallback[2].IsSkipped {
		t.Errorf("Fallback branch should be active when no other branch matched")
	}
}
