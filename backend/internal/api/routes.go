package api

import (
	"net/http"

	"agentic-platform/backend/internal/engine"
	"agentic-platform/backend/internal/mcp"
	"agentic-platform/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

func SetupRouter(
	agentRepo *repository.AgentRepository,
	skillRepo *repository.SkillRepository,
	mcpToolRepo *repository.MCPToolRepository,
	mcpServerRepo *repository.MCPServerRepository,
	workflowRepo *repository.WorkflowRepository,
	sessionRepo *repository.SessionRepository,
	toolRegistry *mcp.ToolRegistry,
) *gin.Engine {
	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	orchestrator := engine.NewOrchestrator(workflowRepo, sessionRepo, toolRegistry)

	agentHandler := NewAgentHandler(agentRepo)
	skillHandler := NewSkillHandler(skillRepo)
	mcpToolHandler := NewMCPToolHandler(mcpToolRepo)
	mcpServerHandler := NewMCPServerHandler(mcpServerRepo)
	workflowHandler := NewWorkflowHandler(workflowRepo)
	sessionHandler := NewSessionHandler(sessionRepo)
	streamHandler := NewStreamHandler(orchestrator)

	v1 := r.Group("/api/v1")
	{
		// Agents
		v1.POST("/agents", agentHandler.CreateAgent)
		v1.GET("/agents", agentHandler.ListAgents)
		v1.GET("/agents/:id", agentHandler.GetAgent)
		v1.PUT("/agents/:id", agentHandler.UpdateAgent)
		v1.DELETE("/agents/:id", agentHandler.DeleteAgent)
		v1.POST("/agents/:id/skills", agentHandler.AttachSkill)
		v1.DELETE("/agents/:id/skills/:skillId", agentHandler.DetachSkill)
		v1.POST("/agents/:id/tools", agentHandler.AttachMCPTool)

		// Skills
		v1.POST("/skills", skillHandler.CreateSkill)
		v1.GET("/skills", skillHandler.ListSkills)
		v1.GET("/skills/:id", skillHandler.GetSkill)
		v1.DELETE("/skills/:id", skillHandler.DeleteSkill)

		// MCP Servers & Discovery
		v1.POST("/mcp/servers", mcpServerHandler.CreateServer)
		v1.GET("/mcp/servers", mcpServerHandler.ListServers)
		v1.GET("/mcp/servers/:id", mcpServerHandler.GetServer)
		v1.DELETE("/mcp/servers/:id", mcpServerHandler.DeleteServer)
		v1.POST("/mcp/servers/discover", mcpServerHandler.DiscoverTools)
		v1.POST("/mcp/oauth/init", mcpServerHandler.InitOAuth)
		v1.POST("/mcp/oauth/callback", mcpServerHandler.CallbackOAuth)

		// Legacy MCP Tools
		v1.POST("/mcp/tools", mcpToolHandler.RegisterTool)
		v1.GET("/mcp/tools", mcpToolHandler.ListTools)
		v1.GET("/mcp/tools/:id", mcpToolHandler.GetTool)
		v1.DELETE("/mcp/tools/:id", mcpToolHandler.DeleteTool)

		// Workflows
		v1.POST("/workflows", workflowHandler.CreateWorkflow)
		v1.GET("/workflows", workflowHandler.ListWorkflows)
		v1.GET("/workflows/:id", workflowHandler.GetWorkflow)
		v1.PUT("/workflows/:id", workflowHandler.UpdateWorkflow)
		v1.DELETE("/workflows/:id", workflowHandler.DeleteWorkflow)
		v1.GET("/workflows/:id/execute/stream", streamHandler.ExecuteStream)

		// Sessions
		v1.GET("/sessions", sessionHandler.ListSessions)
		v1.GET("/sessions/:id", sessionHandler.GetSession)
		v1.GET("/sessions/:id/logs", sessionHandler.GetSessionLogs)
	}

	return r
}
