package api

import (
	"net/http"

	"agentic-platform/backend/internal/models"
	"agentic-platform/backend/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AgentHandler struct {
	repo *repository.AgentRepository
}

func NewAgentHandler(repo *repository.AgentRepository) *AgentHandler {
	return &AgentHandler{repo: repo}
}

func (h *AgentHandler) CreateAgent(c *gin.Context) {
	var req models.CreateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	agent, err := h.repo.Create(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, agent)
}

func (h *AgentHandler) GetAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent ID"})
		return
	}
	agent, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, agent)
}

func (h *AgentHandler) ListAgents(c *gin.Context) {
	agents, err := h.repo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, agents)
}

func (h *AgentHandler) UpdateAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent ID"})
		return
	}
	var req models.UpdateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	agent, err := h.repo.Update(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, agent)
}

func (h *AgentHandler) DeleteAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent ID"})
		return
	}
	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "agent deleted successfully"})
}

func (h *AgentHandler) AttachSkill(c *gin.Context) {
	agentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent ID"})
		return
	}
	var payload struct {
		SkillID string `json:"skill_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	skillID, err := uuid.Parse(payload.SkillID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid skill ID"})
		return
	}
	if err := h.repo.AttachSkill(c.Request.Context(), agentID, skillID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "skill attached successfully"})
}

func (h *AgentHandler) DetachSkill(c *gin.Context) {
	agentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent ID"})
		return
	}
	skillID, err := uuid.Parse(c.Param("skillId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid skill ID"})
		return
	}
	if err := h.repo.DetachSkill(c.Request.Context(), agentID, skillID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "skill detached successfully"})
}

func (h *AgentHandler) AttachMCPTool(c *gin.Context) {
	agentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent ID"})
		return
	}
	var payload struct {
		MCPToolID string `json:"mcp_tool_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	toolID, err := uuid.Parse(payload.MCPToolID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tool ID"})
		return
	}
	if err := h.repo.AttachMCPTool(c.Request.Context(), agentID, toolID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "MCP tool attached successfully"})
}
