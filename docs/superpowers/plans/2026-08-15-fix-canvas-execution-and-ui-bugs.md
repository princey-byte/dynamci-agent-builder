# Bug Fix & Workflow Studio Session Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 4 reported runtime bugs and fulfill the workflow design/log persistence requirement:
1. **React Flow Parent Container 0-Height Error** (`error#004`): Fix layout and container dimensions across `DashboardContent.tsx`, `WorkflowBuilder.tsx`, and `WorkflowCanvas.tsx`.
2. **SSE Execution Stream Fix**: Allow `startExecution(query, overrideWorkflowId)` to directly consume newly auto-saved workflow IDs without empty ID race conditions.
3. **Foreign Key Constraint on Workflow Delete**: Add cascading delete in `WorkflowRepository.Delete` for `execution_sessions` and `session_logs`.
4. **Clean Edge Lines & Remove Middle Pill Animation**: Remove spinning/pulsing animation from the middle condition pill, make SVG edge wires solid, thick (`strokeWidth: 2.5`), and sharply visible.
5. **Workflow Studio Loading & History Persistence**:
   - Create `app/(dashboard)/workflows/[id]/page.tsx` to load existing workflows from PostgreSQL with exact graph topology, supervisor, worker nodes, and connecting condition edges.
   - Update `app/(dashboard)/workflows/page.tsx` so clicking any workflow opens the visual canvas studio.
   - Load the most recent session's execution logs and final output from PostgreSQL into the studio's console drawer so all logs are preserved across visits until the user clicks "Clear Logs".

---

## File Structure & Responsibilities

- `backend/internal/repository/workflow_repository.go`: Fix cascading delete for sessions and session logs on workflow deletion.
- `frontend/components/ui/DashboardContent.tsx`: Fix flex-1 full-height bounding for `/workflows/create` and `/workflows/[id]`.
- `frontend/components/workflows/builder/WorkflowCanvas.tsx`: Ensure full-height and full-width container sizing for React Flow.
- `frontend/components/workflows/builder/CustomConditionEdge.tsx`: Remove all spinning/pulsing animations from condition pill and apply solid, high-visibility SVG stroke colors.
- `frontend/hooks/useWorkflowExecution.ts`: Add `initialLogs` and support `startExecution(query, overrideWorkflowId)`.
- `frontend/components/workflows/builder/useWorkflowGraph.ts`: Ensure incoming saved workflow edges and nodes correctly initialize graph state.
- `frontend/components/workflows/WorkflowBuilder.tsx`: Accept `initialLogs` and `initialQuery`, coordinate auto-save and execution with latest ID.
- `frontend/app/(dashboard)/workflows/[id]/page.tsx`: Load workflow and latest session logs from PostgreSQL and mount the studio canvas.
- `frontend/app/(dashboard)/workflows/page.tsx`: Route workflow cards to `/workflows/[id]`.

---

### Task 1: Fix Foreign Key Cascade in Backend Repository

**Files:**
- Modify: `backend/internal/repository/workflow_repository.go`

- [ ] **Step 1: Update `WorkflowRepository.Delete` to delete dependent sessions and logs transactionally**

```go
func (r *WorkflowRepository) Delete(ctx context.Context, id uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Delete session logs for sessions belonging to this workflow
	_, _ = tx.Exec(ctx, `
		DELETE FROM session_logs 
		WHERE session_id IN (SELECT id FROM execution_sessions WHERE workflow_id = $1)
	`, id)

	// Delete execution sessions for this workflow
	_, _ = tx.Exec(ctx, `DELETE FROM execution_sessions WHERE workflow_id = $1`, id)

	// Delete workflow edges and nodes
	_, _ = tx.Exec(ctx, `DELETE FROM workflow_edges WHERE workflow_id = $1`, id)
	_, _ = tx.Exec(ctx, `DELETE FROM workflow_nodes WHERE workflow_id = $1`, id)

	// Delete workflow
	_, err = tx.Exec(ctx, `DELETE FROM workflows WHERE id = $1`, id)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}
```

---

### Task 2: Fix Edge Styling & Remove Middle Pill Animation

**Files:**
- Modify: `frontend/components/workflows/builder/CustomConditionEdge.tsx`

- [ ] **Step 1: Set solid, high-contrast SVG path stroke and static condition pill**

```tsx
// In CustomConditionEdge.tsx
export function CustomConditionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as WorkflowEdgeData | undefined;
  const conditionType = edgeData?.condition_type || 'always';
  const label = edgeData?.label || conditionType;
  const isTraversed = edgeData?.executionStatus === 'traversed';
  const isSkipped = edgeData?.executionStatus === 'skipped';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          strokeWidth: isTraversed ? 3 : selected ? 2.5 : 2,
          stroke: isTraversed
            ? 'hsl(var(--primary))'
            : isSkipped
            ? 'hsl(var(--muted-foreground) / 0.3)'
            : selected
            ? 'hsl(var(--primary))'
            : '#64748b',
          strokeDasharray: isSkipped ? '4 4' : undefined,
          ...style,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`group flex cursor-pointer items-center space-x-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-md backdrop-blur transition-all ${
            isTraversed
              ? 'border-primary bg-primary text-primary-foreground shadow-primary/20'
              : isSkipped
              ? 'border-border bg-background text-muted-foreground opacity-50'
              : selected
              ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/30'
              : 'border-border bg-card text-foreground hover:border-primary'
          }`}
        >
          <GitCommit className={`h-3.5 w-3.5 ${isTraversed || selected ? 'text-primary-foreground' : 'text-primary'}`} />
          <span className="font-bold">{label}</span>
          <span className={`text-[9px] uppercase tracking-wider ${isTraversed || selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
            ({conditionType})
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
```

---

### Task 3: Fix Container Dimensions & SSE Execution Hook Parameter

**Files:**
- Modify: `frontend/components/ui/DashboardContent.tsx`
- Modify: `frontend/components/workflows/builder/WorkflowCanvas.tsx`
- Modify: `frontend/hooks/useWorkflowExecution.ts`

- [ ] **Step 1: Update `DashboardContent.tsx` to handle `/workflows/create` and `/workflows/[id]`**
- [ ] **Step 2: Update `WorkflowCanvas.tsx` with explicit container bounds**
- [ ] **Step 3: Update `useWorkflowExecution.ts` to accept `initialLogs`, `initialOutput`, and `overrideWorkflowId` in `startExecution`**

---

### Task 4: Load Saved Workflows & Execution History in Studio Canvas

**Files:**
- Create: `frontend/app/(dashboard)/workflows/[id]/page.tsx`
- Modify: `frontend/app/(dashboard)/workflows/page.tsx`
- Modify: `frontend/components/workflows/builder/useWorkflowGraph.ts`
- Modify: `frontend/components/workflows/WorkflowBuilder.tsx`

- [ ] **Step 1: Initialize graph with saved workflow nodes and edges in `useWorkflowGraph.ts`**
- [ ] **Step 2: Create `app/(dashboard)/workflows/[id]/page.tsx` to fetch workflow and previous session logs from PostgreSQL**
- [ ] **Step 3: Update workflow card links in `app/(dashboard)/workflows/page.tsx` to point to `/workflows/${wf.id}`**
- [ ] **Step 4: Run full backend and frontend automated test suites and build checks**

---

## Verification Plan

### Automated Tests
1. `go test ./...` in `backend`
2. `npm run test:run` in `frontend`
3. `npm run build` in `frontend`
