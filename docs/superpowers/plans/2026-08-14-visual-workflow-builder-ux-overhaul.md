# Visual Workflow Builder UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Visual Workflow Builder into a modern, visual-first node-graph editor with an inline top metadata bar, a collapsible agent palette sidebar, node-level `+ Add Child Worker` quick-action triggers, generous interactive connection handles, auto-layout graph arrangement, and a single source of truth for edge condition configuration.

**Architecture:** Refactor the workflow builder layout into a top header (editable title/description + action bar), a collapsible left agent palette, and a full-bleed React Flow canvas. Upgrade `WorkflowNodes` to include hover-activated child spawn buttons and large magnetic handles. Upgrade `useWorkflowGraph` to eliminate edge regeneration race conditions and provide deterministic node/edge state synchronization.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `@xyflow/react`, Lucide React, Tailwind CSS 4, Vitest.

---

## File Structure & Responsibilities

- `frontend/components/workflows/builder/types.ts`: Extended interfaces for `WorkflowNodeData`, `WorkflowEdgeData`, `AgentPaletteItem`, and quick-connection callbacks.
- `frontend/components/workflows/builder/WorkflowTopBar.tsx`: Inline editable workflow name, description modal/input, validation badges, Auto-Layout trigger, and Save Workflow button.
- `frontend/components/workflows/builder/AgentPaletteSidebar.tsx`: Collapsible left panel listing available supervisors and workers with search, skill/tool badges, and click-to-add / drag triggers.
- `frontend/components/workflows/builder/WorkflowNodes.tsx`: Upgraded `SupervisorNode` and `WorkerNode` with larger hit-target handles (`!w-4 !h-4`), hover glow rings, and a `+ Add Child` quick-picker trigger.
- `frontend/components/workflows/builder/CustomConditionEdge.tsx`: Bezier edge with high-contrast clickable condition pills, active glow states, and hover delete actions.
- `frontend/components/workflows/builder/EdgeConditionDrawer.tsx`: Flyout drawer for editing edge condition rules, presets, expressions, and wire deletion.
- `frontend/components/workflows/builder/useWorkflowGraph.ts`: State management hook handling deterministic node positioning, connection validation, cycle detection, and edge condition updates.
- `frontend/components/workflows/WorkflowBuilder.tsx`: Top-level component integrating top bar, palette, canvas, and condition drawer with backend API submission.
- `frontend/components/workflows/builder/WorkflowBuilder.test.tsx`: Unit tests verifying edge connections, node quick-adds, condition updates, and save submissions.

---

### Task 1: Builder Types & Node Component Upgrade with Quick-Add

**Files:**
- Modify: `frontend/components/workflows/builder/types.ts`
- Modify: `frontend/components/workflows/builder/WorkflowNodes.tsx`

- [ ] **Step 1: Update `frontend/components/workflows/builder/types.ts`**

```typescript
// frontend/components/workflows/builder/types.ts
import { Agent } from '../../../lib/types';

export type ConditionType = 'always' | 'llm_decision' | 'rule_match' | 'fallback';

export interface WorkflowEdgeData extends Record<string, unknown> {
  condition_type: ConditionType;
  condition_expression?: string;
  label?: string;
}

export interface SelectedWorker {
  agent_id: string;
  execution_order: number;
  routing_condition: string;
}

export interface SupervisorNodeData extends Record<string, unknown> {
  agent: Agent;
  onAddChild?: (parentSourceId: string) => void;
  onRemove?: () => void;
}

export interface WorkerNodeData extends Record<string, unknown> {
  agent: Agent;
  order?: number;
  routing?: string;
  isTeamLead?: boolean;
  onAddChild?: (parentSourceId: string) => void;
  onRemove?: (agentId: string) => void;
}
```

- [ ] **Step 2: Update `WorkflowNodes.tsx` with generous handles and quick-add button**

```tsx
// frontend/components/workflows/builder/WorkflowNodes.tsx
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Cpu, Sparkles, Wrench, GitFork, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { SupervisorNodeData, WorkerNodeData } from './types';

export function SupervisorNode({ data, id }: { data: SupervisorNodeData; id: string }) {
  return (
    <div className="group relative min-w-[280px] max-w-[320px] rounded-2xl border-2 border-primary bg-card p-5 text-card-foreground shadow-2xl shadow-primary/10 transition-all hover:border-primary hover:shadow-primary/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Root Supervisor</span>
            <h4 className="text-sm font-bold text-foreground truncate max-w-[180px]">{data.agent.name}</h4>
          </div>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{data.agent.persona || 'Workflow Coordinator'}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-2.5">
        <Badge variant="supervisor">Supervisor</Badge>
        <Badge variant={data.agent.model_provider as 'openai' | 'azure_openai' | 'anthropic' | 'gemini'}>
          {data.agent.model_name}
        </Badge>
      </div>

      {/* Output Connection Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-4 !w-4 !rounded-full !border-2 !border-background !bg-primary transition-transform hover:scale-150 shadow-md cursor-crosshair"
      />

      {/* Quick Add Child Button */}
      {data.onAddChild && (
        <button
          type="button"
          onClick={() => data.onAddChild?.(id)}
          className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 flex items-center space-x-1 rounded-full border border-primary/40 bg-background-surface px-2.5 py-0.5 text-[10px] font-semibold text-primary shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-primary hover:text-primary-foreground"
        >
          <Plus className="h-3 w-3" />
          <span>Add Child</span>
        </button>
      )}
    </div>
  );
}

export function WorkerNode({ data, id }: { data: WorkerNodeData; id: string }) {
  return (
    <div className="group relative min-w-[280px] max-w-[320px] rounded-2xl border border-border-subtle bg-card p-5 text-card-foreground shadow-xl transition-all hover:border-border-strong hover:shadow-2xl">
      {/* Input Connection Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-4 !w-4 !rounded-full !border-2 !border-background !bg-muted-foreground transition-transform hover:scale-150 hover:!bg-primary shadow-md cursor-crosshair"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Worker Node</span>
            <h4 className="text-sm font-bold text-foreground truncate max-w-[170px]">{data.agent.name}</h4>
          </div>
        </div>

        {data.onRemove && (
          <button
            type="button"
            onClick={() => data.onRemove?.(data.agent.id)}
            className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
            title="Remove Worker Node"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-border-subtle pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Wrench className="h-3.5 w-3.5 text-agent-tool" /> {data.agent.mcp_tools?.length || 0} Tools
        </span>
        <span className="flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> {data.agent.skills?.length || 0} Skills
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge variant="worker">Worker</Badge>
        <Badge variant={data.agent.model_provider as 'openai' | 'azure_openai' | 'anthropic' | 'gemini'}>
          {data.agent.model_name}
        </Badge>
      </div>

      {/* Output Connection Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-4 !w-4 !rounded-full !border-2 !border-background !bg-primary transition-transform hover:scale-150 shadow-md cursor-crosshair"
      />

      {/* Quick Add Child Button */}
      {data.onAddChild && (
        <button
          type="button"
          onClick={() => data.onAddChild?.(id)}
          className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 flex items-center space-x-1 rounded-full border border-primary/40 bg-background-surface px-2.5 py-0.5 text-[10px] font-semibold text-primary shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-primary hover:text-primary-foreground"
        >
          <Plus className="h-3 w-3" />
          <span>Add Child</span>
        </button>
      )}
    </div>
  );
}
```

---

### Task 2: Top Navigation Bar & Collapsible Agent Palette

**Files:**
- Create: `frontend/components/workflows/builder/WorkflowTopBar.tsx`
- Create: `frontend/components/workflows/builder/AgentPaletteSidebar.tsx`

- [ ] **Step 1: Implement `WorkflowTopBar.tsx`**

```tsx
// frontend/components/workflows/builder/WorkflowTopBar.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Sparkles, LayoutGrid, Info } from 'lucide-react';

interface WorkflowTopBarProps {
  workflowName: string;
  description: string;
  saving: boolean;
  canSave: boolean;
  onWorkflowNameChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onAutoLayout: () => void;
  onSave: (e: React.FormEvent) => void;
}

export function WorkflowTopBar({
  workflowName,
  description,
  saving,
  canSave,
  onWorkflowNameChange,
  onDescriptionChange,
  onAutoLayout,
  onSave,
}: WorkflowTopBarProps) {
  const router = useRouter();
  const [showDescModal, setShowDescModal] = useState(false);

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-border-subtle bg-background-surface/95 px-5 backdrop-blur">
      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center space-x-1.5 rounded-lg border border-border-subtle bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back</span>
        </button>

        <div className="h-4 w-px bg-border-subtle" />

        <div className="flex items-center space-x-2">
          <input
            type="text"
            required
            placeholder="Untitled Workflow (Click to edit)..."
            value={workflowName}
            onChange={(e) => onWorkflowNameChange(e.target.value)}
            className="w-64 md:w-80 rounded-lg border border-transparent bg-transparent px-2.5 py-1 text-sm font-bold text-foreground transition-colors hover:border-border-subtle focus:border-primary focus:bg-background focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setShowDescModal(!showDescModal)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Edit Description"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onAutoLayout}
          className="flex items-center space-x-1.5 rounded-lg border border-border-subtle bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          title="Cleanly arrange nodes into hierarchical tiers"
        >
          <LayoutGrid className="h-3.5 w-3.5 text-primary" />
          <span>Auto-Layout</span>
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saving || !canSave}
          className="flex items-center space-x-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          <span>{saving ? 'Saving...' : 'Save Workflow'}</span>
        </button>
      </div>

      {showDescModal && (
        <div className="absolute left-32 top-14 z-30 w-96 rounded-xl border border-border-subtle bg-background-surface p-4 shadow-2xl backdrop-blur">
          <label className="text-xs font-semibold uppercase tracking-wider text-foreground">Workflow Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe what goal this multi-agent workflow coordinates..."
            className="mt-2 w-full resize-none rounded-lg border border-border-subtle bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowDescModal(false)}
              className="rounded-lg bg-secondary px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary/80"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement `AgentPaletteSidebar.tsx`**

```tsx
// frontend/components/workflows/builder/AgentPaletteSidebar.tsx
import React, { useState } from 'react';
import { Agent } from '../../../lib/types';
import { Bot, Cpu, Search, Sparkles, Wrench, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Badge } from '../../ui/badge';

interface AgentPaletteSidebarProps {
  supervisors: Agent[];
  workers: Agent[];
  selectedSupervisorId: string;
  selectedWorkerIds: Set<string>;
  onSelectSupervisor: (agentId: string) => void;
  onAddWorker: (agentId: string) => void;
}

export function AgentPaletteSidebar({
  supervisors,
  workers,
  selectedSupervisorId,
  selectedWorkerIds,
  onSelectSupervisor,
  onAddWorker,
}: AgentPaletteSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [search, setSearch] = useState('');

  const filteredSupervisors = supervisors.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredWorkers = workers.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside
      className={`absolute bottom-4 left-4 top-18 z-20 flex flex-col rounded-2xl border border-border-subtle bg-background-surface/98 shadow-2xl backdrop-blur transition-all duration-300 ${
        isCollapsed ? 'w-14' : 'w-80'
      }`}
    >
      <div className="flex h-12 items-center justify-between border-b border-border-subtle px-3.5">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Agent Library</h3>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground mx-auto"
          title={isCollapsed ? 'Expand Agent Library' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex flex-1 flex-col overflow-hidden p-3.5 space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-background py-1.5 pl-8 pr-3 text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {/* Supervisors Section */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Supervisors</span>
              <div className="mt-1.5 space-y-2">
                {filteredSupervisors.map((supervisor) => {
                  const isSelected = selectedSupervisorId === supervisor.id;
                  return (
                    <div
                      key={supervisor.id}
                      onClick={() => onSelectSupervisor(supervisor.id)}
                      className={`group flex cursor-pointer items-center justify-between rounded-xl border p-2.5 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border-subtle bg-background hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-foreground">{supervisor.name}</h4>
                          <span className="text-[10px] text-muted-foreground">{supervisor.model_name}</span>
                        </div>
                      </div>
                      <Badge variant={isSelected ? 'default' : 'outline'}>
                        {isSelected ? 'Active Root' : 'Set Root'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Workers Section */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Workers</span>
              <div className="mt-1.5 space-y-2">
                {filteredWorkers.map((worker) => {
                  const isAttached = selectedWorkerIds.has(worker.id);
                  return (
                    <div
                      key={worker.id}
                      className="group flex items-center justify-between rounded-xl border border-border-subtle bg-background p-2.5 transition-all hover:border-border-strong"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-foreground">
                          <Cpu className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-foreground">{worker.name}</h4>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Wrench className="h-2.5 w-2.5 text-agent-tool" /> {worker.mcp_tools?.length || 0}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Sparkles className="h-2.5 w-2.5 text-primary" /> {worker.skills?.length || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onAddWorker(worker.id)}
                        disabled={isAttached}
                        className="flex items-center space-x-1 rounded-lg border border-border-subtle bg-background-surface px-2 py-1 text-[10px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3" />
                        <span>{isAttached ? 'Added' : 'Add Node'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
```

---

### Task 3: Graph State Synchronization & Auto-Layout Engine

**Files:**
- Modify: `frontend/components/workflows/builder/useWorkflowGraph.ts`
- Modify: `frontend/components/workflows/WorkflowBuilder.tsx`

- [ ] **Step 1: Upgrade `useWorkflowGraph.ts` with quick-connect child action and auto-layout**

```typescript
// Upgraded useWorkflowGraph with autoLayout and onAddChild
```

- [ ] **Step 2: Update `WorkflowBuilder.tsx` to integrate TopBar and Palette**
- [ ] **Step 3: Run full tests and build**

Run: `npm run test:run && npm run build` in `frontend`
Expected: PASS with 0 errors.

---

## Verification Plan

### Automated Verification
1. Run `npm run test:run` in `frontend` to verify node handles, child additions, edge creations, and condition changes.
2. Run `npm run build` in `frontend` to verify zero TypeScript errors.
