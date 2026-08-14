# Workflow Builder Fullscreen Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-available-page workflow creation experience with a large draggable React Flow canvas, modular workflow builder components, and strict supervisor/worker role validation.

**Architecture:** Use the Next.js App Router layout as the page frame and add a route-aware dashboard content wrapper so `/workflows/create` can opt out of the normal padded/max-width content shell without hardcoding sidebar width. Split the workflow builder into focused client modules: canvas, controls panel, custom nodes, and graph-state hook. Enforce supervisor/worker role rules in both frontend filtering and backend workflow creation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 tokens, `@xyflow/react`, Go backend, Gin API, PostgreSQL repositories.

---

## Review Result

The first plan covered the user-visible requirements, but it was not modular enough and used brittle layout mechanics. This revised plan fixes those issues.

Changes from the earlier plan:

- Avoid hardcoded `fixed left-64`; create a route-aware dashboard content wrapper instead.
- Avoid one large `WorkflowBuilder.tsx`; split into focused workflow builder modules.
- Avoid syncing React Flow nodes with `useEffect` state resets; use a position map and derived nodes so dragging persists across form edits.
- Keep App Router conventions: page remains a small route component, client interactivity is isolated in client components.
- Keep backend role validation as a separate pure model helper plus repository enforcement.

---

## File Structure

**Dashboard layout**
- Create: `frontend/components/ui/DashboardContent.tsx`
  - Client wrapper that uses `usePathname()` to let `/workflows/create` use full available dashboard space.
- Modify: `frontend/app/(dashboard)/layout.tsx`
  - Replace inline `<main>` wrapper with `DashboardContent`.

**Workflow builder frontend modules**
- Create: `frontend/components/workflows/builder/types.ts`
  - Shared builder types.
- Create: `frontend/components/workflows/builder/WorkflowNodes.tsx`
  - Custom React Flow node components.
- Create: `frontend/components/workflows/builder/useWorkflowGraph.ts`
  - Role-filtered graph state, selected workers, stable node positions, edges, and save payload helpers.
- Create: `frontend/components/workflows/builder/WorkflowCanvas.tsx`
  - Fullscreen React Flow canvas.
- Create: `frontend/components/workflows/builder/WorkflowControlsPanel.tsx`
  - Overlay controls for workflow metadata, supervisor selection, worker selection, and routing conditions.
- Modify: `frontend/components/workflows/WorkflowBuilder.tsx`
  - Slim orchestration component that composes the new modules.
- Modify: `frontend/app/(dashboard)/workflows/create/page.tsx`
  - Keep agent loading route logic small and render the builder.

**Backend validation**
- Create: `backend/internal/models/workflow_validation.go`
  - Pure role validation helper.
- Create: `backend/internal/models/workflow_validation_test.go`
  - Unit tests for supervisor and worker role rules.
- Modify: `backend/internal/repository/workflow_repository.go`
  - Validate selected supervisor and worker roles before inserting workflow rows.

---

### Task 1: Add Backend Workflow Role Validation

**Files:**
- Create: `backend/internal/models/workflow_validation_test.go`
- Create: `backend/internal/models/workflow_validation.go`
- Modify: `backend/internal/repository/workflow_repository.go`

- [ ] **Step 1: Write failing validation tests**

Create `backend/internal/models/workflow_validation_test.go`:

```go
package models

import (
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestValidateWorkflowRolesAcceptsSupervisorAndWorkers(t *testing.T) {
	supervisor := &Agent{ID: uuid.New(), Name: "Supervisor", RoleType: RoleSupervisor}
	workers := []Agent{
		{ID: uuid.New(), Name: "Worker A", RoleType: RoleWorker},
		{ID: uuid.New(), Name: "Worker B", RoleType: RoleWorker},
	}

	if err := ValidateWorkflowRoles(supervisor, workers); err != nil {
		t.Fatalf("expected valid roles, got %v", err)
	}
}

func TestValidateWorkflowRolesRejectsWorkerSupervisor(t *testing.T) {
	supervisor := &Agent{ID: uuid.New(), Name: "Worker selected as supervisor", RoleType: RoleWorker}

	err := ValidateWorkflowRoles(supervisor, nil)
	if err == nil {
		t.Fatal("expected worker supervisor to be rejected")
	}
	if !strings.Contains(err.Error(), "supervisor agent must have role_type supervisor") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateWorkflowRolesRejectsSupervisorWorker(t *testing.T) {
	supervisor := &Agent{ID: uuid.New(), Name: "Supervisor", RoleType: RoleSupervisor}
	workers := []Agent{{ID: uuid.New(), Name: "Supervisor selected as worker", RoleType: RoleSupervisor}}

	err := ValidateWorkflowRoles(supervisor, workers)
	if err == nil {
		t.Fatal("expected supervisor worker to be rejected")
	}
	if !strings.Contains(err.Error(), "worker agent must have role_type worker") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateWorkflowRolesRejectsNilSupervisor(t *testing.T) {
	err := ValidateWorkflowRoles(nil, nil)
	if err == nil {
		t.Fatal("expected missing supervisor to be rejected")
	}
	if !strings.Contains(err.Error(), "supervisor agent is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend && go test ./internal/models -run 'TestValidateWorkflowRoles' -v
```

Expected: FAIL with `undefined: ValidateWorkflowRoles`.

- [ ] **Step 3: Add validation helper**

Create `backend/internal/models/workflow_validation.go`:

```go
package models

import "fmt"

func ValidateWorkflowRoles(supervisor *Agent, workers []Agent) error {
	if supervisor == nil {
		return fmt.Errorf("supervisor agent is required")
	}
	if supervisor.RoleType != RoleSupervisor {
		return fmt.Errorf("supervisor agent must have role_type supervisor, got %s", supervisor.RoleType)
	}

	for _, worker := range workers {
		if worker.RoleType != RoleWorker {
			return fmt.Errorf("worker agent must have role_type worker, got %s for %s", worker.RoleType, worker.Name)
		}
		if worker.ID == supervisor.ID {
			return fmt.Errorf("supervisor agent cannot also be a worker")
		}
	}

	return nil
}
```

- [ ] **Step 4: Enforce validation in repository create**

Modify `backend/internal/repository/workflow_repository.go` inside `Create`, immediately after parsing `supervisorID` and before `now := time.Now()`:

```go
	supervisor, err := r.agentRepo.GetByID(ctx, supervisorID)
	if err != nil {
		return nil, fmt.Errorf("supervisor agent not found: %w", err)
	}

	workerAgents := make([]models.Agent, 0, len(req.Nodes))
	for _, nodeReq := range req.Nodes {
		agentID, parseErr := uuid.Parse(nodeReq.AgentID)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid worker agent ID: %w", parseErr)
		}
		agent, agentErr := r.agentRepo.GetByID(ctx, agentID)
		if agentErr != nil {
			return nil, fmt.Errorf("worker agent not found: %w", agentErr)
		}
		workerAgents = append(workerAgents, *agent)
	}

	if err := models.ValidateWorkflowRoles(supervisor, workerAgents); err != nil {
		return nil, err
	}
```

In the existing node creation loop, replace:

```go
		agentID, parseErr := uuid.Parse(nodeReq.AgentID)
		if parseErr != nil {
			continue
		}
```

with:

```go
		agentID, parseErr := uuid.Parse(nodeReq.AgentID)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid worker agent ID: %w", parseErr)
		}
```

- [ ] **Step 5: Run backend tests**

Run:

```bash
cd backend && go test ./internal/models ./internal/repository ./... -v
```

Expected: PASS.

---

### Task 2: Add Route-Aware Dashboard Content Wrapper

**Files:**
- Create: `frontend/components/ui/DashboardContent.tsx`
- Modify: `frontend/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create route-aware content wrapper**

Create `frontend/components/ui/DashboardContent.tsx`:

```tsx
'use client';

import { usePathname } from 'next/navigation';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreenWorkflowBuilder = pathname === '/workflows/create';

  if (isFullscreenWorkflowBuilder) {
    return (
      <main className="flex-1 overflow-hidden bg-background">
        <div className="h-screen min-h-0">{children}</div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-7xl">{children}</div>
    </main>
  );
}
```

- [ ] **Step 2: Use wrapper in dashboard layout**

Modify `frontend/app/(dashboard)/layout.tsx`:

```tsx
import { Sidebar } from '../../components/ui/Sidebar';
import { DashboardContent } from '../../components/ui/DashboardContent';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#090d16] text-slate-100">
      <Sidebar />
      <DashboardContent>{children}</DashboardContent>
    </div>
  );
}
```

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS.

---

### Task 3: Add Modular Workflow Builder Types And Nodes

**Files:**
- Create: `frontend/components/workflows/builder/types.ts`
- Create: `frontend/components/workflows/builder/WorkflowNodes.tsx`

- [ ] **Step 1: Add shared builder types**

Create `frontend/components/workflows/builder/types.ts`:

```ts
import { Agent } from '../../../lib/types';

export interface SelectedWorker {
  agent_id: string;
  execution_order: number;
  routing_condition: string;
}

export interface SupervisorNodeData extends Record<string, unknown> {
  agent: Agent;
}

export interface WorkerNodeData extends Record<string, unknown> {
  agent: Agent;
  order: number;
  routing?: string;
}
```

- [ ] **Step 2: Add custom React Flow nodes**

Create `frontend/components/workflows/builder/WorkflowNodes.tsx`:

```tsx
import { Handle, Position } from '@xyflow/react';
import { Bot } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { SupervisorNodeData, WorkerNodeData } from './types';

export function SupervisorNode({ data }: { data: SupervisorNodeData }) {
  return (
    <div className="w-72 rounded-2xl border-2 border-indigo-500 bg-background-surface p-5 shadow-2xl shadow-indigo-950/40">
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-indigo-500" />
      <div className="mb-3 flex items-center space-x-2">
        <Bot className="h-5 w-5 text-indigo-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Supervisor</span>
      </div>
      <div className="text-base font-semibold text-slate-100">{data.agent.name}</div>
      <div className="mt-3 flex items-center space-x-2">
        <Badge variant="supervisor">Supervisor</Badge>
        <Badge variant={data.agent.model_provider as 'openai' | 'azure_openai' | 'anthropic' | 'gemini'}>{data.agent.model_name}</Badge>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !bg-indigo-500" />
    </div>
  );
}

export function WorkerNode({ data }: { data: WorkerNodeData }) {
  return (
    <div className="w-72 rounded-2xl border border-cyan-800/80 bg-background-surface p-5 shadow-xl shadow-cyan-950/20">
      <Handle type="target" position={Position.Top} className="!h-3 !w-3 !bg-cyan-400" />
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Bot className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold text-cyan-300">Worker Node #{data.order}</span>
        </div>
      </div>
      <div className="text-sm font-semibold text-slate-100">{data.agent.name}</div>
      {data.routing && (
        <div className="mt-2 rounded border border-border-subtle bg-background p-2 font-mono text-[11px] text-slate-400">
          Condition: {data.routing}
        </div>
      )}
      <div className="mt-3 flex items-center space-x-2">
        <Badge variant="worker">Worker</Badge>
        <Badge variant={data.agent.model_provider as 'openai' | 'azure_openai' | 'anthropic' | 'gemini'}>{data.agent.model_name}</Badge>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS.

---

### Task 4: Add Graph State Hook With Stable Drag Positions

**Files:**
- Create: `frontend/components/workflows/builder/useWorkflowGraph.ts`

- [ ] **Step 1: Create graph state hook**

Create `frontend/components/workflows/builder/useWorkflowGraph.ts`:

```ts
'use client';

import { useCallback, useMemo, useState } from 'react';
import { Edge, Node, NodeChange, OnNodesChange, XYPosition } from '@xyflow/react';
import { Agent } from '../../../lib/types';
import { SelectedWorker, SupervisorNodeData, WorkerNodeData } from './types';

type PositionMap = Record<string, XYPosition>;

interface UseWorkflowGraphArgs {
  availableAgents: Agent[];
  selectedSupervisorID: string;
  selectedWorkers: SelectedWorker[];
}

export function useWorkflowGraph({ availableAgents, selectedSupervisorID, selectedWorkers }: UseWorkflowGraphArgs) {
  const [nodePositions, setNodePositions] = useState<PositionMap>({});

  const supervisors = useMemo(
    () => availableAgents.filter((agent) => agent.role_type === 'supervisor'),
    [availableAgents]
  );

  const workers = useMemo(
    () => availableAgents.filter((agent) => agent.role_type === 'worker'),
    [availableAgents]
  );

  const selectedWorkerIDs = useMemo(
    () => new Set(selectedWorkers.map((worker) => worker.agent_id)),
    [selectedWorkers]
  );

  const availableWorkerOptions = useMemo(
    () => workers.filter((worker) => !selectedWorkerIDs.has(worker.id)),
    [workers, selectedWorkerIDs]
  );

  const nodes = useMemo<Node<SupervisorNodeData | WorkerNodeData>[]>(() => {
    const supervisor = availableAgents.find((agent) => agent.id === selectedSupervisorID);
    const nextNodes: Node<SupervisorNodeData | WorkerNodeData>[] = [];

    if (supervisor) {
      nextNodes.push({
        id: 'sup-node',
        type: 'supervisorNode',
        position: nodePositions['sup-node'] || { x: 520, y: 160 },
        data: { agent: supervisor },
      });
    }

    selectedWorkers.forEach((worker, index) => {
      const workerAgent = availableAgents.find((agent) => agent.id === worker.agent_id);
      if (!workerAgent) return;
      const nodeID = `worker-node-${worker.agent_id}`;
      nextNodes.push({
        id: nodeID,
        type: 'workerNode',
        position: nodePositions[nodeID] || { x: 260 + (index % 3) * 340, y: 460 + Math.floor(index / 3) * 230 },
        data: { agent: workerAgent, order: worker.execution_order, routing: worker.routing_condition },
      });
    });

    return nextNodes;
  }, [availableAgents, selectedSupervisorID, selectedWorkers, nodePositions]);

  const edges = useMemo<Edge[]>(
    () =>
      selectedWorkers.map((worker) => ({
        id: `e-sup-worker-${worker.agent_id}`,
        source: 'sup-node',
        target: `worker-node-${worker.agent_id}`,
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
      })),
    [selectedWorkers]
  );

  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    setNodePositions((currentPositions) => {
      let changed = false;
      const nextPositions = { ...currentPositions };

      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          nextPositions[change.id] = change.position;
          changed = true;
        }
      }

      return changed ? nextPositions : currentPositions;
    });
  }, []);

  return {
    supervisors,
    workers,
    availableWorkerOptions,
    nodes,
    edges,
    onNodesChange,
  };
}
```

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS.

---

### Task 5: Add Modular Canvas And Controls Panel

**Files:**
- Create: `frontend/components/workflows/builder/WorkflowCanvas.tsx`
- Create: `frontend/components/workflows/builder/WorkflowControlsPanel.tsx`

- [ ] **Step 1: Create canvas component**

Create `frontend/components/workflows/builder/WorkflowCanvas.tsx`:

```tsx
'use client';

import { Background, Controls, Edge, Node, OnNodesChange, ReactFlow } from '@xyflow/react';
import { useMemo } from 'react';
import { SupervisorNode, WorkerNode } from './WorkflowNodes';
import { SupervisorNodeData, WorkerNodeData } from './types';

interface WorkflowCanvasProps {
  nodes: Node<SupervisorNodeData | WorkerNodeData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
}

export function WorkflowCanvas({ nodes, edges, onNodesChange }: WorkflowCanvasProps) {
  const nodeTypes = useMemo(
    () => ({
      supervisorNode: SupervisorNode,
      workerNode: WorkerNode,
    }),
    []
  );

  return (
    <section className="absolute inset-0 pt-[57px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.25}
        maxZoom={1.5}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        className="bg-background"
      >
        <Background color="#1e293b" gap={20} />
        <Controls />
      </ReactFlow>
    </section>
  );
}
```

- [ ] **Step 2: Create controls panel component**

Create `frontend/components/workflows/builder/WorkflowControlsPanel.tsx`:

```tsx
'use client';

import { Agent } from '../../../lib/types';
import { SelectedWorker } from './types';

interface WorkflowControlsPanelProps {
  workflowName: string;
  description: string;
  selectedSupervisorID: string;
  selectedWorkers: SelectedWorker[];
  supervisors: Agent[];
  workers: Agent[];
  availableWorkerOptions: Agent[];
  availableAgents: Agent[];
  onWorkflowNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSupervisorChange: (value: string) => void;
  onAddWorker: (agentID: string) => void;
  onRemoveWorker: (index: number) => void;
  onWorkerRoutingChange: (index: number, value: string) => void;
}

export function WorkflowControlsPanel({
  workflowName,
  description,
  selectedSupervisorID,
  selectedWorkers,
  supervisors,
  workers,
  availableWorkerOptions,
  availableAgents,
  onWorkflowNameChange,
  onDescriptionChange,
  onSupervisorChange,
  onAddWorker,
  onRemoveWorker,
  onWorkerRoutingChange,
}: WorkflowControlsPanelProps) {
  return (
    <aside className="absolute bottom-5 left-5 top-20 z-20 w-[min(360px,calc(100vw-2.5rem))] overflow-y-auto rounded-xl border border-border-subtle bg-background-surface/95 p-4 shadow-2xl backdrop-blur">
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">Workflow</p>
          <h1 className="mt-1 text-lg font-bold text-slate-100">Build agent topology</h1>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">Workflow Name</label>
            <input
              type="text"
              required
              placeholder="e.g. PR Automated Security Audit Team"
              value={workflowName}
              onChange={(event) => onWorkflowNameChange(event.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">Description</label>
            <textarea
              rows={3}
              placeholder="What should this workflow coordinate?"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              className="w-full resize-none rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">Supervisor Agent</label>
            <select
              value={selectedSupervisorID}
              onChange={(event) => onSupervisorChange(event.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">-- Choose Supervisor --</option>
              {supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.name} ({supervisor.model_provider} / {supervisor.model_name})
                </option>
              ))}
            </select>
            {supervisors.length === 0 && (
              <p className="mt-2 text-xs text-amber-300">Create an agent with role_type supervisor before saving a workflow.</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">Add Worker Agent</label>
            <select
              id="worker-picker"
              className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              onChange={(event) => {
                if (event.target.value) {
                  onAddWorker(event.target.value);
                  event.target.value = '';
                }
              }}
            >
              <option value="">+ Connect Worker Agent</option>
              {availableWorkerOptions.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} ({worker.model_name})
                </option>
              ))}
            </select>
            {workers.length === 0 && (
              <p className="mt-2 text-xs text-amber-300">Create worker agents before adding workflow nodes.</p>
            )}
          </div>
        </div>

        {selectedWorkers.length > 0 && (
          <div className="space-y-3 border-t border-border-subtle pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Worker Routing</h3>
            {selectedWorkers.map((worker, index) => {
              const agent = availableAgents.find((item) => item.id === worker.agent_id);
              return (
                <div key={worker.agent_id} className="rounded-lg border border-border-subtle bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-slate-200">#{index + 1} {agent?.name}</span>
                    <button type="button" onClick={() => onRemoveWorker(index)} className="text-xs text-red-400 hover:text-red-300">
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Routing condition prompt..."
                    value={worker.routing_condition}
                    onChange={(event) => onWorkerRoutingChange(index, event.target.value)}
                    className="w-full rounded border border-border-subtle bg-background-surface px-2 py-1.5 text-xs text-slate-200"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS.

---

### Task 6: Replace WorkflowBuilder With Modular Shell

**Files:**
- Modify: `frontend/components/workflows/WorkflowBuilder.tsx`
- Modify: `frontend/app/(dashboard)/workflows/create/page.tsx`

- [ ] **Step 1: Replace WorkflowBuilder implementation**

Replace `frontend/components/workflows/WorkflowBuilder.tsx` with:

```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Agent } from '../../lib/types';
import { api } from '../../lib/api';
import { Save, ArrowLeft } from 'lucide-react';
import { WorkflowCanvas } from './builder/WorkflowCanvas';
import { WorkflowControlsPanel } from './builder/WorkflowControlsPanel';
import { SelectedWorker } from './builder/types';
import { useWorkflowGraph } from './builder/useWorkflowGraph';

interface WorkflowBuilderProps {
  availableAgents: Agent[];
}

export function WorkflowBuilder({ availableAgents }: WorkflowBuilderProps) {
  const router = useRouter();
  const [workflowName, setWorkflowName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSupervisorID, setSelectedSupervisorID] = useState<string>('');
  const [selectedWorkers, setSelectedWorkers] = useState<SelectedWorker[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { supervisors, workers, availableWorkerOptions, nodes, edges, onNodesChange } = useWorkflowGraph({
    availableAgents,
    selectedSupervisorID,
    selectedWorkers,
  });

  const addWorkerNode = (agentId: string) => {
    if (!agentId) return;
    setSelectedWorkers((previous) => {
      if (previous.some((worker) => worker.agent_id === agentId)) {
        return previous;
      }
      return [
        ...previous,
        {
          agent_id: agentId,
          execution_order: previous.length + 1,
          routing_condition: 'Always execute subtask',
        },
      ];
    });
  };

  const removeWorkerNode = (index: number) => {
    setSelectedWorkers((previous) =>
      previous
        .filter((_, itemIndex) => itemIndex !== index)
        .map((worker, itemIndex) => ({ ...worker, execution_order: itemIndex + 1 }))
    );
  };

  const updateWorkerRouting = (index: number, value: string) => {
    setSelectedWorkers((previous) =>
      previous.map((worker, itemIndex) => (itemIndex === index ? { ...worker, routing_condition: value } : worker))
    );
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedSupervisor = supervisors.find((supervisor) => supervisor.id === selectedSupervisorID);
    if (!selectedSupervisor) {
      setError('Please select an agent with role_type supervisor. Worker agents cannot supervise workflows.');
      return;
    }
    const invalidWorker = selectedWorkers.find((worker) => !workers.some((agent) => agent.id === worker.agent_id));
    if (invalidWorker) {
      setError('Only agents with role_type worker can be connected as worker nodes.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api.createWorkflow({
        name: workflowName,
        description,
        supervisor_agent_id: selectedSupervisorID,
        nodes: selectedWorkers,
      });
      router.push('/workflows');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="relative h-full min-h-0 overflow-hidden bg-background text-slate-100">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-border-subtle bg-background-surface/95 px-5 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Workflows</span>
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-100">Visual Workflow Builder</h2>
          <button
            type="submit"
            disabled={saving || supervisors.length === 0}
            className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Workflow'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="absolute left-5 right-5 top-16 z-30 rounded-lg border border-red-800 bg-red-950/90 p-3 text-sm text-red-300 shadow-xl">
          {error}
        </div>
      )}

      <WorkflowControlsPanel
        workflowName={workflowName}
        description={description}
        selectedSupervisorID={selectedSupervisorID}
        selectedWorkers={selectedWorkers}
        supervisors={supervisors}
        workers={workers}
        availableWorkerOptions={availableWorkerOptions}
        availableAgents={availableAgents}
        onWorkflowNameChange={setWorkflowName}
        onDescriptionChange={setDescription}
        onSupervisorChange={setSelectedSupervisorID}
        onAddWorker={addWorkerNode}
        onRemoveWorker={removeWorkerNode}
        onWorkerRoutingChange={updateWorkerRouting}
      />

      <WorkflowCanvas nodes={nodes} edges={edges} onNodesChange={onNodesChange} />
    </form>
  );
}
```

- [ ] **Step 2: Keep create route small**

Keep `frontend/app/(dashboard)/workflows/create/page.tsx` as:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { Agent } from '../../../../lib/types';
import { WorkflowBuilder } from '../../../../components/workflows/WorkflowBuilder';

export default function CreateWorkflowPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAgents()
      .then((data) => setAgents(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-xs font-mono text-slate-400">Loading agents topology...</div>;
  }

  return <WorkflowBuilder availableAgents={agents} />;
}
```

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS.

---

### Task 7: Browser Verification

**Files:**
- No code changes.

- [ ] **Step 1: Open workflow create page**

Use the existing dev server or run:

```bash
cd frontend && npm run dev -- --port 3001
```

Open:

```text
http://localhost:3001/workflows/create
```

Expected: the workflow builder fills the available dashboard content area beside the sidebar, without a small `h-[420px]` card.

- [ ] **Step 2: Verify role filtering**

In the browser:
- Open the supervisor picker.
- Open the worker picker.

Expected:
- Supervisor picker lists only `role_type === 'supervisor'` agents.
- Worker picker lists only `role_type === 'worker'` agents.
- Selected workers disappear from the worker picker.

- [ ] **Step 3: Verify drag persistence**

In the browser:
- Select a supervisor.
- Add one or more workers.
- Drag nodes to new positions.
- Edit routing text.
- Add another worker.

Expected:
- Existing node positions do not reset after routing edits or adding workers.

- [ ] **Step 4: Verify responsive behavior**

Resize the browser.

Expected:
- Canvas remains usable.
- Overlay panel scrolls internally if content overflows.
- React Flow controls remain visible and usable.

---

### Task 8: Final Verification

**Files:**
- No code changes.

- [ ] **Step 1: Run backend tests**

Run:

```bash
cd backend && go test ./... -v
```

Expected: PASS.

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run frontend lint and record baseline issues**

Run:

```bash
cd frontend && npm run lint
```

Expected: If existing project-wide lint still fails on unrelated pages, record the existing failures. New workflow builder files should not introduce TypeScript errors.

---

## Self-Review

**Spec coverage:**
- Full available-page workflow create canvas: Tasks 2, 5, 6, and 7.
- Modular Next.js/React structure: Tasks 2 through 6 split layout, nodes, graph state, canvas, controls, and orchestrator.
- Drag persistence: Task 4 uses a node position map instead of resetting nodes from derived state.
- Supervisor/worker configuration controls: Tasks 5 and 6.
- Worker agents cannot become supervisors: Tasks 1, 4, 5, and 6.
- Supervisor agents cannot be added as workers: Tasks 1, 4, 5, and 6.
- Backend enforcement in addition to UI filtering: Task 1.

**Placeholder scan:**
- No task contains forbidden placeholder phrases or undefined implementation references.

**Type consistency:**
- Frontend role checks use existing `Agent.role_type` values: `supervisor` and `worker`.
- Backend validation uses existing `models.RoleSupervisor` and `models.RoleWorker` constants.
- Workflow save payload remains compatible with existing `api.createWorkflow` shape.