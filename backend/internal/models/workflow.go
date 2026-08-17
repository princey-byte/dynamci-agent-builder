package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Workflow struct {
	ID                uuid.UUID       `json:"id"`
	Name              string          `json:"name"`
	Description       string          `json:"description"`
	SupervisorAgentID *uuid.UUID      `json:"supervisor_agent_id,omitempty"`
	SupervisorAgent   *Agent          `json:"supervisor_agent,omitempty"`
	UISchema          json.RawMessage `json:"ui_schema,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	Nodes             []WorkflowNode  `json:"nodes,omitempty"`
	Edges             []WorkflowEdge  `json:"edges,omitempty"`
}

type WorkflowNode struct {
	ID               uuid.UUID  `json:"id"`
	WorkflowID       uuid.UUID  `json:"workflow_id"`
	ParentNodeID     *uuid.UUID `json:"parent_node_id,omitempty"`
	AgentID          uuid.UUID  `json:"agent_id"`
	Agent            *Agent     `json:"agent,omitempty"`
	ExecutionOrder   int        `json:"execution_order"`
	RoutingCondition string     `json:"routing_condition,omitempty"`
	NodeType         string     `json:"node_type,omitempty"` // supervisor | worker | team_lead
	PositionX        float64    `json:"position_x"`
	PositionY        float64    `json:"position_y"`
}

type WorkflowEdge struct {
	ID                  uuid.UUID `json:"id"`
	WorkflowID          uuid.UUID `json:"workflow_id"`
	SourceNodeID        uuid.UUID `json:"source_node_id"`
	TargetNodeID        uuid.UUID `json:"target_node_id"`
	ConditionType       string    `json:"condition_type"` // always | llm_decision | rule_match | fallback
	ConditionExpression string    `json:"condition_expression,omitempty"`
	Label               string    `json:"label,omitempty"`
	CreatedAt           time.Time `json:"created_at"`
}

type CreateWorkflowEdgeRequest struct {
	SourceNodeID        string `json:"source_node_id" binding:"required"`
	TargetNodeID        string `json:"target_node_id" binding:"required"`
	ConditionType       string `json:"condition_type"`
	ConditionExpression string `json:"condition_expression,omitempty"`
	Label               string `json:"label,omitempty"`
}

type CreateWorkflowNodeRequest struct {
	ID               *string  `json:"id,omitempty"`
	ParentNodeID     *string  `json:"parent_node_id,omitempty"`
	AgentID          string   `json:"agent_id" binding:"required"`
	ExecutionOrder   int      `json:"execution_order"`
	RoutingCondition string   `json:"routing_condition,omitempty"`
	NodeType         string   `json:"node_type,omitempty"`
	PositionX        *float64 `json:"position_x,omitempty"`
	PositionY        *float64 `json:"position_y,omitempty"`
}

type CreateWorkflowRequest struct {
	Name              string                      `json:"name" binding:"required"`
	Description       string                      `json:"description"`
	SupervisorAgentID string                      `json:"supervisor_agent_id" binding:"required"`
	UISchema          json.RawMessage             `json:"ui_schema,omitempty"`
	Nodes             []CreateWorkflowNodeRequest `json:"nodes,omitempty"`
	Edges             []CreateWorkflowEdgeRequest `json:"edges,omitempty"`
}
