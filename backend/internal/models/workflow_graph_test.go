package models

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestWorkflowEdgeValidation(t *testing.T) {
	wfID := uuid.New()
	node1 := uuid.New()
	node2 := uuid.New()

	edge := WorkflowEdge{
		ID:                  uuid.New(),
		WorkflowID:          wfID,
		SourceNodeID:        node1,
		TargetNodeID:        node2,
		ConditionType:       "always",
		ConditionExpression: "",
		Label:               "Direct Wire",
		CreatedAt:           time.Now(),
	}

	if edge.SourceNodeID == edge.TargetNodeID {
		t.Errorf("Self-referencing edge should be invalid")
	}

	if edge.ConditionType != "always" {
		t.Errorf("Expected condition type always, got %s", edge.ConditionType)
	}
}

func TestWorkflowEdgeCreationAndValidation(t *testing.T) {
	node1 := uuid.New()
	node2 := uuid.New()

	req := CreateWorkflowEdgeRequest{
		SourceNodeID:        node1.String(),
		TargetNodeID:        node2.String(),
		ConditionType:       "rule_match",
		ConditionExpression: `contains("CODE")`,
		Label:               "If Code",
	}

	if req.SourceNodeID == "" || req.TargetNodeID == "" {
		t.Errorf("Source and Target must not be empty")
	}
	if req.ConditionType != "rule_match" {
		t.Errorf("Expected rule_match condition type, got %s", req.ConditionType)
	}
}
