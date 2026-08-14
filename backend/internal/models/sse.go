package models

type EventType string

const (
	EventAgentThought       EventType = "AGENT_THOUGHT"
	EventDelegation         EventType = "AGENT_DELEGATION"
	EventToolCall           EventType = "TOOL_CALL"
	EventToolResult         EventType = "TOOL_RESULT"
	EventTokenStream        EventType = "TOKEN_STREAM"
	EventConditionEvaluated EventType = "CONDITION_EVALUATED"
	EventBranchSkipped      EventType = "BRANCH_SKIPPED"
	EventWorkflowComplete   EventType = "WORKFLOW_COMPLETE"
	EventError              EventType = "ERROR"
)

type StreamMessage struct {
	Event     EventType   `json:"event"`
	SessionID string      `json:"session_id"`
	AgentName string      `json:"agent_name,omitempty"`
	Step      int         `json:"step"`
	Payload   interface{} `json:"payload"`
}
