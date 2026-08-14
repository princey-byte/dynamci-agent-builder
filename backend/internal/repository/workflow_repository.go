package repository

import (
	"context"
	"fmt"
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
		execOrder := nodeReq.ExecutionOrder
		if execOrder <= 0 {
			execOrder = i + 1
		}

		nodeQuery := `
			INSERT INTO workflow_nodes (id, workflow_id, parent_node_id, agent_id, execution_order, routing_condition)
			VALUES ($1, $2, $3, $4, $5, $6)
		`
		_, _ = r.pool.Exec(ctx, nodeQuery, nodeID, wf.ID, parentNodeID, agentID, execOrder, nodeReq.RoutingCondition)
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
			}
			workflows = append(workflows, wf)
		}
	}
	return workflows, nil
}

func (r *WorkflowRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM workflows WHERE id = $1", id)
	return err
}
