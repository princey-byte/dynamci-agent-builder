package engine

import (
	"context"
	"fmt"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/mcp"
	"agentic-platform/backend/internal/models"
	"agentic-platform/backend/internal/repository"

	"github.com/google/uuid"
)

type Orchestrator struct {
	workflowRepo *repository.WorkflowRepository
	sessionRepo  *repository.SessionRepository
	toolRegistry *mcp.ToolRegistry
	aggregator   *ContextAggregator
	router       *SupervisorRouter
}

func NewOrchestrator(
	workflowRepo *repository.WorkflowRepository,
	sessionRepo *repository.SessionRepository,
	toolRegistry *mcp.ToolRegistry,
) *Orchestrator {
	aggregator := NewContextAggregator()
	workerExec := NewWorkerExecutor(aggregator, toolRegistry, sessionRepo)
	router := NewSupervisorRouter(aggregator, workerExec, sessionRepo)

	return &Orchestrator{
		workflowRepo: workflowRepo,
		sessionRepo:  sessionRepo,
		toolRegistry: toolRegistry,
		aggregator:   aggregator,
		router:       router,
	}
}

func (o *Orchestrator) ExecuteWorkflow(
	ctx context.Context,
	workflowID string,
	query string,
	existingSessionID *uuid.UUID,
	eventChan chan<- models.StreamMessage,
) error {
	wfUUID, err := uuid.Parse(workflowID)
	if err != nil {
		return fmt.Errorf("invalid workflow ID format: %w", err)
	}

	wf, err := o.workflowRepo.GetByID(ctx, wfUUID)
	if err != nil {
		return fmt.Errorf("workflow not found: %w", err)
	}

	var session *models.ExecutionSession
	var priorHistory []llm.ChatMessage
	startStep := 0
	var previousFinalOutput string

	if existingSessionID != nil {
		// Continuation of an existing multi-turn session
		session, err = o.sessionRepo.GetByID(ctx, *existingSessionID)
		if err != nil {
			return fmt.Errorf("session not found: %w", err)
		}
		previousFinalOutput = session.FinalOutput
		if len(session.Logs) > 0 {
			priorHistory = o.aggregator.BuildConversationHistory(session.Logs)
			for _, l := range session.Logs {
				if l.StepNumber > startStep {
					startStep = l.StepNumber
				}
			}
		}
		_ = o.sessionRepo.UpdateSessionStatus(ctx, session.ID, "RUNNING", "")
	} else {
		// Create brand new execution session in DB
		session, err = o.sessionRepo.CreateSession(ctx, wf.ID, query)
		if err != nil {
			return fmt.Errorf("failed to initialize execution session: %w", err)
		}
	}

	sessionIDStr := session.ID.String()

	// Execute supervisor routing loop with memory context
	finalOutput, execErr := o.router.RouteAndExecute(ctx, wf, query, sessionIDStr, priorHistory, startStep, eventChan)

	if execErr != nil {
		_ = o.sessionRepo.UpdateSessionStatus(ctx, session.ID, "ERROR", execErr.Error())
		eventChan <- models.StreamMessage{
			Event:     models.EventError,
			SessionID: sessionIDStr,
			Step:      startStep + 999,
			Payload: map[string]interface{}{
				"error": execErr.Error(),
			},
		}
		return execErr
	}

	// For multi-turn conversations, combine previous output and new turn output
	accumulatedOutput := finalOutput
	if previousFinalOutput != "" {
		accumulatedOutput = fmt.Sprintf("%s\n\n---\n\n%s", previousFinalOutput, finalOutput)
	}

	// Mark session complete and stream WORKFLOW_COMPLETE
	_ = o.sessionRepo.UpdateSessionStatus(ctx, session.ID, "COMPLETED", accumulatedOutput)

	completeStep := startStep + 1000
	completeMsg := models.StreamMessage{
		Event:     models.EventWorkflowComplete,
		SessionID: sessionIDStr,
		Step:      completeStep,
		Payload: map[string]interface{}{
			"final_output": accumulatedOutput,
			"status":       "COMPLETED",
		},
	}
	eventChan <- completeMsg
	_ = o.sessionRepo.AppendLog(ctx, session.ID, nil, completeStep, string(models.EventWorkflowComplete), completeMsg.Payload)

	return nil
}

func parseUUID(s string) uuid.UUID {
	id, _ := uuid.Parse(s)
	return id
}
