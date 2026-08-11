package sse

import (
	"encoding/json"
	"fmt"
	"net/http"

	"agentic-platform/backend/internal/models"
)

func HandleSSEStream(w http.ResponseWriter, r *http.Request, eventChan <-chan models.StreamMessage) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	for {
		select {
		case <-r.Context().Done():
			return
		case msg, open := <-eventChan:
			if !open {
				fmt.Fprintf(w, "event: close\ndata: {}\n\n")
				flusher.Flush()
				return
			}
			data, err := json.Marshal(msg)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", msg.Event, data)
			flusher.Flush()

			if msg.Event == models.EventWorkflowComplete || msg.Event == models.EventError {
				return
			}
		}
	}
}
