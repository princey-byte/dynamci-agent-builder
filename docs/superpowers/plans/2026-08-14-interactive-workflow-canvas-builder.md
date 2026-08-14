# Visual Node-Edge Canvas & Interactive Workflow Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the React Flow workflow builder from a restricted single-supervisor layout into a full-featured visual DAG editor where users can drag connection wires between any supervisor and worker, connect worker nodes to sub-worker nodes, configure edge conditions via an inspector drawer, and visualize node capabilities (MCP tools, skills, sub-teams).

**Architecture:** Utilize `@xyflow/react` handles (`Handle` type source and target) on custom node components (`WorkerNode`, `SupervisorNode`). Implement edge connection callbacks (`onConnect`, `onEdgesChange`), an interactive Edge Condition Inspector modal, edge labeling (`EdgeLabelRenderer`), and dynamic hierarchy validation to prevent cycles while composing multi-tier workflows.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `@xyflow/react`, Tailwind CSS 4, Lucide React, Vitest.

---

## File Structure & Responsibilities

- `frontend/components/workflows/builder/types.ts`: TypeScript interfaces for `WorkflowNodeData`, `WorkflowEdgeData`, condition definitions, and graph connection states.
- `frontend/components/workflows/builder/WorkflowNodes.tsx`: Node components with explicit input/output connection handles, badges (skills, MCP tools, sub-workers), and role indicators.
- `frontend/components/workflows/builder/CustomConditionEdge.tsx`: Custom React Flow edge rendering condition pills (`always`, `rule`, `llm`, `fallback`), delete buttons, and click handlers to configure condition logic.
- `frontend/components/workflows/builder/EdgeConditionDrawer.tsx`: Flyout drawer for editing edge condition type, expression, and custom label.
- `frontend/components/workflows/builder/useWorkflowGraph.ts`: Graph state hook managing nodes, edges, validation, cycle detection, and serialization for backend API.
- `frontend/components/workflows/WorkflowBuilder.tsx`: Top-level builder layout with canvas, agent selection sidebar, mini-map, and controls toolbar.
- `frontend/components/workflows/builder/WorkflowBuilder.test.tsx`: Vitest tests for handle connections, edge condition updates, and multi-tier hierarchy.

---

### Task 1: Type Definitions & Node Handles

**Files:**
- Modify: `frontend/components/workflows/builder/types.ts`
- Modify: `frontend/components/workflows/builder/WorkflowNodes.tsx`

- [ ] **Step 1: Update `frontend/components/workflows/builder/types.ts`**

```typescript
// frontend/components/workflows/builder/types.ts
import { Agent } from '../../../lib/types';

export type ConditionType = 'always' | 'llm_decision' | 'rule_match' | 'fallback';

export interface WorkflowEdgeData {
  condition_type: ConditionType;
  condition_expression?: string;
  label?: string;
}

export interface SupervisorNodeData {
  agent: Agent;
}

export interface WorkerNodeData {
  agent: Agent;
  order?: number;
  routing?: string;
  isTeamLead?: boolean;
  childCount?: number;
}
```

- [ ] **Step 2: Update `WorkflowNodes.tsx` to include Source & Target Handles**

```tsx
// frontend/components/workflows/builder/WorkflowNodes.tsx
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Cpu, Sparkles, Wrench, GitFork } from 'lucide-react';
import { SupervisorNodeData, WorkerNodeData } from './types';

export function SupervisorNode({ data }: { data: SupervisorNodeData }) {
  return (
    <div className="group relative min-w-[240px] rounded-xl border border-primary/40 bg-background-surface/95 p-4 shadow-lg backdrop-blur transition-all hover:border-primary">
      <div className="flex items-center space-x-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Root Supervisor</span>
          <h4 className="text-sm font-semibold text-foreground">{data.agent.name}</h4>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{data.agent.description || 'Workflow Root Coordinator'}</p>
      
      {/* Output Connection Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !rounded-full !border-2 !border-background !bg-primary transition-transform hover:scale-125"
      />
    </div>
  );
}

export function WorkerNode({ data }: { data: WorkerNodeData }) {
  return (
    <div className="group relative min-w-[240px] rounded-xl border border-border-subtle bg-background-surface/95 p-4 shadow-md backdrop-blur transition-all hover:border-border-strong hover:shadow-lg">
      {/* Input Connection Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !rounded-full !border-2 !border-background !bg-muted-foreground transition-transform hover:scale-125 hover:!bg-primary"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Worker Agent</span>
            <h4 className="text-xs font-semibold text-foreground">{data.agent.name}</h4>
          </div>
        </div>
        {data.isTeamLead && (
          <span className="flex items-center space-x-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
            <GitFork className="h-3 w-3" />
            <span>Team Lead</span>
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Wrench className="h-3 w-3" /> {data.agent.mcp_tools?.length || 0} Tools
        </span>
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> {data.agent.skills?.length || 0} Skills
        </span>
      </div>

      {/* Output Connection Handle for sub-workers */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !rounded-full !border-2 !border-background !bg-primary transition-transform hover:scale-125"
      />
    </div>
  );
}
```

---

### Task 2: Custom Condition Edge & Inspector Drawer

**Files:**
- Create: `frontend/components/workflows/builder/CustomConditionEdge.tsx`
- Create: `frontend/components/workflows/builder/EdgeConditionDrawer.tsx`

- [ ] **Step 1: Implement `CustomConditionEdge.tsx`**

```tsx
// frontend/components/workflows/builder/CustomConditionEdge.tsx
import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react';
import { WorkflowEdgeData } from './types';
import { GitCommit, X } from 'lucide-react';

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
}: EdgeProps<WorkflowEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const conditionType = data?.condition_type || 'always';
  const label = data?.label || conditionType;

  return (
    <>
      <BaseEdge path={edgePath} style={{ strokeWidth: selected ? 2.5 : 1.5, stroke: selected ? 'var(--primary)' : 'var(--border-strong)' }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="flex items-center space-x-1 rounded-full border border-border-subtle bg-background-surface px-2.5 py-1 text-[11px] font-medium shadow-sm transition-all hover:border-primary"
        >
          <GitCommit className="h-3 w-3 text-primary" />
          <span className="text-foreground">{label}</span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
```

- [ ] **Step 2: Implement `EdgeConditionDrawer.tsx`**

```tsx
// frontend/components/workflows/builder/EdgeConditionDrawer.tsx
import React from 'react';
import { ConditionType, WorkflowEdgeData } from './types';
import { X, Check } from 'lucide-react';

interface EdgeConditionDrawerProps {
  edgeId: string | null;
  edgeData: WorkflowEdgeData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (edgeId: string, updated: WorkflowEdgeData) => void;
}

export function EdgeConditionDrawer({ edgeId, edgeData, isOpen, onClose, onSave }: EdgeConditionDrawerProps) {
  const [conditionType, setConditionType] = React.useState<ConditionType>(edgeData?.condition_type || 'always');
  const [expression, setExpression] = React.useState(edgeData?.condition_expression || '');
  const [label, setLabel] = React.useState(edgeData?.label || '');

  React.useEffect(() => {
    if (edgeData) {
      setConditionType(edgeData.condition_type || 'always');
      setExpression(edgeData.condition_expression || '');
      setLabel(edgeData.label || '');
    }
  }, [edgeData]);

  if (!isOpen || !edgeId) return null;

  const handleSave = () => {
    onSave(edgeId, {
      condition_type: conditionType,
      condition_expression: expression,
      label: label || conditionType,
    });
    onClose();
  };

  return (
    <div className="absolute right-0 top-0 z-30 h-full w-80 border-l border-border-subtle bg-background-surface/95 p-5 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <h3 className="text-sm font-semibold text-foreground">Edge Routing Condition</h3>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-4 text-xs">
        <div>
          <label className="font-medium text-foreground">Condition Type</label>
          <select
            value={conditionType}
            onChange={(e) => setConditionType(e.target.value as ConditionType)}
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="always">Always (Unconditional)</option>
            <option value="rule_match">Rule / Keyword Match</option>
            <option value="llm_decision">LLM Semantic Router</option>
            <option value="fallback">Fallback (Else Branch)</option>
          </select>
        </div>

        {conditionType === 'rule_match' && (
          <div>
            <label className="font-medium text-foreground">Rule Expression</label>
            <input
              type="text"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder='contains("URGENT") or regex("error:[0-9]+")'
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}

        {conditionType === 'llm_decision' && (
          <div>
            <label className="font-medium text-foreground">Classification Prompt</label>
            <textarea
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="e.g. Query requires code execution and API validation"
              rows={3}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}

        <div>
          <label className="font-medium text-foreground">Edge Display Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. If Code Error"
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <button
          onClick={handleSave}
          className="flex w-full items-center justify-center space-x-2 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Check className="h-4 w-4" />
          <span>Apply Condition</span>
        </button>
      </div>
    </div>
  );
}
```

---

### Task 3: Graph State Hook & Connection Handling

**Files:**
- Modify: `frontend/components/workflows/builder/useWorkflowGraph.ts`
- Modify: `frontend/components/workflows/WorkflowBuilder.tsx`

- [ ] **Step 1: Upgrade `useWorkflowGraph.ts` with arbitrary `onConnect` and edge condition management**
- [ ] **Step 2: Connect `CustomConditionEdge` and `EdgeConditionDrawer` in `WorkflowCanvas.tsx`**
- [ ] **Step 3: Run frontend unit tests and type checks**

Run: `npm run test:run` in `frontend`
Expected: All tests PASS.

---

## Verification Plan

### Automated Verification
1. Run `npm run test:run` in `frontend` to verify canvas node handles, edge connections, and edge condition state changes.
2. Run `npm run build` in `frontend` to verify zero TypeScript or Next.js build errors.
