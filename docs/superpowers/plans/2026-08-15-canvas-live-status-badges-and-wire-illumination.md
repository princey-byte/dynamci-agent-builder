# Plan 3: Real-Time Canvas Dynamic Status Badges & Traversed Wire Illumination

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Equip the visual canvas nodes and connection edges with real-time reactive visual states during in-canvas execution: pulsing active rings, dynamic status badges (`Thinking`, `Tool Call`, `Done`, `Skipped`), animated flowing wires for traversed condition branches, and dimmed styling for bypassed branches.

**Architecture:** Connect `useWorkflowExecution`'s `activeNodeId`, `nodeStatuses`, and `edgeStatuses` directly into the builder's `useWorkflowGraph` hook. Pass node status and current action (`currentActionText`) down into `WorkflowNodes.tsx` and dynamically compute edge styling (`animated: true`, `stroke: hsl(var(--primary))`) in `CustomConditionEdge.tsx`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `@xyflow/react`, Tailwind CSS 4, Lucide React, Vitest.

---

## File Structure & Responsibilities

- `frontend/components/workflows/builder/types.ts`: Extend `SupervisorNodeData` and `WorkerNodeData` with `executionStatus` (`idle` | `running` | `completed` | `skipped` | `error`) and `currentActionText`.
- `frontend/components/workflows/builder/WorkflowNodes.tsx`: Render live glowing pulse rings and dynamic action badges on node cards.
- `frontend/components/workflows/builder/CustomConditionEdge.tsx`: Render animated SVG flow strokes and color-coded match/skip badges on connection wires.
- `frontend/components/workflows/builder/useWorkflowGraph.ts`: Bind SSE execution state into node/edge graph data.
- `frontend/components/workflows/WorkflowBuilder.tsx`: Top-level studio binding execution hook with graph visualization.

---

### Task 1: Node Live Badges & Execution Status Enhancements

**Files:**
- Modify: `frontend/components/workflows/builder/types.ts`
- Modify: `frontend/components/workflows/builder/WorkflowNodes.tsx`

- [ ] **Step 1: Extend node types with execution status in `types.ts`**

```typescript
// In frontend/components/workflows/builder/types.ts
export type NodeExecutionStatus = 'idle' | 'running' | 'completed' | 'skipped' | 'error';

export interface SupervisorNodeData extends Record<string, unknown> {
  agent: Agent;
  executionStatus?: NodeExecutionStatus;
  currentActionText?: string;
  onAddChild?: (parentSourceId: string) => void;
  onRemove?: () => void;
}

export interface WorkerNodeData extends Record<string, unknown> {
  agent: Agent;
  order?: number;
  routing?: string;
  isTeamLead?: boolean;
  executionStatus?: NodeExecutionStatus;
  currentActionText?: string;
  onAddChild?: (parentSourceId: string) => void;
  onRemove?: (agentId: string) => void;
}
```

- [ ] **Step 2: Update `SupervisorNode` and `WorkerNode` in `WorkflowNodes.tsx` with live status indicators**

```tsx
// In WorkflowNodes.tsx
// Status badge component:
function NodeStatusIndicator({ status, actionText }: { status?: NodeExecutionStatus; actionText?: string }) {
  if (!status || status === 'idle') return null;

  if (status === 'running') {
    return (
      <div className="flex items-center space-x-1.5 rounded-full bg-primary/15 border border-primary/40 px-2.5 py-0.5 text-[10px] font-bold text-primary animate-pulse">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
        <span>{actionText || 'Executing...'}</span>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="flex items-center space-x-1 rounded-full bg-agent-success/15 border border-agent-success/40 px-2 py-0.5 text-[10px] font-bold text-agent-success">
        <span>✓ Done</span>
      </div>
    );
  }

  if (status === 'skipped') {
    return (
      <div className="flex items-center space-x-1 rounded-full bg-muted/40 border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        <span>⊘ Skipped</span>
      </div>
    );
  }

  return null;
}
```

---

### Task 2: Traversed Wire Illumination & Branch Visualization

**Files:**
- Modify: `frontend/components/workflows/builder/CustomConditionEdge.tsx`
- Modify: `frontend/components/workflows/builder/useWorkflowGraph.ts`

- [ ] **Step 1: Update `CustomConditionEdge.tsx` with animated flow particles and status styles**

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
  animated,
  style,
}: EdgeProps) {
  // Compute SVG bezier curve
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as WorkflowEdgeData | undefined;
  const isTraversed = animated || edgeData?.executionStatus === 'traversed';
  const isSkipped = edgeData?.executionStatus === 'skipped';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          strokeWidth: isTraversed ? 3.5 : selected ? 3 : 2,
          stroke: isTraversed
            ? 'hsl(var(--primary))'
            : isSkipped
            ? 'hsl(var(--muted-foreground) / 0.3)'
            : selected
            ? 'hsl(var(--primary))'
            : 'hsl(var(--foreground) / 0.35)',
          strokeDasharray: isSkipped ? '4 4' : undefined,
          transition: 'stroke 0.3s, stroke-width 0.3s',
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
          className={`group flex cursor-pointer items-center space-x-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold shadow-md backdrop-blur transition-all ${
            isTraversed
              ? 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/20 scale-105 animate-pulse'
              : isSkipped
              ? 'border-border bg-background text-muted-foreground opacity-50'
              : selected
              ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/30'
              : 'border-border bg-card text-foreground hover:border-primary'
          }`}
        >
          <GitCommit className={`h-3.5 w-3.5 ${isTraversed || selected ? 'text-primary-foreground' : 'text-primary'}`} />
          <span className="font-bold">{edgeData?.label || edgeData?.condition_type || 'Always'}</span>
          {isTraversed && <span className="text-[9px] uppercase font-bold text-primary-foreground">⚡ ACTIVE</span>}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
```

- [ ] **Step 2: Update `useWorkflowGraph.ts` to accept `activeNodeId`, `nodeStatuses`, `edgeStatuses` and inject into node/edge datasets**

---

### Task 3: End-to-End Edge Case Testing & Verification

**Files:**
- Modify: `frontend/components/workflows/WorkflowBuilder.tsx`
- Run: Full test suite and build

- [ ] **Step 1: Verify multi-tier worker loops, fallback routes, error interruptions**
- [ ] **Step 2: Run `npm run test:run && npm run build` and `go test ./...`**

---

## Verification Plan

### Automated Tests
1. Run `npm run test:run` in `frontend`
2. Run `npm run build` in `frontend`
3. Run `go test ./...` in `backend`
