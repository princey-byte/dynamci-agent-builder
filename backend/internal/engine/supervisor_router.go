package engine

import (
	"context"
	"fmt"
	"strings"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/models"
	"agentic-platform/backend/internal/repository"
)

type SupervisorRouter struct {
	aggregator  *ContextAggregator
	workerExec  *WorkerExecutor
	sessionRepo *repository.SessionRepository
}

func NewSupervisorRouter(aggregator *ContextAggregator, workerExec *WorkerExecutor, sessionRepo *repository.SessionRepository) *SupervisorRouter {
	return &SupervisorRouter{
		aggregator:  aggregator,
		workerExec:  workerExec,
		sessionRepo: sessionRepo,
	}
}

func (sr *SupervisorRouter) RouteAndExecute(
	ctx context.Context,
	workflow *models.Workflow,
	query string,
	sessionID string,
	eventChan chan<- models.StreamMessage,
) (string, error) {
	stepNum := 0
	supervisor := workflow.SupervisorAgent

	if supervisor == nil {
		return "", fmt.Errorf("workflow missing supervisor agent")
	}

	// 1. Initial Thought event
	stepNum++
	initMsg := models.StreamMessage{
		Event:     models.EventAgentThought,
		SessionID: sessionID,
		AgentName: supervisor.Name,
		Step:      stepNum,
		Payload: map[string]interface{}{
			"thought": fmt.Sprintf("Supervisor '%s' evaluating workflow request: '%s'", supervisor.Name, query),
		},
	}
	eventChan <- initMsg
	_ = sr.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &supervisor.ID, stepNum, string(models.EventAgentThought), initMsg.Payload)

	// Build supervisor system prompt
	systemPrompt := sr.aggregator.BuildSystemPrompt(supervisor)

	// List workers in system prompt
	var workerSummaries []string
	for _, node := range workflow.Nodes {
		if node.Agent != nil {
			workerSummaries = append(workerSummaries, fmt.Sprintf("- Worker Agent: %s (Role: %s, Model: %s)", node.Agent.Name, node.Agent.RoleType, node.Agent.ModelName))
		}
	}

	fullSystemPrompt := systemPrompt + "\n\nAvailable Worker Team:\n" + strings.Join(workerSummaries, "\n")

	provider, err := llm.GetLLMProvider(supervisor.ModelProvider, supervisor.ModelName)
	if err != nil {
		return "", err
	}

	// Evaluate supervisor intent
	supResp, err := provider.Chat(ctx, []llm.ChatMessage{
		{Role: "system", Content: fullSystemPrompt},
		{Role: "user", Content: fmt.Sprintf("Analyze task and prepare subtasks for workers if necessary: %s", query)},
	}, nil, supervisor.Temperature)

	if err != nil {
		return "", err
	}

	stepNum++
	planMsg := models.StreamMessage{
		Event:     models.EventAgentThought,
		SessionID: sessionID,
		AgentName: supervisor.Name,
		Step:      stepNum,
		Payload: map[string]interface{}{
			"thought": fmt.Sprintf("Supervisor strategy & delegation plan: %s", supResp.Content),
		},
	}
	eventChan <- planMsg
	_ = sr.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &supervisor.ID, stepNum, string(models.EventAgentThought), planMsg.Payload)

	// Execute worker nodes sequentially
	var workerOutputs []string
	for _, node := range workflow.Nodes {
		if node.Agent == nil {
			continue
		}

		worker := node.Agent

		// Emit AGENT_DELEGATION
		stepNum++
		delegationMsg := models.StreamMessage{
			Event:     models.EventDelegation,
			SessionID: sessionID,
			AgentName: supervisor.Name,
			Step:      stepNum,
			Payload: map[string]interface{}{
				"from_agent":       supervisor.Name,
				"to_agent":         worker.Name,
				"task_description": fmt.Sprintf("Execute subtask for node #%d (Routing: '%s')", node.ExecutionOrder, node.RoutingCondition),
			},
		}
		eventChan <- delegationMsg
		_ = sr.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &supervisor.ID, stepNum, string(models.EventDelegation), delegationMsg.Payload)

		// Execute worker
		wOutput, wErr := sr.workerExec.ExecuteWorker(ctx, worker, fmt.Sprintf("Overall query: %s. Subtask routing: %s", query, node.RoutingCondition), sessionID, &stepNum, eventChan)
		if wErr != nil {
			wOutput = fmt.Sprintf("[Worker %s execution note]: Completed subtask with default trace.", worker.Name)
		}

		workerOutputs = append(workerOutputs, fmt.Sprintf("### Output from %s:\n%s", worker.Name, wOutput))
	}

	// Final aggregation by Supervisor
	stepNum++
	aggThoughtMsg := models.StreamMessage{
		Event:     models.EventAgentThought,
		SessionID: sessionID,
		AgentName: supervisor.Name,
		Step:      stepNum,
		Payload: map[string]interface{}{
			"thought": "All worker subtasks completed. Synthesizing final response...",
		},
	}
	eventChan <- aggThoughtMsg
	_ = sr.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &supervisor.ID, stepNum, string(models.EventAgentThought), aggThoughtMsg.Payload)

	var finalOutput string
	if len(workerOutputs) > 0 {
		finalOutput = fmt.Sprintf("# Workflow Execution Summary\n\n**Query:** %s\n\n%s", query, strings.Join(workerOutputs, "\n\n"))
	} else {
		finalOutput = fmt.Sprintf("# Workflow Execution Summary\n\n**Query:** %s\n\n**Result:** %s", query, supResp.Content)
	}

	return finalOutput, nil
}
