package api

import (
	"net/http"

	"agentic-platform/backend/internal/models"
	"agentic-platform/backend/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type MCPToolHandler struct {
	repo *repository.MCPToolRepository
}

func NewMCPToolHandler(repo *repository.MCPToolRepository) *MCPToolHandler {
	return &MCPToolHandler{repo: repo}
}

func (h *MCPToolHandler) RegisterTool(c *gin.Context) {
	var req models.CreateMCPToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tool, err := h.repo.Create(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, tool)
}

func (h *MCPToolHandler) GetTool(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tool ID"})
		return
	}
	tool, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tool)
}

func (h *MCPToolHandler) ListTools(c *gin.Context) {
	tools, err := h.repo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tools)
}

func (h *MCPToolHandler) DeleteTool(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tool ID"})
		return
	}
	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "MCP tool deleted successfully"})
}
