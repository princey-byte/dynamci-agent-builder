# In-Canvas Reactive Logs Fix & Multi-Turn Stateful Session Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 
1. **Fix Reactive Log Update Bug**: Ensure selecting any past run in the Execution History popover immediately updates the Live Trace Stream, Step Scrubber, Final Output, and canvas highlights.
2. **Implement Stateful Session Continuation**: Enable users to continue chatting in an existing session where Supervisor and Worker agents maintain full multi-turn conversational memory across sequential turns.

**Architecture:**
- **Backend Memory & Continuation**: Update `stream_handler.go`, `orchestrator.go`, `context_aggregator.go`, and `supervisor_router.go` to accept optional `session_id`. When continuing a session, load past `session_logs` from PostgreSQL, construct multi-turn `[]llm.ChatMessage` history, and continue reasoning from `step = maxStep + 1`.
- **Frontend Reactive Session Binding**: Update `useWorkflowExecution.ts` to provide `loadSessionData(logs, output, query)` and support `startExecution(query, overrideWfId, continueSessionId)`. In `WorkflowBuilder.tsx` and `CanvasExecutionDrawer.tsx`, dynamic placeholder (`Reply / continue in Run #N...`) and seamless appending of streaming steps.

**Tech Stack:** Go (Gin, pgx, PostgreSQL), Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Lucide icons, Base UI/shadcn primitives, Vitest.

---

## File Structure & Responsibilities

```
backend/
├── internal/
│   ├── api/
│   │   └── stream_handler.go        # Read optional session_id query param
│   └── engine/
│       ├── context_aggregator.go    # Add BuildConversationHistory(logs []SessionLog)
│       ├── supervisor_router.go     # Inject multi-turn chat history into LLM prompt
│       └── orchestrator.go          # Handle existing session retrieval, step offset & stateful execution
frontend/
├── hooks/
│   └── useWorkflowExecution.ts      # Add loadSessionData and session continuation support
├── components/
│   └── workflows/
│       ├── WorkflowBuilder.tsx      # Fix reactive log loading on session switch & pass continueSessionId
│       └── builder/
│           ├── CanvasExecutionDrawer.tsx # Dynamic follow-up input placeholder & multi-turn thread support
│           └── RunHistorySelector.tsx    # Run selection indicators & new run toggle
```

---

### Task 1: Backend - Stateful Session Continuation & Memory Aggregation

**Files:**
- Modify: `backend/internal/api/stream_handler.go`
- Modify: `backend/internal/engine/context_aggregator.go`
- Modify: `backend/internal/engine/supervisor_router.go`
- Modify: `backend/internal/engine/orchestrator.go`

- [ ] **Step 1: Read optional `session_id` in `backend/internal/api/stream_handler.go`**

```go
func (h *StreamHandler) ExecuteStream(c *gin.Context) {
	workflowID := c.Param("id")
	query := c.Query("query")
	sessionIDStr := c.Query("session_id")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter is required"})
		return
	}

	var existingSessionID *uuid.UUID
	if sessionIDStr != "" {
		if parsed, err := uuid.Parse(sessionIDStr); err == nil {
			existingSessionID = &parsed
		}
	}

	eventChan := make(chan models.StreamMessage, 100)

	go func() {
		defer close(eventChan)
		_ = h.orchestrator.ExecuteWorkflow(c.Request.Context(), workflowID, query, existingSessionID, eventChan)
	}()

	sse.HandleSSEStream(c.Writer, c.Request, eventChan)
}
```

- [ ] **Step 2: Add `BuildConversationHistory` in `backend/internal/engine/context_aggregator.go`**

```go
func (ca *ContextAggregator) BuildConversationHistory(logs []models.SessionLog) []llm.ChatMessage {
	var messages []llm.ChatMessage
	for _, l := range logs {
		if l.LogType == string(models.EventAgentThought) {
			if contentMap, ok := l.Content.(map[string]interface{}); ok {
				if thought, ok := contentMap["thought"].(string); ok && thought != "" {
					messages = append(messages, llm.ChatMessage{
						Role:    "assistant",
						Content: fmt.Sprintf("[%s]: %s", l.AgentName, thought),
					})
				}
			}
		}
	}
	return messages
}
```

- [ ] **Step 3: Update `SupervisorRouter` in `backend/internal/engine/supervisor_router.go` to accept prior messages & start step**

```go
func (sr *SupervisorRouter) RouteAndExecute(
	ctx context.Context,
	workflow *models.Workflow,
	query string,
	sessionID string,
	priorHistory []llm.ChatMessage,
	startStep int,
	eventChan chan<- models.StreamMessage,
) (string, error) {
	stepNum := startStep
	supervisor := workflow.SupervisorAgent
	...
	// Prepend prior conversational history before new user query
	chatMessages := []llm.ChatMessage{
		{Role: "system", Content: fullSystemPrompt},
	}
	if len(priorHistory) > 0 {
		chatMessages = append(chatMessages, priorHistory...)
	}
	chatMessages = append(chatMessages, llm.ChatMessage{
		Role:    "user",
		Content: fmt.Sprintf("Analyze task and prepare subtasks for workers if necessary: %s", query),
	})

	supResp, err := provider.Chat(ctx, chatMessages, nil, supervisor.Temperature)
```

- [ ] **Step 4: Update `Orchestrator.ExecuteWorkflow` in `backend/internal/engine/orchestrator.go`**

- If `existingSessionID != nil`, load session from `sessionRepo.GetByID`, extract `priorLogs`, calculate `maxStep`, and build `priorHistory`.
- Append new user turn to execution session.
- When complete, update `final_output` (appending to prior output if multi-turn) and set status `COMPLETED`.

- [ ] **Step 5: Run backend tests**
Run: `go test ./...` in `backend`
Expected: PASS

---

### Task 2: Frontend - Reactive Log Swapping in Execution Hook

**Files:**
- Modify: `frontend/hooks/useWorkflowExecution.ts`

- [ ] **Step 1: Add `loadSessionData` and `continueSessionId` in `useWorkflowExecution.ts`**

```typescript
// In frontend/hooks/useWorkflowExecution.ts
const loadSessionData = useCallback(
  (loadedLogs: SSELogEvent[], output: string | null, status: 'idle' | 'running' | 'completed' | 'error' = 'completed') => {
    setLogs(loadedLogs);
    setFinalOutput(output);
    setStatus(status);
    setActiveNodeId(null);
  },
  []
);

const startExecution = useCallback(
  (query: string, overrideWorkflowId?: string, continueSessionId?: string | null) => {
    const targetId = overrideWorkflowId || workflowId;
    if (!targetId) return;

    // If continuing an existing session, preserve previous logs; otherwise reset
    if (!continueSessionId) {
      setLogs([]);
      setFinalOutput(null);
      setNodeStatuses({});
      setEdgeStatuses({});
    }
    setStatus('running');
    setActiveNodeId(null);

    const encodedQuery = encodeURIComponent(query);
    let url = `${API_BASE}/workflows/${targetId}/execute/stream?query=${encodedQuery}`;
    if (continueSessionId) {
      url += `&session_id=${encodeURIComponent(continueSessionId)}`;
    }

    const eventSource = new EventSource(url);
    ...
```

---

### Task 3: Frontend - Interactive Studio Multi-Turn UI Integration

**Files:**
- Modify: `frontend/components/workflows/WorkflowBuilder.tsx`
- Modify: `frontend/components/workflows/builder/CanvasExecutionDrawer.tsx`

- [ ] **Step 1: Wire `loadSessionData` into `handleSelectSession` in `WorkflowBuilder.tsx`**

When the user selects any past run in the dropdown:
1. Fetch full session details via `api.getSession(sessionId)`
2. Map `fullSession.logs` into `mappedLogs: SSELogEvent[]`
3. Call `loadSessionData(mappedLogs, fullSession.final_output, fullSession.status === 'ERROR' ? 'error' : 'completed')`
4. Set `testQuery('')` (or empty string ready for follow-up prompt)
5. Reconstruct and apply `historicalNodeStatuses` and `historicalEdgeStatuses` on the canvas.

- [ ] **Step 2: Connect multi-turn session continuation in `handleRunExecution`**

In `handleRunExecution`:
- If `!isNewRunMode && selectedSessionId`: pass `selectedSessionId` to `startExecution(testQuery, targetWfId, selectedSessionId)`.
- If `isNewRunMode`: pass `null` for `continueSessionId` to launch a new run.

- [ ] **Step 3: Update `CanvasExecutionDrawer.tsx` query placeholder & UI indicators**

- In `CanvasExecutionDrawer.tsx`:
  - When in continuation mode (`!isNewRunMode && selectedSessionId`):
    `placeholder={`Reply / continue conversation in Run #${currentRunNumber}...`}`
  - When in clean mode (`isNewRunMode`):
    `placeholder="Type task query to test run workflow..."`

---

### Task 4: Verification & Automated Tests

- [ ] **Step 1: Run frontend unit tests**
Run: `npm run test:run` in `frontend`
Expected: PASS 35/35

- [ ] **Step 2: Run frontend production build**
Run: `npm run build` in `frontend`
Expected: Next.js Turbopack compiles all 15 routes cleanly

- [ ] **Step 3: Run backend Go tests**
Run: `go test ./...` in `backend`
Expected: PASS 100%
