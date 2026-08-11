package api

import (
	"net/http"

	"agentic-platform/backend/internal/mcp"
	"agentic-platform/backend/internal/models"
	"agentic-platform/backend/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type MCPServerHandler struct {
	repo *repository.MCPServerRepository
}

func NewMCPServerHandler(repo *repository.MCPServerRepository) *MCPServerHandler {
	return &MCPServerHandler{repo: repo}
}

func (h *MCPServerHandler) CreateServer(c *gin.Context) {
	var req models.CreateMCPServerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	server, err := h.repo.Create(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, server)
}

func (h *MCPServerHandler) GetServer(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server ID"})
		return
	}
	server, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, server)
}

func (h *MCPServerHandler) ListServers(c *gin.Context) {
	servers, err := h.repo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, servers)
}

func (h *MCPServerHandler) DeleteServer(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid server ID"})
		return
	}
	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "MCP server deleted successfully"})
}

func (h *MCPServerHandler) DiscoverTools(c *gin.Context) {
	var req models.DiscoverToolsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tools, err := mcp.DiscoverServerTools(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status": "connected",
		"tools":  tools,
	})
}
