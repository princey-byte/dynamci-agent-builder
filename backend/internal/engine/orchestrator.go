package engine

import (
	"context"
	"fmt"

	"agentic-platform/backend/internal/mcp"
	"agentic-platform/backend/internal/models"
	"agentic-platform/backend/internal/repository"

	"github.com/google/uuid"
)

type Orchestrator struct {
	workflowRepo *repository.WorkflowRepository
	sessionRepo  *repository.SessionRepository
	toolRegistry *mcp.ToolRegistry
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
		router:       router,
	}
}

func (o *Orchestrator) ExecuteWorkflow(
	ctx context.Context,
	workflowID string,
	query string,
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

	// 1. Create execution session in DB
	session, err := o.sessionRepo.CreateSession(ctx, wf.ID, query)
	if err != nil {
		return fmt.Errorf("failed to initialize execution session: %w", err)
	}

	sessionIDStr := session.ID.String()

	// 2. Execute supervisor routing loop
	finalOutput, execErr := o.router.RouteAndExecute(ctx, wf, query, sessionIDStr, eventChan)

	if execErr != nil {
		_ = o.sessionRepo.UpdateSessionStatus(ctx, session.ID, "ERROR", execErr.Error())
		eventChan <- models.StreamMessage{
			Event:     models.EventError,
			SessionID: sessionIDStr,
			Step:      999,
			Payload: map[string]interface{}{
				"error": execErr.Error(),
			},
		}
		return execErr
	}

	// 3. Mark session complete and stream WORKFLOW_COMPLETE
	_ = o.sessionRepo.UpdateSessionStatus(ctx, session.ID, "COMPLETED", finalOutput)

	completeMsg := models.StreamMessage{
		Event:     models.EventWorkflowComplete,
		SessionID: sessionIDStr,
		Step:      1000,
		Payload: map[string]interface{}{
			"final_output": finalOutput,
			"status":       "COMPLETED",
		},
	}
	eventChan <- completeMsg
	_ = o.sessionRepo.AppendLog(ctx, session.ID, nil, 1000, string(models.EventWorkflowComplete), completeMsg.Payload)

	return nil
}

func parseUUID(s string) uuid.UUID {
	id, _ := uuid.Parse(s)
	return id
}
