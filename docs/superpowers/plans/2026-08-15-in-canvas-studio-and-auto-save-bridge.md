# Plan 1: Unified In-Canvas Studio Architecture & Auto-Save Execution Bridge

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the visual workflow builder into a live unified studio that enables one-click workflow execution directly from the canvas without page jumps. Automatically syncs and persists canvas nodes and edges to PostgreSQL before launching the SSE execution stream.

**Architecture:** Extend `frontend/lib/api.ts` with workflow update endpoints, upgrade `useWorkflowGraph` and `WorkflowBuilder` to support atomic auto-saving of topology to PostgreSQL (`api.createWorkflow` or `api.updateWorkflow`), and bridge directly into `useWorkflowExecution` SSE stream while maintaining active canvas context and updating the browser URL smoothly without reloading.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Go backend engine, PostgreSQL, Vitest.

---

## File Structure & Responsibilities

- `backend/internal/api/workflow_handler.go`: Add `UpdateWorkflow` endpoint to allow updating existing workflow nodes and edges without creating duplicates.
- `backend/internal/repository/workflow_repository.go`: Add `Update` method to overwrite nodes and edges transactionally for an existing workflow.
- `frontend/lib/api.ts`: Add `updateWorkflow(id, req)` method to frontend API client.
- `frontend/components/workflows/builder/WorkflowTopBar.tsx`: Add integrated `[ ▶ Run Workflow ]` button, execution status indicator, and query input trigger.
- `frontend/components/workflows/WorkflowBuilder.tsx`: Top-level studio orchestrating auto-save, live execution hook integration, and state coordination.
- `frontend/components/workflows/builder/useWorkflowStudio.ts`: Custom hook decoupling studio state, auto-save debounce, and execution lifecycle.

---

### Task 1: Backend Workflow Update Endpoint

**Files:**
- Modify: `backend/internal/repository/workflow_repository.go`
- Modify: `backend/internal/api/workflow_handler.go`
- Modify: `backend/internal/api/routes.go`

- [ ] **Step 1: Implement `Update` method in `workflow_repository.go`**

```go
func (r *WorkflowRepository) Update(ctx context.Context, id uuid.UUID, req models.CreateWorkflowRequest) (*models.Workflow, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Update base workflow metadata
	_, err = tx.Exec(ctx, `
		UPDATE workflows 
		SET name = $1, description = $2, supervisor_agent_id = $3
		WHERE id = $4
	`, req.Name, req.Description, req.SupervisorAgentID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to update workflow: %w", err)
	}

	// Delete old nodes and edges
	_, _ = tx.Exec(ctx, `DELETE FROM workflow_edges WHERE workflow_id = $1`, id)
	_, _ = tx.Exec(ctx, `DELETE FROM workflow_nodes WHERE workflow_id = $1`, id)

	// Insert updated nodes
	for _, n := range req.Nodes {
		nodeID := uuid.New()
		_, err = tx.Exec(ctx, `
			INSERT INTO workflow_nodes (id, workflow_id, agent_id, execution_order, routing_condition)
			VALUES ($1, $2, $3, $4, $5)
		`, nodeID, id, n.AgentID, n.ExecutionOrder, n.RoutingCondition)
		if err != nil {
			return nil, fmt.Errorf("failed to insert workflow node: %w", err)
		}
	}

	// Insert updated edges
	for _, e := range req.Edges {
		edgeID := uuid.New()
		_, err = tx.Exec(ctx, `
			INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, condition_type, condition_expression, label, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		`, edgeID, id, e.SourceNodeID, e.TargetNodeID, e.ConditionType, e.ConditionExpression, e.Label)
		if err != nil {
			return nil, fmt.Errorf("failed to insert workflow edge: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return r.GetByID(ctx, id)
}
```

- [ ] **Step 2: Add `UpdateWorkflow` handler and route in `workflow_handler.go` and `routes.go`**

```go
// In workflow_handler.go
func (h *WorkflowHandler) UpdateWorkflow(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workflow ID"})
		return
	}
	var req models.CreateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	wf, err := h.repo.Update(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, wf)
}

// In routes.go:
// v1.PUT("/workflows/:id", workflowHandler.UpdateWorkflow)
```

---

### Task 2: Frontend API Client & Studio Hook

**Files:**
- Modify: `frontend/lib/api.ts`
- Create: `frontend/components/workflows/builder/useWorkflowStudio.ts`

- [ ] **Step 1: Add `updateWorkflow` in `frontend/lib/api.ts`**

```typescript
async updateWorkflow(id: string, workflow: CreateWorkflowRequest): Promise<Workflow> {
  const res = await fetch(`${API_BASE}/workflows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update workflow: ${res.statusText}`);
  }
  return res.json();
},
```

- [ ] **Step 2: Create `useWorkflowStudio.ts` to manage auto-save and execution bridge**

```typescript
// frontend/components/workflows/builder/useWorkflowStudio.ts
import { useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import { SelectedWorker, CustomWorkflowEdge } from './types';
import { Workflow } from '../../../lib/types';

interface SaveAndRunParams {
  workflowId: string | null;
  workflowName: string;
  description: string;
  supervisorId: string;
  workers: SelectedWorker[];
  edges: CustomWorkflowEdge[];
  query: string;
}

export function useWorkflowStudio() {
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);

  const saveWorkflowToDB = useCallback(async ({
    workflowId,
    workflowName,
    description,
    supervisorId,
    workers,
    edges,
  }: Omit<SaveAndRunParams, 'query'>): Promise<Workflow> => {
    setIsSaving(true);
    setStudioError(null);

    const formattedEdges = edges.map((e) => ({
      source_node_id: e.source.replace('worker-node-', '').replace('sup-node', supervisorId),
      target_node_id: e.target.replace('worker-node-', ''),
      condition_type: e.condition_type || 'always',
      condition_expression: e.condition_expression || '',
      label: e.label || '',
    }));

    const payload = {
      name: workflowName || 'Untitled Workflow',
      description,
      supervisor_agent_id: supervisorId,
      nodes: workers,
      edges: formattedEdges,
    };

    try {
      let saved: Workflow;
      if (workflowId) {
        saved = await api.updateWorkflow(workflowId, payload);
      } else {
        saved = await api.createWorkflow(payload);
        setActiveWorkflowId(saved.id);
        window.history.replaceState(null, '', `/workflows/${saved.id}/edit`);
      }
      return saved;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save workflow';
      setStudioError(msg);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    activeWorkflowId,
    setActiveWorkflowId,
    isSaving,
    studioError,
    setStudioError,
    saveWorkflowToDB,
  };
}
```

---

### Task 3: Studio Top Bar & Run Action Integration

**Files:**
- Modify: `frontend/components/workflows/builder/WorkflowTopBar.tsx`
- Modify: `frontend/components/workflows/WorkflowBuilder.tsx`

- [ ] **Step 1: Add Run Action to `WorkflowTopBar.tsx`**
- [ ] **Step 2: Wire Execution Trigger in `WorkflowBuilder.tsx`**
- [ ] **Step 3: Run backend and frontend verification tests**

---

## Verification Plan

### Automated Tests
1. Backend: `go test ./internal/api ./internal/repository`
2. Frontend: `npm run test:run`
3. Frontend Build: `npm run build`
