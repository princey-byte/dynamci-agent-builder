package engine

import (
	"testing"

	"agentic-platform/backend/internal/models"

	"github.com/google/uuid"
)

func TestDAGTopologicalSorting(t *testing.T) {
	node1 := uuid.New()
	node2 := uuid.New()
	node3 := uuid.New()

	nodes := []models.WorkflowNode{
		{ID: node1, AgentID: uuid.New(), ExecutionOrder: 1},
		{ID: node2, AgentID: uuid.New(), ExecutionOrder: 2},
		{ID: node3, AgentID: uuid.New(), ExecutionOrder: 3},
	}

	edges := []models.WorkflowEdge{
		{SourceNodeID: node1, TargetNodeID: node2},
		{SourceNodeID: node2, TargetNodeID: node3},
	}

	dag, err := BuildDAG(nodes, edges)
	if err != nil {
		t.Fatalf("Failed to build DAG: %v", err)
	}

	sorted, err := dag.TopologicalSort()
	if err != nil {
		t.Fatalf("Expected valid topological sort, got error: %v", err)
	}

	if len(sorted) != 3 {
		t.Fatalf("Expected 3 sorted nodes, got %d", len(sorted))
	}
	if sorted[0].ID != node1 || sorted[1].ID != node2 || sorted[2].ID != node3 {
		t.Errorf("Unexpected topological sort order: %+v", sorted)
	}
}

func TestDAGCycleDetection(t *testing.T) {
	node1 := uuid.New()
	node2 := uuid.New()

	nodes := []models.WorkflowNode{
		{ID: node1, AgentID: uuid.New()},
		{ID: node2, AgentID: uuid.New()},
	}

	// Create cyclic edge
	edges := []models.WorkflowEdge{
		{SourceNodeID: node1, TargetNodeID: node2},
		{SourceNodeID: node2, TargetNodeID: node1},
	}

	dag, err := BuildDAG(nodes, edges)
	if err != nil {
		t.Fatalf("Failed to build DAG: %v", err)
	}

	_, err = dag.TopologicalSort()
	if err == nil {
		t.Errorf("Expected cycle detection error, got nil")
	}
}

func TestDAGWithDisconnectedAndMultiBranchNodes(t *testing.T) {
	root := uuid.New()
	branchA := uuid.New()
	branchB := uuid.New()
	joinNode := uuid.New()

	nodes := []models.WorkflowNode{
		{ID: root, AgentID: uuid.New()},
		{ID: branchA, AgentID: uuid.New()},
		{ID: branchB, AgentID: uuid.New()},
		{ID: joinNode, AgentID: uuid.New()},
	}

	edges := []models.WorkflowEdge{
		{SourceNodeID: root, TargetNodeID: branchA},
		{SourceNodeID: root, TargetNodeID: branchB},
		{SourceNodeID: branchA, TargetNodeID: joinNode},
		{SourceNodeID: branchB, TargetNodeID: joinNode},
	}

	dag, err := BuildDAG(nodes, edges)
	if err != nil {
		t.Fatalf("Failed to build multi-branch DAG: %v", err)
	}

	sorted, err := dag.TopologicalSort()
	if err != nil {
		t.Fatalf("Topological sort failed on diamond DAG: %v", err)
	}

	if len(sorted) != 4 {
		t.Fatalf("Expected 4 nodes, got %d", len(sorted))
	}

	if sorted[0].ID != root {
		t.Errorf("Expected root to be first, got %s", sorted[0].ID)
	}

	if sorted[3].ID != joinNode {
		t.Errorf("Expected joinNode to be last, got %s", sorted[3].ID)
	}
}
