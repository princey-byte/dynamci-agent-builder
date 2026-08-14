package engine

import (
	"context"
	"fmt"
	"strings"

	"agentic-platform/backend/internal/models"
	"agentic-platform/backend/internal/repository"

	"github.com/google/uuid"
)

type GraphExecutor struct {
	aggregator  *ContextAggregator
	workerExec  *WorkerExecutor
	sessionRepo *repository.SessionRepository
}

func NewGraphExecutor(aggregator *ContextAggregator, workerExec *WorkerExecutor, sessionRepo *repository.SessionRepository) *GraphExecutor {
	return &GraphExecutor{
		aggregator:  aggregator,
		workerExec:  workerExec,
		sessionRepo: sessionRepo,
	}
}

func (ge *GraphExecutor) ExecuteDAG(
	ctx context.Context,
	workflow *models.Workflow,
	query string,
	sessionID string,
	stepNum *int,
	eventChan chan<- models.StreamMessage,
) (string, error) {
	if len(workflow.Nodes) == 0 {
		return "Workflow has no worker nodes configured.", nil
	}

	dag, err := BuildDAG(workflow.Nodes, workflow.Edges)
	if err != nil {
		return "", fmt.Errorf("DAG build error: %w", err)
	}

	orderedNodes, err := dag.TopologicalSort()
	if err != nil {
		return "", fmt.Errorf("workflow execution failed topological ordering: %w", err)
	}

	nodeOutputs := make(map[uuid.UUID]string)
	var finalSyntheses []string

	for _, node := range orderedNodes {
		if node.Agent == nil {
			continue
		}

		// Gather context from all incoming parent nodes
		var parentContexts []string
		incomingEdges := dag.GetIncomingEdges(node.ID)
		for _, edge := range incomingEdges {
			if out, ok := nodeOutputs[edge.SourceNodeID]; ok && out != "" {
				parentContexts = append(parentContexts, fmt.Sprintf("Context from upstream node:\n%s", out))
			}
		}

		subtaskPrompt := fmt.Sprintf("Primary Query: %s\nRouting: %s", query, node.RoutingCondition)
		if len(parentContexts) > 0 {
			subtaskPrompt += "\n\nUpstream Context From Previous Stages:\n" + strings.Join(parentContexts, "\n---\n")
		}

		*stepNum++
		delMsg := models.StreamMessage{
			Event:     models.EventDelegation,
			SessionID: sessionID,
			AgentName: node.Agent.Name,
			Step:      *stepNum,
			Payload: map[string]interface{}{
				"agent_id":         node.Agent.ID.String(),
				"agent_name":       node.Agent.Name,
				"task_description": fmt.Sprintf("Processing node (Routing: %s)", node.RoutingCondition),
			},
		}
		eventChan <- delMsg
		_ = ge.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &node.Agent.ID, *stepNum, string(models.EventDelegation), delMsg.Payload)

		output, execErr := ge.workerExec.ExecuteWorker(ctx, node.Agent, subtaskPrompt, sessionID, stepNum, eventChan)
		if execErr != nil {
			output = fmt.Sprintf("[Node %s Execution Note]: Recovered with partial output: %v", node.Agent.Name, execErr)
		}

		nodeOutputs[node.ID] = output
		finalSyntheses = append(finalSyntheses, fmt.Sprintf("### %s Output:\n%s", node.Agent.Name, output))
	}

	return strings.Join(finalSyntheses, "\n\n"), nil
}
