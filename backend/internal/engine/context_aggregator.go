package engine

import (
	"fmt"
	"strings"

	"agentic-platform/backend/internal/models"
)

type ContextAggregator struct{}

func NewContextAggregator() *ContextAggregator {
	return &ContextAggregator{}
}

func (ca *ContextAggregator) BuildSystemPrompt(agent *models.Agent) string {
	var builder strings.Builder

	// 1. Agent Persona
	builder.WriteString(fmt.Sprintf("# Role Persona: %s\n\n", agent.Name))
	builder.WriteString(agent.Persona)
	builder.WriteString("\n\n")

	// 2. Attached Skill Documentation (from Postgres raw skill storage)
	if len(agent.Skills) > 0 {
		builder.WriteString("# Attached Domain Knowledge & Skills (SOPs):\n\n")
		for i, skill := range agent.Skills {
			builder.WriteString(fmt.Sprintf("--- Skill %d: %s (%s) ---\n", i+1, skill.Title, skill.FileType))
			builder.WriteString(skill.Content)
			builder.WriteString("\n\n")
		}
	}

	// 3. MCP Tool Instructions
	if len(agent.MCPTools) > 0 {
		builder.WriteString("# Available Model Context Protocol (MCP) Tools:\n")
		for _, tool := range agent.MCPTools {
			builder.WriteString(fmt.Sprintf("- Tool: %s (Transport: %s)\n  Description: %s\n", tool.Name, tool.TransportType, tool.Description))
		}
		builder.WriteString("\nIf a tool call is needed to fulfill the request, invoke it using structured tool execution format.\n\n")
	}

	return builder.String()
}
