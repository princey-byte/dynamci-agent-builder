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
	aggregator   *ContextAggregator
	workerExec   *WorkerExecutor
	branchRouter *BranchRouter
	sessionRepo  *repository.SessionRepository
}

func NewGraphExecutor(aggregator *ContextAggregator, workerExec *WorkerExecutor, sessionRepo *repository.SessionRepository) *GraphExecutor {
	evaluator := NewConditionEvaluator(nil)
	return &GraphExecutor{
		aggregator:   aggregator,
		workerExec:   workerExec,
		branchRouter: NewBranchRouter(evaluator, 5),
		sessionRepo:  sessionRepo,
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
	skippedNodes := make(map[uuid.UUID]bool)
	var finalSyntheses []string

	for _, node := range orderedNodes {
		if node.Agent == nil {
			continue
		}

		// Check if this node was skipped by all incoming edges
		incomingEdges := dag.GetIncomingEdges(node.ID)
		if len(incomingEdges) > 0 {
			allSkipped := true
			for _, inEdge := range incomingEdges {
				// If source node executed and was not skipped, check if inEdge was active
				if !skippedNodes[inEdge.SourceNodeID] {
					allSkipped = false
					break
				}
			}
			if allSkipped {
				skippedNodes[node.ID] = true
				*stepNum++
				skipMsg := models.StreamMessage{
					Event:     models.EventBranchSkipped,
					SessionID: sessionID,
					AgentName: node.Agent.Name,
					Step:      *stepNum,
					Payload: map[string]interface{}{
						"node_id":    node.ID.String(),
						"agent_id":   node.Agent.ID.String(),
						"agent_name": node.Agent.Name,
						"reason":     "All upstream parent branches were skipped",
					},
				}
				eventChan <- skipMsg
				_ = ge.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &node.Agent.ID, *stepNum, string(models.EventBranchSkipped), skipMsg.Payload)
				continue
			}
		}

		// Gather context from all incoming parent nodes
		var parentContexts []string
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
				"node_id":          node.ID.String(),
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

		// Evaluate outgoing conditional branches
		outgoingEdges := dag.GetOutgoingEdges(node.ID)
		if len(outgoingEdges) > 0 {
			evalResults, evalErr := ge.branchRouter.EvaluateOutgoingEdges(ctx, outgoingEdges, output)
			if evalErr == nil {
				for _, res := range evalResults {
					*stepNum++
					if res.Matched {
						condMsg := models.StreamMessage{
							Event:     models.EventConditionEvaluated,
							SessionID: sessionID,
							AgentName: node.Agent.Name,
							Step:      *stepNum,
							Payload: map[string]interface{}{
								"edge_id":        res.Edge.ID.String(),
								"source_node_id": res.Edge.SourceNodeID.String(),
								"target_node_id": res.TargetNodeID.String(),
								"condition_type": res.Edge.ConditionType,
								"label":          res.Edge.Label,
								"reason":         res.Reason,
								"status":         "MATCHED",
							},
						}
						eventChan <- condMsg
						_ = ge.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &node.Agent.ID, *stepNum, string(models.EventConditionEvaluated), condMsg.Payload)
					} else {
						// Mark target node skipped if this was the sole incoming path
						skipMsg := models.StreamMessage{
							Event:     models.EventBranchSkipped,
							SessionID: sessionID,
							AgentName: node.Agent.Name,
							Step:      *stepNum,
							Payload: map[string]interface{}{
								"edge_id":        res.Edge.ID.String(),
								"source_node_id": res.Edge.SourceNodeID.String(),
								"target_node_id": res.TargetNodeID.String(),
								"condition_type": res.Edge.ConditionType,
								"label":          res.Edge.Label,
								"reason":         res.Reason,
								"status":         "SKIPPED",
							},
						}
						eventChan <- skipMsg
						_ = ge.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &node.Agent.ID, *stepNum, string(models.EventBranchSkipped), skipMsg.Payload)
					}
				}
			}
		}
	}

	return strings.Join(finalSyntheses, "\n\n"), nil
}
