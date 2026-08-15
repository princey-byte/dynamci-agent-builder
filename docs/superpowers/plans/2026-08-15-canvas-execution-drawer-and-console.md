# Plan 2: Interactive In-Canvas Execution Dock & Multi-Tab Thought Console Drawer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a responsive, collapsible bottom drawer console docked directly inside the visual canvas studio, allowing users to input test queries, trigger executions, observe live SSE thought streaming, scrub historical steps, and copy formatted final markdown outputs without obscuring graph nodes.

**Architecture:** Create `CanvasExecutionDrawer.tsx` with floating minimized and expanded modes (`h-14` collapsed bar $\leftrightarrow$ `h-[420px]` full console). Provide tabbed navigation for (1) **Live Trace Stream**, (2) **Step-by-Step Timeline Scrubber**, and (3) **Synthesized Markdown Output**.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Lucide React, Tailwind CSS 4, Vitest.

---

## File Structure & Responsibilities

- `frontend/components/workflows/builder/CanvasExecutionDrawer.tsx`: The docked bottom execution console containing the query input bar, tab navigation, minimize/maximize toggles, and live stream views.
- `frontend/components/workflows/builder/OutputMarkdownViewer.tsx`: Formatted markdown preview component with copy-to-clipboard button and token usage summary.
- `frontend/components/workflows/builder/ExecutionStepTimeline.tsx`: Horizontal step timeline showing agent transitions and status pills.
- `frontend/components/workflows/WorkflowBuilder.tsx`: Integrate the execution drawer with canvas studio state.

---

### Task 1: Execution Drawer Shell & Tab Navigation

**Files:**
- Create: `frontend/components/workflows/builder/CanvasExecutionDrawer.tsx`
- Create: `frontend/components/workflows/builder/OutputMarkdownViewer.tsx`

- [ ] **Step 1: Implement `OutputMarkdownViewer.tsx`**

```tsx
// frontend/components/workflows/builder/OutputMarkdownViewer.tsx
import React, { useState } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';

interface OutputMarkdownViewerProps {
  output: string | null;
  status: 'idle' | 'running' | 'completed' | 'error';
}

export function OutputMarkdownViewer({ output, status }: OutputMarkdownViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'running') {
    return (
      <div className="flex h-48 flex-col items-center justify-center space-y-2 text-muted-foreground">
        <Sparkles className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs font-mono">Synthesizing final workflow output from worker agents...</p>
      </div>
    );
  }

  if (!output) {
    return (
      <div className="flex h-48 items-center justify-center text-xs font-mono text-muted-foreground">
        No output generated yet. Run the workflow to inspect synthesized results.
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-border bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Final Workflow Output</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center space-x-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-agent-success" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="prose prose-invert max-w-none text-xs font-sans whitespace-pre-wrap leading-relaxed text-foreground">
        {output}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `CanvasExecutionDrawer.tsx`**

```tsx
// frontend/components/workflows/builder/CanvasExecutionDrawer.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Play, ChevronUp, ChevronDown, Terminal, Clock, FileText, Trash2 } from 'lucide-react';
import { SSELogEvent } from '../../../lib/types';
import { EventRenderer } from '../../console/EventRenderer';
import { SSEStatusPill } from '../../console/SSEStatusPill';
import { OutputMarkdownViewer } from './OutputMarkdownViewer';
import { SessionReplayScrubber } from '../../sessions/SessionReplayScrubber';

interface CanvasExecutionDrawerProps {
  logs: SSELogEvent[];
  status: 'idle' | 'running' | 'completed' | 'error';
  finalOutput: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  onRun: (e: React.FormEvent) => void;
  onClearLogs: () => void;
}

export function CanvasExecutionDrawer({
  logs,
  status,
  finalOutput,
  query,
  onQueryChange,
  onRun,
  onClearLogs,
}: CanvasExecutionDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'stream' | 'timeline' | 'output'>('stream');
  const [scrubbedStep, setScrubbedStep] = useState<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-expand and scroll down when execution begins
  useEffect(() => {
    if (status === 'running') {
      setIsExpanded(true);
    }
  }, [status]);

  useEffect(() => {
    if (activeTab === 'stream' && isExpanded) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab, isExpanded]);

  useEffect(() => {
    if (logs.length > 0) {
      setScrubbedStep(logs.length - 1);
    }
  }, [logs.length]);

  return (
    <div
      className={`absolute inset-x-6 bottom-4 z-40 flex flex-col rounded-2xl border border-border bg-card/98 shadow-2xl backdrop-blur transition-all duration-300 ${
        isExpanded ? 'h-[440px]' : 'h-14'
      }`}
    >
      {/* Header Dock Bar */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-border/80">
        <form onSubmit={onRun} className="flex flex-1 items-center space-x-3 mr-4">
          <input
            type="text"
            required
            placeholder="Type task query to test run workflow (e.g. Audit security compliance for PR #104)..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            disabled={status === 'running'}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={status === 'running' || !query.trim()}
            className="flex items-center space-x-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{status === 'running' ? 'Executing...' : 'Run Test'}</span>
          </button>
        </form>

        <div className="flex items-center space-x-2 border-l border-border pl-4">
          <SSEStatusPill status={status} />
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title={isExpanded ? 'Minimize Console' : 'Expand Console'}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Console Body */}
      {isExpanded && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-border px-4 py-1.5 bg-secondary/30">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('stream')}
                className={`flex items-center space-x-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  activeTab === 'stream'
                    ? 'bg-card text-primary shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Live Trace ({logs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center space-x-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  activeTab === 'timeline'
                    ? 'bg-card text-primary shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Step Scrubber</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('output')}
                className={`flex items-center space-x-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  activeTab === 'output'
                    ? 'bg-card text-primary shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Final Output</span>
              </button>
            </div>

            {logs.length > 0 && (
              <button
                type="button"
                onClick={onClearLogs}
                className="flex items-center space-x-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear Logs</span>
              </button>
            )}
          </div>

          {/* Tab Views */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-foreground">
            {activeTab === 'stream' && (
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
                    <Terminal className="h-6 w-6 mb-2 opacity-40" />
                    <p>Ready to execute. Enter a query above and click "Run Test".</p>
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <EventRenderer key={`${log.session_id}-${log.step}-${index}`} log={log} />
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <SessionReplayScrubber
                  currentStepIndex={scrubbedStep}
                  totalSteps={logs.length}
                  onStepChange={setScrubbedStep}
                />
                <div className="space-y-2">
                  {logs.slice(0, scrubbedStep + 1).map((log, index) => (
                    <EventRenderer key={`scrubbed-${index}`} log={log} />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'output' && (
              <OutputMarkdownViewer output={finalOutput} status={status} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Task 2: Integration with Workflow Builder Studio

**Files:**
- Modify: `frontend/components/workflows/WorkflowBuilder.tsx`

- [ ] **Step 1: Integrate `CanvasExecutionDrawer` into `WorkflowBuilder.tsx`**
- [ ] **Step 2: Connect auto-save bridge and execution hook**
- [ ] **Step 3: Run full Vitest test suite**

---

## Verification Plan

### Automated Tests
1. Run `npm run test:run` in `frontend` to verify drawer tab switching, scrubbing, and log clearing.
2. Run `npm run build` in `frontend` to verify complete type safety.
