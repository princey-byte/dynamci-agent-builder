package repository

import (
	"context"
	"fmt"
	"log"
	"time"

	"agentic-platform/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WorkflowRepository struct {
	pool      *pgxpool.Pool
	agentRepo *AgentRepository
}

func NewWorkflowRepository(pool *pgxpool.Pool, agentRepo *AgentRepository) *WorkflowRepository {
	return &WorkflowRepository{pool: pool, agentRepo: agentRepo}
}

func (r *WorkflowRepository) Create(ctx context.Context, req models.CreateWorkflowRequest) (*models.Workflow, error) {
	workflowID := uuid.New()
	supervisorID, err := uuid.Parse(req.SupervisorAgentID)
	if err != nil {
		return nil, fmt.Errorf("invalid supervisor agent ID: %w", err)
	}
	supervisor, err := r.agentRepo.GetByID(ctx, supervisorID)
	if err != nil {
		return nil, fmt.Errorf("supervisor agent not found: %w", err)
	}

	workerAgents := make([]models.Agent, 0, len(req.Nodes))
	for _, nodeReq := range req.Nodes {
		agentID, parseErr := uuid.Parse(nodeReq.AgentID)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid worker agent ID: %w", parseErr)
		}
		agent, agentErr := r.agentRepo.GetByID(ctx, agentID)
		if agentErr != nil {
			return nil, fmt.Errorf("worker agent not found: %w", agentErr)
		}
		workerAgents = append(workerAgents, *agent)
	}

	if err := models.ValidateWorkflowRoles(supervisor, workerAgents); err != nil {
		return nil, err
	}
	now := time.Now()

	query := `
		INSERT INTO workflows (id, name, description, supervisor_agent_id, created_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, description, supervisor_agent_id, created_at
	`
	var wf models.Workflow
	err = r.pool.QueryRow(ctx, query, workflowID, req.Name, req.Description, supervisorID, now).Scan(
		&wf.ID, &wf.Name, &wf.Description, &wf.SupervisorAgentID, &wf.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create workflow: %w", err)
	}

	// Map of agentID / clientNodeID -> created DB nodeID
	nodeIDMap := make(map[string]uuid.UUID)

	// Create nodes
	for i, nodeReq := range req.Nodes {
		agentID, parseErr := uuid.Parse(nodeReq.AgentID)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid worker agent ID: %w", parseErr)
		}

		var parentNodeID *uuid.UUID
		if nodeReq.ParentNodeID != nil && *nodeReq.ParentNodeID != "" {
			if pID, pErr := uuid.Parse(*nodeReq.ParentNodeID); pErr == nil {
				parentNodeID = &pID
			}
		}

		nodeID := uuid.New()
		if nodeReq.ID != nil && *nodeReq.ID != "" {
			if parsedID, pErr := uuid.Parse(*nodeReq.ID); pErr == nil {
				nodeID = parsedID
			}
		}

		execOrder := nodeReq.ExecutionOrder
		if execOrder <= 0 {
			execOrder = i + 1
		}

		nodeQuery := `
			INSERT INTO workflow_nodes (id, workflow_id, parent_node_id, agent_id, execution_order, routing_condition)
			VALUES ($1, $2, $3, $4, $5, $6)
		`
		_, _ = r.pool.Exec(ctx, nodeQuery, nodeID, wf.ID, parentNodeID, agentID, execOrder, nodeReq.RoutingCondition)

		nodeIDMap[nodeID.String()] = nodeID
		nodeIDMap[agentID.String()] = nodeID
		if nodeReq.ID != nil {
			nodeIDMap[*nodeReq.ID] = nodeID
		}
	}

	// Create edges
	for _, edgeReq := range req.Edges {
		sourceID, srcFound := nodeIDMap[edgeReq.SourceNodeID]
		if !srcFound {
			if parsed, pErr := uuid.Parse(edgeReq.SourceNodeID); pErr == nil {
				sourceID = parsed
			} else {
				continue
			}
		}

		targetID, tgtFound := nodeIDMap[edgeReq.TargetNodeID]
		if !tgtFound {
			if parsed, pErr := uuid.Parse(edgeReq.TargetNodeID); pErr == nil {
				targetID = parsed
			} else {
				continue
			}
		}

		condType := edgeReq.ConditionType
		if condType == "" {
			condType = "always"
		}

		edgeQuery := `
			INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, condition_type, condition_expression, label, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (workflow_id, source_node_id, target_node_id) DO UPDATE
			SET condition_type = EXCLUDED.condition_type,
			    condition_expression = EXCLUDED.condition_expression,
			    label = EXCLUDED.label
		`
		if _, execErr := r.pool.Exec(ctx, edgeQuery, uuid.New(), wf.ID, sourceID, targetID, condType, edgeReq.ConditionExpression, edgeReq.Label, now); execErr != nil {
			log.Printf("Error inserting workflow edge (workflow %v, %v -> %v): %v", wf.ID, sourceID, targetID, execErr)
		}
	}

	return r.GetByID(ctx, wf.ID)
}

func (r *WorkflowRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Workflow, error) {
	query := `SELECT id, name, description, supervisor_agent_id, created_at FROM workflows WHERE id = $1`
	var wf models.Workflow
	err := r.pool.QueryRow(ctx, query, id).Scan(&wf.ID, &wf.Name, &wf.Description, &wf.SupervisorAgentID, &wf.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("workflow not found: %w", err)
	}

	if wf.SupervisorAgentID != nil {
		supervisor, _ := r.agentRepo.GetByID(ctx, *wf.SupervisorAgentID)
		wf.SupervisorAgent = supervisor
	}

	// Fetch nodes
	nodesQuery := `
		SELECT id, workflow_id, parent_node_id, agent_id, execution_order, COALESCE(routing_condition, '')
		FROM workflow_nodes WHERE workflow_id = $1 ORDER BY execution_order ASC
	`
	rows, err := r.pool.Query(ctx, nodesQuery, id)
	if err == nil {
		defer rows.Close()
		var nodes []models.WorkflowNode
		for rows.Next() {
			var n models.WorkflowNode
			if scanErr := rows.Scan(&n.ID, &n.WorkflowID, &n.ParentNodeID, &n.AgentID, &n.ExecutionOrder, &n.RoutingCondition); scanErr == nil {
				agent, _ := r.agentRepo.GetByID(ctx, n.AgentID)
				n.Agent = agent
				nodes = append(nodes, n)
			}
		}
		wf.Nodes = nodes
	}

	// Fetch edges
	edgesQuery := `
		SELECT id, workflow_id, source_node_id, target_node_id, condition_type, COALESCE(condition_expression, ''), COALESCE(label, ''), created_at
		FROM workflow_edges WHERE workflow_id = $1 ORDER BY created_at ASC
	`
	edgeRows, edgeErr := r.pool.Query(ctx, edgesQuery, id)
	if edgeErr == nil {
		defer edgeRows.Close()
		var edges []models.WorkflowEdge
		for edgeRows.Next() {
			var e models.WorkflowEdge
			if scanErr := edgeRows.Scan(&e.ID, &e.WorkflowID, &e.SourceNodeID, &e.TargetNodeID, &e.ConditionType, &e.ConditionExpression, &e.Label, &e.CreatedAt); scanErr == nil {
				edges = append(edges, e)
			}
		}
		wf.Edges = edges
	}

	return &wf, nil
}

func (r *WorkflowRepository) List(ctx context.Context) ([]models.Workflow, error) {
	query := `SELECT id, name, description, supervisor_agent_id, created_at FROM workflows ORDER BY created_at DESC`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list workflows: %w", err)
	}
	defer rows.Close()

	var workflows []models.Workflow
	for rows.Next() {
		var wf models.Workflow
		if err := rows.Scan(&wf.ID, &wf.Name, &wf.Description, &wf.SupervisorAgentID, &wf.CreatedAt); err == nil {
			full, _ := r.GetByID(ctx, wf.ID)
			if full != nil {
				wf.SupervisorAgent = full.SupervisorAgent
				wf.Nodes = full.Nodes
				wf.Edges = full.Edges
			}
			workflows = append(workflows, wf)
		}
	}
	return workflows, nil
}

func (r *WorkflowRepository) Update(ctx context.Context, id uuid.UUID, req models.CreateWorkflowRequest) (*models.Workflow, error) {
	var supervisorID *uuid.UUID
	if req.SupervisorAgentID != "" {
		parsed, err := uuid.Parse(req.SupervisorAgentID)
		if err != nil {
			return nil, fmt.Errorf("invalid supervisor agent ID: %w", err)
		}
		supervisorID = &parsed
	}

	query := `
		UPDATE workflows
		SET name = $1, description = $2, supervisor_agent_id = $3
		WHERE id = $4
	`
	_, err := r.pool.Exec(ctx, query, req.Name, req.Description, supervisorID, id)
	if err != nil {
		return nil, fmt.Errorf("failed to update workflow: %w", err)
	}

	// Remove existing edges and nodes
	_, _ = r.pool.Exec(ctx, `DELETE FROM workflow_edges WHERE workflow_id = $1`, id)
	_, _ = r.pool.Exec(ctx, `DELETE FROM workflow_nodes WHERE workflow_id = $1`, id)

	now := time.Now()
	nodeIDMap := make(map[string]uuid.UUID)

	// Create nodes
	for i, nodeReq := range req.Nodes {
		agentID, parseErr := uuid.Parse(nodeReq.AgentID)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid worker agent ID: %w", parseErr)
		}

		var parentNodeID *uuid.UUID
		if nodeReq.ParentNodeID != nil && *nodeReq.ParentNodeID != "" {
			if pID, pErr := uuid.Parse(*nodeReq.ParentNodeID); pErr == nil {
				parentNodeID = &pID
			}
		}

		nodeID := uuid.New()
		if nodeReq.ID != nil && *nodeReq.ID != "" {
			if parsedID, pErr := uuid.Parse(*nodeReq.ID); pErr == nil {
				nodeID = parsedID
			}
		}

		execOrder := nodeReq.ExecutionOrder
		if execOrder <= 0 {
			execOrder = i + 1
		}

		nodeQuery := `
			INSERT INTO workflow_nodes (id, workflow_id, parent_node_id, agent_id, execution_order, routing_condition)
			VALUES ($1, $2, $3, $4, $5, $6)
		`
		_, _ = r.pool.Exec(ctx, nodeQuery, nodeID, id, parentNodeID, agentID, execOrder, nodeReq.RoutingCondition)

		nodeIDMap[nodeID.String()] = nodeID
		nodeIDMap[agentID.String()] = nodeID
		if nodeReq.ID != nil {
			nodeIDMap[*nodeReq.ID] = nodeID
		}
	}

	// Create edges
	for _, edgeReq := range req.Edges {
		sourceID, srcFound := nodeIDMap[edgeReq.SourceNodeID]
		if !srcFound {
			if parsed, pErr := uuid.Parse(edgeReq.SourceNodeID); pErr == nil {
				sourceID = parsed
			} else {
				continue
			}
		}

		targetID, tgtFound := nodeIDMap[edgeReq.TargetNodeID]
		if !tgtFound {
			if parsed, pErr := uuid.Parse(edgeReq.TargetNodeID); pErr == nil {
				targetID = parsed
			} else {
				continue
			}
		}

		condType := edgeReq.ConditionType
		if condType == "" {
			condType = "always"
		}

		edgeQuery := `
			INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, condition_type, condition_expression, label, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (workflow_id, source_node_id, target_node_id) DO UPDATE
			SET condition_type = EXCLUDED.condition_type,
			    condition_expression = EXCLUDED.condition_expression,
			    label = EXCLUDED.label
		`
		if _, execErr := r.pool.Exec(ctx, edgeQuery, uuid.New(), id, sourceID, targetID, condType, edgeReq.ConditionExpression, edgeReq.Label, now); execErr != nil {
			log.Printf("Error inserting workflow edge in Update (workflow %v, %v -> %v): %v", id, sourceID, targetID, execErr)
		}
	}

	return r.GetByID(ctx, id)
}

func (r *WorkflowRepository) Delete(ctx context.Context, id uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Delete session logs for sessions belonging to this workflow
	_, _ = tx.Exec(ctx, `
		DELETE FROM session_logs 
		WHERE session_id IN (SELECT id FROM execution_sessions WHERE workflow_id = $1)
	`, id)

	// Delete execution sessions for this workflow
	_, _ = tx.Exec(ctx, `DELETE FROM execution_sessions WHERE workflow_id = $1`, id)

	// Delete workflow edges and nodes
	_, _ = tx.Exec(ctx, `DELETE FROM workflow_edges WHERE workflow_id = $1`, id)
	_, _ = tx.Exec(ctx, `DELETE FROM workflow_nodes WHERE workflow_id = $1`, id)

	// Delete workflow
	_, err = tx.Exec(ctx, `DELETE FROM workflows WHERE id = $1`, id)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

