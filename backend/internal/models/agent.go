package models

import (
	"time"

	"github.com/google/uuid"
)

type RoleType string

const (
	RoleSupervisor RoleType = "supervisor"
	RoleWorker     RoleType = "worker"
	RoleEvaluator  RoleType = "evaluator"
)

type Agent struct {
	ID            uuid.UUID  `json:"id"`
	Name          string     `json:"name"`
	Persona       string     `json:"persona"`
	ModelProvider string     `json:"model_provider"` // "openai", "azure_openai", "anthropic", "gemini"
	ModelName     string     `json:"model_name"`
	Temperature   float64    `json:"temperature"`
	RoleType      RoleType   `json:"role_type"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	Skills        []Skill    `json:"skills,omitempty"`
	MCPTools      []MCPTool  `json:"mcp_tools,omitempty"`
}

type CreateAgentRequest struct {
	Name          string   `json:"name" binding:"required"`
	Persona       string   `json:"persona" binding:"required"`
	ModelProvider string   `json:"model_provider" binding:"required"`
	ModelName     string   `json:"model_name" binding:"required"`
	Temperature   float64  `json:"temperature"`
	RoleType      RoleType `json:"role_type" binding:"required"`
	SkillIDs      []string `json:"skill_ids,omitempty"`
	MCPToolIDs    []string `json:"mcp_tool_ids,omitempty"`
}

type UpdateAgentRequest struct {
	Name          string   `json:"name"`
	Persona       string   `json:"persona"`
	ModelProvider string   `json:"model_provider"`
	ModelName     string   `json:"model_name"`
	Temperature   float64  `json:"temperature"`
	RoleType      RoleType `json:"role_type"`
}
