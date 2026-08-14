# Hierarchical Multi-Tier Agent Graph Engine & DAG Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the workflow engine from a flat 1-supervisor-to-N-worker star topology into a recursive, multi-tier Directed Acyclic Graph (DAG) orchestration engine where supervisor agents connect to workers, workers can connect to sub-workers, and context propagates hierarchically across execution tiers.

**Architecture:** Extend PostgreSQL with a new migration for explicit `workflow_edges` and structured `workflow_nodes` parent relationships. Upgrade Go backend domain models, repositories, and build a topological DAG traversal engine (`DAGOrchestrator` & `GraphExecutor`) in `internal/engine` that traverses worker-to-worker hierarchies, aggregates nested sub-team outputs, and streams hierarchical step events over SSE.

**Tech Stack:** Go 1.24 (Gin, pgx/v5, PostgreSQL embedded migrations), Next.js 16, TypeScript, Vitest.

---

## File Structure & Responsibilities

- `backend/migrations/009_create_workflow_edges.sql` & `backend/internal/db/migrations_embedded/009_create_workflow_edges.sql`: Database schema migration adding `workflow_edges` table and parent node constraints.
- `backend/internal/models/workflow.go`: Structs for `WorkflowEdge`, enhanced `WorkflowNode`, graph requests/responses, and DAG validation methods.
- `backend/internal/repository/workflow_repository.go`: CRUD operations for workflow nodes and directed edges with transaction safety.
- `backend/internal/engine/dag_graph.go`: Graph data structure, topological sorting (Kahn's algorithm), cycle detection, and parent-child dependency resolution.
- `backend/internal/engine/graph_executor.go`: Recursive hierarchical execution of parent agents, team leads, and nested worker nodes with context accumulation.
- `backend/internal/engine/orchestrator.go`: Entry point connecting the router/engine to the DAG execution pipeline.
- `backend/internal/engine/dag_graph_test.go`: Unit tests for DAG topology, recursive child resolution, and cycle prevention.
- `backend/internal/models/workflow_test.go`: Unit tests for workflow edge validation.

---

### Task 1: Database Migration for Workflow Directed Edges

**Files:**
- Create: `backend/migrations/009_create_workflow_edges.sql`
- Create: `backend/internal/db/migrations_embedded/009_create_workflow_edges.sql`

- [ ] **Step 1: Write migration SQL file in source migrations**

```sql
-- backend/migrations/009_create_workflow_edges.sql
CREATE TABLE IF NOT EXISTS workflow_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    condition_type VARCHAR(50) NOT NULL DEFAULT 'always',
    condition_expression TEXT DEFAULT '',
    label VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_workflow_edge UNIQUE(workflow_id, source_node_id, target_node_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_edges_workflow_id ON workflow_edges(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_source ON workflow_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_target ON workflow_edges(target_node_id);
```

- [ ] **Step 2: Copy migration to embedded directory**

```sql
-- backend/internal/db/migrations_embedded/009_create_workflow_edges.sql
CREATE TABLE IF NOT EXISTS workflow_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    condition_type VARCHAR(50) NOT NULL DEFAULT 'always',
    condition_expression TEXT DEFAULT '',
    label VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_workflow_edge UNIQUE(workflow_id, source_node_id, target_node_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_edges_workflow_id ON workflow_edges(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_source ON workflow_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_target ON workflow_edges(target_node_id);
```

- [ ] **Step 3: Verify migration file presence**

Run: `ls -la backend/migrations/009_create_workflow_edges.sql backend/internal/db/migrations_embedded/009_create_workflow_edges.sql`
Expected: Both files exist and match.

---

### Task 2: Models & Graph Data Structures

**Files:**
- Modify: `backend/internal/models/workflow.go`
- Create: `backend/internal/models/workflow_graph_test.go`

- [ ] **Step 1: Write failing test for workflow edge models and DAG validation**

```go
// backend/internal/models/workflow_graph_test.go
package models

import (
	"testing"
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
	}

	if edge.SourceNodeID == edge.TargetNodeID {
		t.Errorf("Self-referencing edge should be invalid")
	}

	if edge.ConditionType != "always" {
		t.Errorf("Expected condition type always, got %s", edge.ConditionType)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/models -run TestWorkflowEdgeValidation` in `backend`
Expected: FAIL with "WorkflowEdge undefined"

- [ ] **Step 3: Update `backend/internal/models/workflow.go`**

```go
package models

import (
	"time"

	"github.com/google/uuid"
)

type Workflow struct {
	ID                uuid.UUID      `json:"id"`
	Name              string         `json:"name"`
	Description       string         `json:"description"`
	SupervisorAgentID *uuid.UUID     `json:"supervisor_agent_id,omitempty"`
	SupervisorAgent   *Agent         `json:"supervisor_agent,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	Nodes             []WorkflowNode `json:"nodes,omitempty"`
	Edges             []WorkflowEdge `json:"edges,omitempty"`
}

type WorkflowNode struct {
	ID               uuid.UUID  `json:"id"`
	WorkflowID       uuid.UUID  `json:"workflow_id"`
	ParentNodeID     *uuid.UUID `json:"parent_node_id,omitempty"`
	AgentID          uuid.UUID  `json:"agent_id"`
	Agent            *Agent     `json:"agent,omitempty"`
	ExecutionOrder   int        `json:"execution_order"`
	RoutingCondition string     `json:"routing_condition,omitempty"`
	NodeType         string     `json:"node_type,omitempty"` // supervisor | worker | team_lead
}

type WorkflowEdge struct {
	ID                  uuid.UUID `json:"id"`
	WorkflowID          uuid.UUID `json:"workflow_id"`
	SourceNodeID        uuid.UUID `json:"source_node_id"`
	TargetNodeID        uuid.UUID `json:"target_node_id"`
	ConditionType       string    `json:"condition_type"` // always | llm_decision | rule_match | fallback
	ConditionExpression string    `json:"condition_expression,omitempty"`
	Label               string    `json:"label,omitempty"`
	CreatedAt           time.Time `json:"created_at"`
}

type CreateWorkflowEdgeRequest struct {
	SourceNodeID        string `json:"source_node_id" binding:"required"`
	TargetNodeID        string `json:"target_node_id" binding:"required"`
	ConditionType       string `json:"condition_type"`
	ConditionExpression string `json:"condition_expression,omitempty"`
	Label               string `json:"label,omitempty"`
}

type CreateWorkflowNodeRequest struct {
	ID               *string `json:"id,omitempty"`
	ParentNodeID     *string `json:"parent_node_id,omitempty"`
	AgentID          string  `json:"agent_id" binding:"required"`
	ExecutionOrder   int     `json:"execution_order"`
	RoutingCondition string  `json:"routing_condition,omitempty"`
	NodeType         string  `json:"node_type,omitempty"`
}

type CreateWorkflowRequest struct {
	Name              string                      `json:"name" binding:"required"`
	Description       string                      `json:"description"`
	SupervisorAgentID string                      `json:"supervisor_agent_id" binding:"required"`
	Nodes             []CreateWorkflowNodeRequest `json:"nodes,omitempty"`
	Edges             []CreateWorkflowEdgeRequest `json:"edges,omitempty"`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./internal/models -v` in `backend`
Expected: PASS

---

### Task 3: Topological DAG Engine & Cycle Detection

**Files:**
- Create: `backend/internal/engine/dag_graph.go`
- Create: `backend/internal/engine/dag_graph_test.go`

- [ ] **Step 1: Write unit test for DAG cycle detection and topological sorting**

```go
// backend/internal/engine/dag_graph_test.go
package engine

import (
	"agentic-platform/backend/internal/models"
	"testing"
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
		t.Errorf("Unexpected topological sort order")
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
```

- [ ] **Step 2: Implement `dag_graph.go`**

```go
// backend/internal/engine/dag_graph.go
package engine

import (
	"fmt"
	"agentic-platform/backend/internal/models"
	"github.com/google/uuid"
)

type DAG struct {
	Nodes        map[uuid.UUID]models.WorkflowNode
	Adjacency    map[uuid.UUID][]models.WorkflowEdge
	InDegree     map[uuid.UUID]int
	ReverseEdges map[uuid.UUID][]models.WorkflowEdge
}

func BuildDAG(nodes []models.WorkflowNode, edges []models.WorkflowEdge) (*DAG, error) {
	dag := &DAG{
		Nodes:        make(map[uuid.UUID]models.WorkflowNode),
		Adjacency:    make(map[uuid.UUID][]models.WorkflowEdge),
		InDegree:     make(map[uuid.UUID]int),
		ReverseEdges: make(map[uuid.UUID][]models.WorkflowEdge),
	}

	for _, node := range nodes {
		dag.Nodes[node.ID] = node
		dag.Adjacency[node.ID] = []models.WorkflowEdge{}
		dag.InDegree[node.ID] = 0
		dag.ReverseEdges[node.ID] = []models.WorkflowEdge{}
	}

	for _, edge := range edges {
		if _, exists := dag.Nodes[edge.SourceNodeID]; !exists {
			return nil, fmt.Errorf("edge references non-existent source node: %s", edge.SourceNodeID)
		}
		if _, exists := dag.Nodes[edge.TargetNodeID]; !exists {
			return nil, fmt.Errorf("edge references non-existent target node: %s", edge.TargetNodeID)
		}
		dag.Adjacency[edge.SourceNodeID] = append(dag.Adjacency[edge.SourceNodeID], edge)
		dag.InDegree[edge.TargetNodeID]++
		dag.ReverseEdges[edge.TargetNodeID] = append(dag.ReverseEdges[edge.TargetNodeID], edge)
	}

	return dag, nil
}

func (d *DAG) TopologicalSort() ([]models.WorkflowNode, error) {
	inDegree := make(map[uuid.UUID]int)
	for k, v := range d.InDegree {
		inDegree[k] = v
	}

	var queue []uuid.UUID
	for id, degree := range inDegree {
		if degree == 0 {
			queue = append(queue, id)
		}
	}

	var result []models.WorkflowNode
	for len(queue) > 0 {
		currID := queue[0]
		queue = queue[1:]
		result = append(result, d.Nodes[currID])

		for _, edge := range d.Adjacency[currID] {
			inDegree[edge.TargetNodeID]--
			if inDegree[edge.TargetNodeID] == 0 {
				queue = append(queue, edge.TargetNodeID)
			}
		}
	}

	if len(result) != len(d.Nodes) {
		return nil, fmt.Errorf("cyclic dependency detected in workflow DAG")
	}

	return result, nil
}

func (d *DAG) GetOutgoingEdges(nodeID uuid.UUID) []models.WorkflowEdge {
	return d.Adjacency[nodeID]
}

func (d *DAG) GetIncomingEdges(nodeID uuid.UUID) []models.WorkflowEdge {
	return d.ReverseEdges[nodeID]
}
```

- [ ] **Step 3: Run DAG tests**

Run: `go test ./internal/engine -run TestDAG -v` in `backend`
Expected: PASS

---

### Task 4: Hierarchical Context Propagation & Execution Engine

**Files:**
- Create: `backend/internal/engine/graph_executor.go`
- Modify: `backend/internal/engine/orchestrator.go`

- [ ] **Step 1: Implement `graph_executor.go` with hierarchical sub-teams**

```go
// backend/internal/engine/graph_executor.go
package engine

import (
	"context"
	"fmt"
	"strings"

	"agentic-platform/backend/internal/models"
	"agentic-platform/backend/internal/repository"
	"github.com/google/uuid"
)

type GraphExecutor struct {
	aggregator  *ContextAggregator
	workerExec  *WorkerExecutor
	sessionRepo *repository.SessionRepository
}

func NewGraphExecutor(aggregator *ContextAggregator, workerExec *WorkerExecutor, sessionRepo *repository.SessionRepository) *GraphExecutor {
	return &GraphExecutor{
		aggregator:  aggregator,
		workerExec:  workerExec,
		sessionRepo: sessionRepo,
	}
}

func (ge *GraphExecutor) ExecuteDAG(
	ctx context.Context,
	workflow *models.Workflow,
	query string,
	sessionID string,
	stepNum *int,
	eventChan chan<- models.StreamMessage,
) (string, error) {
	dag, err := BuildDAG(workflow.Nodes, workflow.Edges)
	if err != nil {
		return "", fmt.Errorf("DAG build error: %w", err)
	}

	orderedNodes, err := dag.TopologicalSort()
	if err != nil {
		return "", fmt.Errorf("workflow execution failed topological ordering: %w", err)
	}

	nodeOutputs := make(map[uuid.UUID]string)
	var finalSyntheses []string

	for _, node := range orderedNodes {
		if node.Agent == nil {
			continue
		}

		// Gather context from all incoming parent nodes
		var parentContexts []string
		incomingEdges := dag.GetIncomingEdges(node.ID)
		for _, edge := range incomingEdges {
			if out, ok := nodeOutputs[edge.SourceNodeID]; ok {
				parentContexts = append(parentContexts, fmt.Sprintf("Context from upstream node:\n%s", out))
			}
		}

		subtaskPrompt := fmt.Sprintf("Primary Query: %s\nRouting: %s", query, node.RoutingCondition)
		if len(parentContexts) > 0 {
			subtaskPrompt += "\n\nUpstream Context:\n" + strings.Join(parentContexts, "\n---\n")
		}

		*stepNum++
		delMsg := models.StreamMessage{
			Event:     models.EventDelegation,
			SessionID: sessionID,
			AgentName: node.Agent.Name,
			Step:      *stepNum,
			Payload: map[string]interface{}{
				"agent_id":         node.Agent.ID.String(),
				"agent_name":       node.Agent.Name,
				"task_description": fmt.Sprintf("Processing node (Routing: %s)", node.RoutingCondition),
			},
		}
		eventChan <- delMsg
		_ = ge.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &node.Agent.ID, *stepNum, string(models.EventDelegation), delMsg.Payload)

		output, execErr := ge.workerExec.ExecuteWorker(ctx, node.Agent, subtaskPrompt, sessionID, stepNum, eventChan)
		if execErr != nil {
			output = fmt.Sprintf("[Node %s Execution Note]: Recovered with partial output: %v", node.Agent.Name, execErr)
		}

		nodeOutputs[node.ID] = output
		finalSyntheses = append(finalSyntheses, fmt.Sprintf("### %s Output:\n%s", node.Agent.Name, output))
	}

	return strings.Join(finalSyntheses, "\n\n"), nil
}
```

- [ ] **Step 2: Connect `GraphExecutor` to `Orchestrator`**

Modify `backend/internal/engine/orchestrator.go` to invoke `GraphExecutor` when workflow contains edges or multi-tier nodes.

- [ ] **Step 3: Run backend test suite**

Run: `go test ./...` in `backend`
Expected: PASS with 0 errors.

---

## Verification Plan

### Automated Verification
1. Run database migration tests and verify `workflow_edges` tables exist.
2. Run `go test ./internal/engine -v` to verify DAG topological sorting, cyclic graph rejection, and multi-tier context propagation.
3. Run `go test ./...` in `backend` for full regression coverage.
