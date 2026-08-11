package api

import (
	"net/http"

	"agentic-platform/backend/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SessionHandler struct {
	repo *repository.SessionRepository
}

func NewSessionHandler(repo *repository.SessionRepository) *SessionHandler {
	return &SessionHandler{repo: repo}
}

func (h *SessionHandler) ListSessions(c *gin.Context) {
	sessions, err := h.repo.ListSessions(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sessions)
}

func (h *SessionHandler) GetSession(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session ID"})
		return
	}
	session, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, session)
}

func (h *SessionHandler) GetSessionLogs(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session ID"})
		return
	}
	logs, err := h.repo.GetSessionLogs(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, logs)
}
