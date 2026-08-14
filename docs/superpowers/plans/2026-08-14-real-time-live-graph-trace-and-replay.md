# Real-Time Visual Live-Trace & Interactive Session Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the workflow execution console and historical session audit screens into an interactive, real-time live-trace experience where the visual graph pulses active nodes, animates traversed conditional edges, visually marks skipped branches, and allows time-travel step inspection during replay.

**Architecture:** Sync the SSE execution stream (`useWorkflowExecution`) with the `@xyflow/react` graph canvas in `app/(dashboard)/workflows/[id]/execute/page.tsx` and `app/(dashboard)/sessions/[id]/page.tsx`. Map incoming `AGENT_THOUGHT`, `AGENT_DELEGATION`, `CONDITION_EVALUATED`, and `BRANCH_SKIPPED` events to node/edge visual states (`idle`, `running`, `completed`, `skipped`, `error`). Provide an interactive time scrubber to replay execution states step-by-step.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `@xyflow/react`, SSE EventSource, Tailwind CSS 4, Lucide React, Vitest.

---

## File Structure & Responsibilities

- `frontend/lib/types.ts`: Enhanced SSE log event interfaces including `node_id`, `edge_id`, `branch_status`, and evaluation metadata.
- `frontend/hooks/useWorkflowExecution.ts`: Upgraded SSE hook exposing active node IDs, active edge IDs, skipped branches, and step history.
- `frontend/components/console/LiveGraphTrace.tsx`: Synchronized read-only React Flow canvas that highlights active executing nodes with glow effects and pulses active edges.
- `frontend/components/console/EventRenderer.tsx`: Enhanced event cards rendering condition evaluations (`MATCHED` / `SKIPPED`) and hierarchical nesting indicators.
- `frontend/components/sessions/SessionReplayScrubber.tsx`: Interactive step-by-step playback controller for historical execution sessions.
- `frontend/app/(dashboard)/workflows/[id]/execute/page.tsx`: Split-screen layout featuring live visual graph trace on left/top and streaming thought console on right/bottom.
- `frontend/app/(dashboard)/sessions/[id]/page.tsx`: Upgraded session audit screen embedding the interactive visual replay.

---

### Task 1: Type Definitions & Enhanced SSE Event Protocol

**Files:**
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/hooks/useWorkflowExecution.ts`

- [ ] **Step 1: Update `frontend/lib/types.ts` with graph trace payload types**

```typescript
// In frontend/lib/types.ts
export type SSEEventType =
  | 'AGENT_THOUGHT'
  | 'AGENT_DELEGATION'
  | 'TOOL_CALL'
  | 'TOOL_RESULT'
  | 'CONDITION_EVALUATED'
  | 'BRANCH_SKIPPED'
  | 'WORKFLOW_COMPLETE'
  | 'ERROR';

export interface SSELogEvent {
  event: SSEEventType;
  session_id: string;
  agent_name?: string;
  agent_id?: string;
  node_id?: string;
  edge_id?: string;
  step: number;
  payload: Record<string, unknown>;
  created_at?: string;
}

export type NodeExecutionStatus = 'idle' | 'running' | 'completed' | 'skipped' | 'error';
export type EdgeExecutionStatus = 'idle' | 'traversed' | 'skipped';
```

- [ ] **Step 2: Update `frontend/hooks/useWorkflowExecution.ts`**

```typescript
// frontend/hooks/useWorkflowExecution.ts
import { useState, useCallback } from 'react';
import { SSELogEvent, NodeExecutionStatus, EdgeExecutionStatus } from '../lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export function useWorkflowExecution(workflowId: string) {
  const [logs, setLogs] = useState<SSELogEvent[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [finalOutput, setFinalOutput] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeExecutionStatus>>({});
  const [edgeStatuses, setEdgeStatuses] = useState<Record<string, EdgeExecutionStatus>>({});

  const startExecution = useCallback((query: string) => {
    setLogs([]);
    setFinalOutput(null);
    setStatus('running');
    setNodeStatuses({});
    setEdgeStatuses({});
    setActiveNodeId(null);

    const encodedQuery = encodeURIComponent(query);
    const url = `${API_BASE}/workflows/${workflowId}/execute/stream?query=${encodedQuery}`;
    const eventSource = new EventSource(url);

    const handleEvent = (e: MessageEvent) => {
      try {
        const parsed: SSELogEvent = JSON.parse(e.data);
        setLogs((prev) => [...prev, parsed]);

        if (parsed.agent_id || parsed.node_id) {
          const targetId = parsed.node_id || parsed.agent_id;
          if (targetId) {
            setActiveNodeId(targetId);
            setNodeStatuses((prev) => ({ ...prev, [targetId]: 'running' }));
          }
        }

        if (parsed.event === 'CONDITION_EVALUATED' && parsed.edge_id) {
          setEdgeStatuses((prev) => ({ ...prev, [parsed.edge_id!]: 'traversed' }));
        } else if (parsed.event === 'BRANCH_SKIPPED' && parsed.edge_id) {
          setEdgeStatuses((prev) => ({ ...prev, [parsed.edge_id!]: 'skipped' }));
        }

        if (parsed.event === 'WORKFLOW_COMPLETE') {
          setStatus('completed');
          setActiveNodeId(null);
          if (parsed.payload.final_output) {
            setFinalOutput(String(parsed.payload.final_output));
          }
          eventSource.close();
        } else if (parsed.event === 'ERROR') {
          setStatus('error');
          setActiveNodeId(null);
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing SSE event data:', err);
      }
    };

    eventSource.onmessage = handleEvent;

    ['AGENT_THOUGHT', 'AGENT_DELEGATION', 'TOOL_CALL', 'TOOL_RESULT', 'CONDITION_EVALUATED', 'BRANCH_SKIPPED', 'WORKFLOW_COMPLETE', 'ERROR'].forEach(
      (eventType) => {
        eventSource.addEventListener(eventType, handleEvent);
      }
    );

    eventSource.onerror = (err) => {
      console.error('SSE Connection Error:', err);
      setStatus((prev) => (prev === 'completed' ? 'completed' : 'error'));
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [workflowId]);

  return { logs, status, finalOutput, activeNodeId, nodeStatuses, edgeStatuses, startExecution };
}
```

---

### Task 2: Live Graph Trace Component with Visual Glow Effects

**Files:**
- Create: `frontend/components/console/LiveGraphTrace.tsx`
- Modify: `frontend/components/console/EventRenderer.tsx`

- [ ] **Step 1: Implement `LiveGraphTrace.tsx`**

```tsx
// frontend/components/console/LiveGraphTrace.tsx
import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Workflow, NodeExecutionStatus, EdgeExecutionStatus } from '../../lib/types';
import { SupervisorNode, WorkerNode } from '../workflows/builder/WorkflowNodes';
import { CustomConditionEdge } from '../workflows/builder/CustomConditionEdge';

const nodeTypes = {
  supervisorNode: SupervisorNode,
  workerNode: WorkerNode,
};

const edgeTypes = {
  conditionEdge: CustomConditionEdge,
};

interface LiveGraphTraceProps {
  workflow: Workflow;
  activeNodeId: string | null;
  nodeStatuses: Record<string, NodeExecutionStatus>;
  edgeStatuses: Record<string, EdgeExecutionStatus>;
}

export function LiveGraphTrace({ workflow, activeNodeId, nodeStatuses, edgeStatuses }: LiveGraphTraceProps) {
  const nodes = useMemo<Node[]>(() => {
    const list: Node[] = [];
    if (workflow.supervisor_agent) {
      const isSupActive = activeNodeId === workflow.supervisor_agent_id;
      list.push({
        id: workflow.supervisor_agent_id || 'sup-node',
        type: 'supervisorNode',
        position: { x: 400, y: 50 },
        data: { agent: workflow.supervisor_agent },
        className: isSupActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse' : '',
      });
    }

    workflow.nodes?.forEach((node, idx) => {
      if (!node.agent) return;
      const isActive = activeNodeId === node.agent_id || activeNodeId === node.id;
      const status = nodeStatuses[node.id] || nodeStatuses[node.agent_id] || 'idle';

      list.push({
        id: node.id,
        type: 'workerNode',
        position: { x: 200 + (idx % 3) * 280, y: 250 + Math.floor(idx / 3) * 180 },
        data: { agent: node.agent, order: node.execution_order, routing: node.routing_condition },
        className: isActive
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse'
          : status === 'skipped'
          ? 'opacity-40 grayscale'
          : '',
      });
    });

    return list;
  }, [workflow, activeNodeId, nodeStatuses]);

  const edges = useMemo<Edge[]>(() => {
    if (!workflow.edges || workflow.edges.length === 0) {
      // Fallback star edges
      return (workflow.nodes || []).map((node) => ({
        id: `e-sup-${node.id}`,
        source: workflow.supervisor_agent_id || 'sup-node',
        target: node.id,
        type: 'conditionEdge',
        animated: activeNodeId === node.agent_id || activeNodeId === node.id,
      }));
    }

    return workflow.edges.map((edge) => {
      const status = edgeStatuses[edge.id] || 'idle';
      return {
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        type: 'conditionEdge',
        data: {
          condition_type: edge.condition_type as any,
          condition_expression: edge.condition_expression,
          label: edge.label,
        },
        animated: status === 'traversed',
        style: {
          stroke: status === 'traversed' ? 'var(--primary)' : status === 'skipped' ? 'var(--muted-foreground)' : 'var(--border-strong)',
          strokeDasharray: status === 'skipped' ? '4 4' : undefined,
          opacity: status === 'skipped' ? 0.4 : 1,
        },
      };
    });
  }, [workflow, activeNodeId, edgeStatuses]);

  return (
    <div className="relative h-full w-full rounded-xl border border-border-subtle bg-background-canvas/50">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView>
        <Background color="var(--border-subtle)" gap={20} size={1} />
        <Controls className="!border-border-subtle !bg-background-surface" />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 2: Update `EventRenderer.tsx` for Condition & Skipped Events**

```tsx
// In frontend/components/console/EventRenderer.tsx
// Add branch condition badges and skipped event styling
case 'CONDITION_EVALUATED':
  return (
    <div className="flex items-start space-x-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
      <GitBranch className="h-4 w-4 text-primary mt-0.5" />
      <div>
        <span className="font-semibold text-primary">Condition Evaluated</span>
        <p className="mt-1 text-foreground">{String(event.payload.reason || 'Condition matched successfully')}</p>
      </div>
    </div>
  );
case 'BRANCH_SKIPPED':
  return (
    <div className="flex items-start space-x-3 rounded-lg border border-border-subtle bg-muted/40 p-3 text-xs opacity-75">
      <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div>
        <span className="font-semibold text-muted-foreground">Branch Skipped</span>
        <p className="mt-1 text-muted-foreground">{String(event.payload.reason || 'Criteria not met')}</p>
      </div>
    </div>
  );
```

---

### Task 3: Interactive Execution Console & Session Replay Integration

**Files:**
- Modify: `frontend/app/(dashboard)/workflows/[id]/execute/page.tsx`
- Modify: `frontend/app/(dashboard)/sessions/[id]/page.tsx`

- [ ] **Step 1: Integrate `LiveGraphTrace` into `workflows/[id]/execute/page.tsx`**
- [ ] **Step 2: Integrate Replay scrubber into `sessions/[id]/page.tsx`**
- [ ] **Step 3: Run Vitest and build checks**

Run: `npm run test:run && npm run build` in `frontend`
Expected: All tests pass and build succeeds.

---

## Verification Plan

### Automated Verification
1. Run `npm run test:run` to verify SSE hook parsing and visual status state updates.
2. Run `npm run build` to verify zero Next.js type errors.
