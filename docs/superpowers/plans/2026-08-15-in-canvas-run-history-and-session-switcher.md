# In-Canvas Run History & Multi-Session Execution Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full In-Canvas Run History and Multi-Session Execution Management in the Workflow Studio so users can inspect past runs, compare agent outputs, switch between historical execution sessions, and start fresh test runs with clean canvas state.

**Architecture:** 
- **Backend:** Add `GET /api/v1/workflows/:id/sessions` endpoint in Go (Gin/pgx) to fetch all historical execution sessions for a given workflow.
- **Frontend API & Types:** Add typed `api.getWorkflowSessions(workflowId)` client method.
- **Frontend UI & State:** Create an interactive `RunHistorySelector` in `CanvasExecutionDrawer.tsx` allowing 1-click switching between historical runs, "+ New Test Run" clean mode, real-time list updates upon execution finish, and canvas graph path illumination for any selected historical run.

**Tech Stack:** Go (Gin, pgx, PostgreSQL), Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Lucide icons, Base UI/shadcn primitives, Vitest.

---

## File Structure & Responsibilities

```
backend/
├── internal/
│   ├── api/
│   │   ├── session_handler.go      # Add ListWorkflowSessions handler
│   │   └── routes.go               # Register GET /api/v1/workflows/:id/sessions
│   └── repository/
│       └── session_repository.go   # Add ListWorkflowSessions(ctx, workflowID)
frontend/
├── lib/
│   └── api.ts                      # Add getWorkflowSessions(workflowId)
├── components/
│   └── workflows/
│       ├── WorkflowBuilder.tsx     # Session history state management & run switching
│       └── builder/
│           ├── CanvasExecutionDrawer.tsx  # Run history selector toolbar & "+ New Test Run" button
│           ├── RunHistorySelector.tsx     # Custom dropdown popover for browsing and selecting past runs
│           └── types.ts                   # Extended session & history types
```

---

### Task 1: Backend - Dedicated Workflow Sessions Endpoint

**Files:**
- Modify: `backend/internal/repository/session_repository.go`
- Modify: `backend/internal/api/session_handler.go`
- Modify: `backend/internal/api/routes.go`

- [ ] **Step 1: Add `ListWorkflowSessions` to `backend/internal/repository/session_repository.go`**

```go
func (r *SessionRepository) ListWorkflowSessions(ctx context.Context, workflowID uuid.UUID) ([]models.ExecutionSession, error) {
	query := `
		SELECT id, workflow_id, status, input_query, COALESCE(final_output, ''), started_at, completed_at 
		FROM execution_sessions 
		WHERE workflow_id = $1 
		ORDER BY started_at DESC
	`
	rows, err := r.pool.Query(ctx, query, workflowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []models.ExecutionSession
	for rows.Next() {
		var s models.ExecutionSession
		if err := rows.Scan(&s.ID, &s.WorkflowID, &s.Status, &s.InputQuery, &s.FinalOutput, &s.StartedAt, &s.CompletedAt); err == nil {
			sessions = append(sessions, s)
		}
	}
	return sessions, nil
}
```

- [ ] **Step 2: Add `ListWorkflowSessions` handler in `backend/internal/api/session_handler.go`**

```go
func (h *SessionHandler) ListWorkflowSessions(c *gin.Context) {
	wfID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workflow ID"})
		return
	}
	sessions, err := h.repo.ListWorkflowSessions(c.Request.Context(), wfID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sessions)
}
```

- [ ] **Step 3: Register route in `backend/internal/api/routes.go`**

```go
v1.GET("/workflows/:id/sessions", sessionHandler.ListWorkflowSessions)
```

- [ ] **Step 4: Run backend tests to verify**

Run: `cd /mnt/agentic-app/backend && go test ./...`
Expected: PASS

---

### Task 2: Frontend API Client & Run History Dropdown Component

**Files:**
- Modify: `frontend/lib/api.ts`
- Create: `frontend/components/workflows/builder/RunHistorySelector.tsx`

- [ ] **Step 1: Add `getWorkflowSessions` to `frontend/lib/api.ts`**

```typescript
// In frontend/lib/api.ts
getWorkflowSessions: (workflowId: string): Promise<ExecutionSession[]> => 
  fetchJSON<ExecutionSession[]>(`${API_BASE}/workflows/${workflowId}/sessions`),
```

- [ ] **Step 2: Create `frontend/components/workflows/builder/RunHistorySelector.tsx`**

Build a clean, accessible dropdown popover displaying:
- Current selected session label (e.g. `🕒 Run #3 • Today 09:30 AM (Completed)`) or `➕ New Test Run (Ready)`
- Dropdown list with status pills (Green `Completed`, Red `Error`, Yellow `Running`), run index, formatted query preview, timestamp, and duration
- Search/filter if list has multiple runs

```tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ExecutionSession } from '../../../lib/types';
import { History, ChevronDown, CheckCircle2, AlertCircle, Clock, Plus, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface RunHistorySelectorProps {
  sessions: ExecutionSession[];
  selectedSessionId: string | null;
  isNewRunMode: boolean;
  isRunning: boolean;
  onSelectSession: (sessionId: string) => void;
  onNewRun: () => void;
}

export function RunHistorySelector({
  sessions,
  selectedSessionId,
  isNewRunMode,
  isRunning,
  onSelectSession,
  onNewRun,
}: RunHistorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalSessions = sessions.length;
  const currentSelectedSession = sessions.find((s) => s.id === selectedSessionId);
  const currentRunIndex = currentSelectedSession 
    ? totalSessions - sessions.findIndex((s) => s.id === selectedSessionId)
    : totalSessions;

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative inline-flex items-center gap-1.5" ref={dropdownRef}>
      {/* Run Selector Button */}
      <button
        type="button"
        disabled={isRunning}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 rounded-lg border border-border bg-card/80 px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-muted disabled:opacity-50 shadow-sm"
      >
        <History className="h-3.5 w-3.5 text-primary" />
        <span className="truncate max-w-[180px]">
          {isNewRunMode || !currentSelectedSession
            ? '➕ New Test Run'
            : `Run #${currentRunIndex} • ${formatTimestamp(currentSelectedSession.started_at)}`}
        </span>
        {currentSelectedSession && !isNewRunMode && (
          <span
            className={`h-2 w-2 rounded-full ${
              currentSelectedSession.status === 'COMPLETED'
                ? 'bg-agent-success'
                : currentSelectedSession.status === 'ERROR'
                ? 'bg-destructive'
                : 'bg-primary animate-ping'
            }`}
          />
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {/* Quick New Run Button */}
      <button
        type="button"
        disabled={isRunning || isNewRunMode}
        onClick={onNewRun}
        className="flex items-center space-x-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground disabled:opacity-50 shadow-sm"
        title="Start a fresh execution test"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>New Run</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-80 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-2xl backdrop-blur animate-fade-in text-card-foreground">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50 text-[11px] font-bold text-muted-foreground uppercase">
            <span>Execution History ({totalSessions})</span>
            <Link
              href="/sessions"
              className="flex items-center space-x-1 text-primary hover:underline"
            >
              <span>All Sessions</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-1 space-y-1">
            {/* New Run Option */}
            <button
              type="button"
              onClick={() => {
                onNewRun();
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                isNewRunMode
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Plus className="h-3.5 w-3.5" />
                <span>+ New Test Run (Clean State)</span>
              </div>
            </button>

            {/* List of Past Runs */}
            {sessions.map((sess, idx) => {
              const runNumber = totalSessions - idx;
              const isSelected = !isNewRunMode && selectedSessionId === sess.id;

              return (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => {
                    onSelectSession(sess.id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full flex-col rounded-lg p-2 text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-primary/15 border border-primary/40 text-foreground font-semibold'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {sess.status === 'COMPLETED' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-agent-success" />
                      ) : sess.status === 'ERROR' ? (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-primary animate-spin" />
                      )}
                      <span className="font-bold">Run #{runNumber}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTimestamp(sess.started_at)}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground font-normal">
                    {sess.input_query || 'No query input'}
                  </p>
                </button>
              );
            })}

            {sessions.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No past executions yet. Click "Run Test" below to start.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Task 3: In-Canvas Execution Drawer Integration & State Coordination

**Files:**
- Modify: `frontend/components/workflows/builder/CanvasExecutionDrawer.tsx`
- Modify: `frontend/components/workflows/WorkflowBuilder.tsx`
- Modify: `frontend/app/(dashboard)/workflows/[id]/page.tsx`

- [ ] **Step 1: Update `CanvasExecutionDrawer.tsx` to include `RunHistorySelector` in top toolbar**

Add props:
- `sessions: ExecutionSession[]`
- `selectedSessionId: string | null`
- `isNewRunMode: boolean`
- `onSelectSession: (id: string) => void`
- `onNewRun: () => void`

Place `RunHistorySelector` directly in the collapsed dock and expanded drawer header next to the query input!

- [ ] **Step 2: Update `WorkflowBuilder.tsx` to manage sessions list and switching**

- Maintain `sessions: ExecutionSession[]` and `selectedSessionId: string | null`
- Implement `handleSelectSession(sessionId: string)`:
  - Fetches full session from `api.getSession(sessionId)`
  - Reconstructs logs, final output, and sets `isNewRunMode = false`
  - Reconstructs active node statuses (`nodeStatuses`) and traversed edges (`edgeStatuses`) from that session's logs so the canvas illuminates the exact historical execution path!
- Implement `handleNewRun()`:
  - Resets `selectedSessionId = null`, `isNewRunMode = true`
  - Clears logs, output, and resets canvas node/edge highlights to neutral
- After execution finishes:
  - Automatically fetches `api.getWorkflowSessions(workflowId)` to update the run history list and sets the newly completed run as active.

- [ ] **Step 3: Update `app/(dashboard)/workflows/[id]/page.tsx`**

- Fetch all sessions for this workflow using `api.getWorkflowSessions(id)`
- Default to `isNewRunMode = true` if user wants fresh start, or initialize with the latest run with explicit indicator that it is `Run #N`.

---

### Task 4: Verification & Automated Tests

- [ ] **Step 1: Run frontend Vitest tests**
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

1. **Brand New Workflow (0 Runs)**: Dropdown shows `➕ New Test Run (Ready)` and explains that no executions exist yet.
2. **Switching Between Multi-Day Runs**: Canvas immediately highlights the specific agents and condition wires that fired for that specific run, with no data leaks between runs.
3. **Execution in Flight**: Dropdown is disabled during active streaming to prevent state tearing.
4. **Auto-Refresh on Completion**: New execution instantly inserts `Run #N+1` at the top of the history list with zero page reload.
5. **Clean Mode**: "+ New Run" provides a dedicated blank slate so the user is never confused about whether they are viewing old logs or starting a fresh test.
