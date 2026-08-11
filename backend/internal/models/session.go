package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type ExecutionSession struct {
	ID          uuid.UUID   `json:"id"`
	WorkflowID  uuid.UUID   `json:"workflow_id"`
	Workflow    *Workflow   `json:"workflow,omitempty"`
	Status      string      `json:"status"` // "RUNNING", "COMPLETED", "ERROR"
	InputQuery  string      `json:"input_query"`
	FinalOutput string      `json:"final_output,omitempty"`
	StartedAt   time.Time   `json:"started_at"`
	CompletedAt *time.Time  `json:"completed_at,omitempty"`
	Logs        []SessionLog`json:"logs,omitempty"`
}

type SessionLog struct {
	ID         uuid.UUID       `json:"id"`
	SessionID  uuid.UUID       `json:"session_id"`
	AgentID    *uuid.UUID      `json:"agent_id,omitempty"`
	AgentName  string          `json:"agent_name,omitempty"`
	StepNumber int             `json:"step_number"`
	LogType    string          `json:"log_type"` // THOUGHT, TOOL_CALL, TOOL_RESULT, DELEGATION, FINAL_RESPONSE, ERROR
	Content    json.RawMessage `json:"content"`
	CreatedAt  time.Time       `json:"created_at"`
}
