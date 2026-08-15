package api

import (
	"net/http"

	"agentic-platform/backend/internal/engine"
	"agentic-platform/backend/internal/models"
	"agentic-platform/backend/internal/sse"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type StreamHandler struct {
	orchestrator *engine.Orchestrator
}

func NewStreamHandler(orchestrator *engine.Orchestrator) *StreamHandler {
	return &StreamHandler{orchestrator: orchestrator}
}

func (h *StreamHandler) ExecuteStream(c *gin.Context) {
	workflowID := c.Param("id")
	query := c.Query("query")
	sessionIDStr := c.Query("session_id")

	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter is required"})
		return
	}

	var existingSessionID *uuid.UUID
	if sessionIDStr != "" {
		if parsed, err := uuid.Parse(sessionIDStr); err == nil {
			existingSessionID = &parsed
		}
	}

	eventChan := make(chan models.StreamMessage, 100)

	// Launch async execution engine
	go func() {
		defer close(eventChan)
		_ = h.orchestrator.ExecuteWorkflow(c.Request.Context(), workflowID, query, existingSessionID, eventChan)
	}()

	// Handle HTTP SSE response output stream
	sse.HandleSSEStream(c.Writer, c.Request, eventChan)
}
