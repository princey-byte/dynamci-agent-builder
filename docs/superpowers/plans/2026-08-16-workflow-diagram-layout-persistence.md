# Workflow Diagram Layout & Node Positions Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist custom visual canvas diagram layouts (exact `(x, y)` coordinates for Supervisor and Worker nodes, plus viewport metadata) in PostgreSQL when creating or updating workflows, and seamlessly restore the exact diagram layout when reloading or opening saved workflows.

**Architecture:**
- **Database & Migration:** Add migration `011_add_workflow_ui_schema_and_positions.sql` to add `ui_schema JSONB DEFAULT '{}'::jsonb` to `workflows` and `position_x DOUBLE PRECISION`, `position_y DOUBLE PRECISION` to `workflow_nodes`.
- **Backend Models & Repository:** 
  - Update `Workflow` model to include `UISchema json.RawMessage` and `WorkflowNode` with `PositionX`, `PositionY`.
  - Update `WorkflowRepository.Create`, `Update`, `GetByID`, and `List` to read and write `ui_schema` and node coordinates.
- **Frontend Graph & Studio:**
  - Update `useWorkflowGraph.ts` to initialize `nodeLayouts` from `initialWorkflow.ui_schema` and `initialNodes` position coordinates.
  - Update `WorkflowBuilder.tsx` and `useWorkflowStudio.ts` to include current `nodeLayouts` positions and canvas viewport in `ui_schema` during workflow draft saves.
  - Graceful fallback for legacy workflows (defaults to clean grid/dagre if `ui_schema` is empty).

**Tech Stack:** Go (Gin, pgx, PostgreSQL), Next.js 16 (App Router), React 19, TypeScript, React Flow (@xyflow/react), Vitest.

---

## File Structure & Responsibilities

```
backend/
├── migrations/
│   └── 011_add_workflow_ui_schema_and_positions.sql           # SQL migration
├── internal/
│   ├── db/
│   │   └── migrations_embedded/
│   │       └── 011_add_workflow_ui_schema_and_positions.sql   # Embedded migration
│   ├── models/
│   │   └── workflow.go                                        # Add UISchema & PositionX/Y to structs
│   └── repository/
│       └── workflow_repository.go                             # CRUD updates for layout & positions
frontend/
├── lib/
│   └── types.ts                                               # Extended Workflow & Node types with ui_schema
├── components/
│   └── workflows/
│       ├── WorkflowBuilder.tsx                                # Collect & pass node layouts on save
│       └── builder/
│           ├── useWorkflowGraph.ts                            # Initialize & restore saved node positions
│           ├── useWorkflowStudio.ts                           # Include ui_schema in saveWorkflowToDB payload
│           └── types.ts                                       # WorkflowUISchema interface
```

---

### Task 1: Database Migration & Backend Models

**Files:**
- Create: `backend/migrations/011_add_workflow_ui_schema_and_positions.sql`
- Create: `backend/internal/db/migrations_embedded/011_add_workflow_ui_schema_and_positions.sql`
- Modify: `backend/internal/models/workflow.go`

- [ ] **Step 1: Create SQL Migration `011_add_workflow_ui_schema_and_positions.sql` in both migration directories**

```sql
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS ui_schema JSONB DEFAULT '{}'::jsonb;
ALTER TABLE workflow_nodes ADD COLUMN IF NOT EXISTS position_x DOUBLE PRECISION DEFAULT 0;
ALTER TABLE workflow_nodes ADD COLUMN IF NOT EXISTS position_y DOUBLE PRECISION DEFAULT 0;
```

- [ ] **Step 2: Update `backend/internal/models/workflow.go`**

```go
type Workflow struct {
	ID                uuid.UUID       `json:"id"`
	Name              string          `json:"name"`
	Description       string          `json:"description"`
	SupervisorAgentID *uuid.UUID      `json:"supervisor_agent_id,omitempty"`
	SupervisorAgent   *Agent          `json:"supervisor_agent,omitempty"`
	UISchema          json.RawMessage `json:"ui_schema,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	Nodes             []WorkflowNode  `json:"nodes,omitempty"`
	Edges             []WorkflowEdge  `json:"edges,omitempty"`
}

type WorkflowNode struct {
	ID               uuid.UUID  `json:"id"`
	WorkflowID       uuid.UUID  `json:"workflow_id"`
	ParentNodeID     *uuid.UUID `json:"parent_node_id,omitempty"`
	AgentID          uuid.UUID  `json:"agent_id"`
	Agent            *Agent     `json:"agent,omitempty"`
	ExecutionOrder   int        `json:"execution_order"`
	RoutingCondition string     `json:"routing_condition,omitempty"`
	NodeType         string     `json:"node_type,omitempty"`
	PositionX        float64    `json:"position_x"`
	PositionY        float64    `json:"position_y"`
}

type CreateWorkflowNodeRequest struct {
	ID               *string  `json:"id,omitempty"`
	ParentNodeID     *string  `json:"parent_node_id,omitempty"`
	AgentID          string   `json:"agent_id" binding:"required"`
	ExecutionOrder   int      `json:"execution_order"`
	RoutingCondition string   `json:"routing_condition,omitempty"`
	NodeType         string   `json:"node_type,omitempty"`
	PositionX        *float64 `json:"position_x,omitempty"`
	PositionY        *float64 `json:"position_y,omitempty"`
}

type CreateWorkflowRequest struct {
	Name              string                      `json:"name" binding:"required"`
	Description       string                      `json:"description"`
	SupervisorAgentID string                      `json:"supervisor_agent_id" binding:"required"`
	UISchema          json.RawMessage             `json:"ui_schema,omitempty"`
	Nodes             []CreateWorkflowNodeRequest `json:"nodes,omitempty"`
	Edges             []CreateWorkflowEdgeRequest `json:"edges,omitempty"`
}
```

---

### Task 2: Backend Repository Implementation

**Files:**
- Modify: `backend/internal/repository/workflow_repository.go`

- [ ] **Step 1: Update `WorkflowRepository.Create`**
  - Insert `ui_schema` into `workflows` (`COALESCE($6, '{}'::jsonb)`).
  - Insert `position_x` and `position_y` into `workflow_nodes`.

- [ ] **Step 2: Update `WorkflowRepository.GetByID` & `List`**
  - Scan `ui_schema` on `workflows`.
  - Scan `COALESCE(position_x, 0)` and `COALESCE(position_y, 0)` on `workflow_nodes`.

- [ ] **Step 3: Update `WorkflowRepository.Update`**
  - Update `ui_schema = $3` on `workflows`.
  - Insert `position_x`, `position_y` when recreating `workflow_nodes`.

- [ ] **Step 4: Verify Backend Tests**
Run: `go test ./...` in `backend`
Expected: PASS 100%

---

### Task 3: Frontend Types & Graph Layout Restoration

**Files:**
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/components/workflows/builder/types.ts`
- Modify: `frontend/components/workflows/builder/useWorkflowGraph.ts`

- [ ] **Step 1: Update `frontend/lib/types.ts` & `frontend/components/workflows/builder/types.ts`**
  - Add `ui_schema?: { positions?: Record<string, { x: number; y: number }>; viewport?: { x: number; y: number; zoom: number } }` to `Workflow`.
  - Add `position_x?: number; position_y?: number;` to `WorkflowNode` and `SelectedWorker`.

- [ ] **Step 2: Update `useWorkflowGraph.ts` to restore saved positions**
  - In `useWorkflowGraph`:
    - Read `initialWorkflow?.ui_schema?.positions` (or `initialNodes`).
    - Initialize `nodeLayouts` state with the saved positions on mount:
      ```typescript
      useEffect(() => {
        if (initialWorkflow?.ui_schema?.positions) {
          const loadedLayouts: NodeLayoutMap = {};
          Object.entries(initialWorkflow.ui_schema.positions).forEach(([key, pos]) => {
            loadedLayouts[key] = { position: pos };
          });
          setNodeLayouts((prev) => ({ ...prev, ...loadedLayouts }));
        } else if (initialNodes && initialNodes.length > 0) {
          const loadedLayouts: NodeLayoutMap = {};
          initialNodes.forEach((n) => {
            if (n.position_x || n.position_y) {
              loadedLayouts[`worker-node-${n.agent_id}`] = {
                position: { x: n.position_x || 0, y: n.position_y || 0 },
              };
            }
          });
          setNodeLayouts((prev) => ({ ...prev, ...loadedLayouts }));
        }
      }, [initialWorkflow, initialNodes]);
      ```
    - Expose `nodeLayouts` from `useWorkflowGraph` so `WorkflowBuilder` can save the latest node positions.

---

### Task 4: Frontend Save Payload & Studio Synchronization

**Files:**
- Modify: `frontend/components/workflows/builder/useWorkflowStudio.ts`
- Modify: `frontend/components/workflows/WorkflowBuilder.tsx`
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Update `useWorkflowStudio.ts` & `api.ts`**
  - Update `saveWorkflowToDB` argument type to accept optional `ui_schema`.
  - Pass `ui_schema` to `api.createWorkflow` and `api.updateWorkflow`.

- [ ] **Step 2: Update `handleSaveDraft` in `WorkflowBuilder.tsx`**
  - Extract all current node coordinates:
    ```typescript
    const positionsMap: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => {
      positionsMap[n.id] = { x: n.position.x, y: n.position.y };
    });
    const uiSchema = {
      positions: positionsMap,
    };
    ```
  - Also populate `position_x` and `position_y` on each `selectedWorkers` item.
  - Pass `ui_schema` to `saveWorkflowToDB`.

---

### Task 5: Verification & Automated Tests

- [ ] **Step 1: Run frontend unit tests**
Run: `npm run test:run` in `frontend`
Expected: PASS 35/35

- [ ] **Step 2: Run frontend production build**
Run: `npm run build` in `frontend`
Expected: Next.js Turbopack compiles all 15 routes cleanly

- [ ] **Step 3: Run backend Go tests**
Run: `go test ./...` in `backend`
Expected: PASS 100%

---

## Edge Cases Handled

1. **Root Supervisor Node Coordinates**: The Root Supervisor node is preserved at the diagram level (`ui_schema.positions['sup-node']`), ensuring its dragged position is never lost.
2. **Backward Compatibility for Legacy Workflows**: Workflows saved prior to this feature have `ui_schema = {}`. The builder gracefully falls back to the default grid/dagre positions with zero errors.
3. **Auto-Layout Synchronization**: When the user clicks the "Auto-Layout" button in the top bar, dagre computes new neat positions, `setNodeLayouts` updates the canvas, and clicking "Save" stores the auto-arranged layout in PostgreSQL.
4. **Adding New Nodes to an Existing Layout**: Adding a new worker node assigns an initial offset coordinate, while existing nodes stay exactly where the user positioned them.
