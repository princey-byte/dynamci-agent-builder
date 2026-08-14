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
	if evaluator == nil {
		evaluator = NewConditionEvaluator(nil)
	}
	return &BranchRouter{
		evaluator: evaluator,
		loopGuard: NewLoopGuard(maxLoops),
	}
}

type BranchEvaluationResult struct {
	Edge         models.WorkflowEdge
	TargetNodeID uuid.UUID
	Matched      bool
	Reason       string
	IsSkipped    bool
}

func (br *BranchRouter) EvaluateOutgoingEdges(
	ctx context.Context,
	edges []models.WorkflowEdge,
	output string,
) ([]BranchEvaluationResult, error) {
	var results []BranchEvaluationResult
	hasMatchedSpecific := false

	// Evaluate non-fallback edges first
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

	// Handle fallback / else edges
	for _, edge := range edges {
		if edge.ConditionType == "fallback" || edge.ConditionType == "else" {
			matched := !hasMatchedSpecific
			reason := "Fallback activated because no specific branch matched"
			if !matched {
				reason = "Fallback skipped because a specific branch matched"
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
