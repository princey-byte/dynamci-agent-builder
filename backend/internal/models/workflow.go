package models

import (
	"time"

	"github.com/google/uuid"
)

type Workflow struct {
	ID                uuid.UUID      `json:"id"`
	Name              string         `json:"name"`
	Description       string         `json:"description"`
	SupervisorAgentID *uuid.UUID     `json:"supervisor_agent_id,omitempty"`
	SupervisorAgent   *Agent         `json:"supervisor_agent,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	Nodes             []WorkflowNode `json:"nodes,omitempty"`
}

type WorkflowNode struct {
	ID               uuid.UUID  `json:"id"`
	WorkflowID       uuid.UUID  `json:"workflow_id"`
	ParentNodeID     *uuid.UUID `json:"parent_node_id,omitempty"`
	AgentID          uuid.UUID  `json:"agent_id"`
	Agent            *Agent     `json:"agent,omitempty"`
	ExecutionOrder   int        `json:"execution_order"`
	RoutingCondition string     `json:"routing_condition,omitempty"`
}

type CreateWorkflowNodeRequest struct {
	ParentNodeID     *string `json:"parent_node_id,omitempty"`
	AgentID          string  `json:"agent_id" binding:"required"`
	ExecutionOrder   int     `json:"execution_order"`
	RoutingCondition string  `json:"routing_condition,omitempty"`
}

type CreateWorkflowRequest struct {
	Name              string                      `json:"name" binding:"required"`
	Description       string                      `json:"description"`
	SupervisorAgentID string                      `json:"supervisor_agent_id" binding:"required"`
	Nodes             []CreateWorkflowNodeRequest `json:"nodes,omitempty"`
}
