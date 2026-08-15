package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"agentic-platform/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SessionRepository struct {
	pool         *pgxpool.Pool
	workflowRepo *WorkflowRepository
}

func NewSessionRepository(pool *pgxpool.Pool, workflowRepo *WorkflowRepository) *SessionRepository {
	return &SessionRepository{pool: pool, workflowRepo: workflowRepo}
}

func (r *SessionRepository) CreateSession(ctx context.Context, workflowID uuid.UUID, inputQuery string) (*models.ExecutionSession, error) {
	sessionID := uuid.New()
	now := time.Now()

	query := `
		INSERT INTO execution_sessions (id, workflow_id, status, input_query, started_at)
		VALUES ($1, $2, 'RUNNING', $3, $4)
		RETURNING id, workflow_id, status, input_query, started_at
	`
	var s models.ExecutionSession
	err := r.pool.QueryRow(ctx, query, sessionID, workflowID, inputQuery, now).Scan(
		&s.ID, &s.WorkflowID, &s.Status, &s.InputQuery, &s.StartedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}
	return &s, nil
}

func (r *SessionRepository) UpdateSessionStatus(ctx context.Context, sessionID uuid.UUID, status string, finalOutput string) error {
	now := time.Now()
	query := `
		UPDATE execution_sessions
		SET status = $1, final_output = $2, completed_at = $3
		WHERE id = $4
	`
	_, err := r.pool.Exec(ctx, query, status, finalOutput, now, sessionID)
	return err
}

func (r *SessionRepository) AppendLog(ctx context.Context, sessionID uuid.UUID, agentID *uuid.UUID, stepNumber int, logType string, content interface{}) error {
	logID := uuid.New()
	now := time.Now()

	contentBytes, err := json.Marshal(content)
	if err != nil {
		contentBytes = []byte("{}")
	}

	query := `
		INSERT INTO session_logs (id, session_id, agent_id, step_number, log_type, content, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err = r.pool.Exec(ctx, query, logID, sessionID, agentID, stepNumber, logType, contentBytes, now)
	return err
}

func (r *SessionRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.ExecutionSession, error) {
	query := `SELECT id, workflow_id, status, input_query, COALESCE(final_output, ''), started_at, completed_at FROM execution_sessions WHERE id = $1`
	var s models.ExecutionSession
	err := r.pool.QueryRow(ctx, query, id).Scan(&s.ID, &s.WorkflowID, &s.Status, &s.InputQuery, &s.FinalOutput, &s.StartedAt, &s.CompletedAt)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}

	if wf, _ := r.workflowRepo.GetByID(ctx, s.WorkflowID); wf != nil {
		s.Workflow = wf
	}

	s.Logs, _ = r.GetSessionLogs(ctx, id)
	return &s, nil
}

func (r *SessionRepository) GetSessionLogs(ctx context.Context, sessionID uuid.UUID) ([]models.SessionLog, error) {
	query := `
		SELECT l.id, l.session_id, l.agent_id, COALESCE(a.name, ''), l.step_number, l.log_type, l.content, l.created_at
		FROM session_logs l
		LEFT JOIN agents a ON l.agent_id = a.id
		WHERE l.session_id = $1
		ORDER BY l.step_number ASC, l.created_at ASC
	`
	rows, err := r.pool.Query(ctx, query, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.SessionLog
	for rows.Next() {
		var l models.SessionLog
		if err := rows.Scan(&l.ID, &l.SessionID, &l.AgentID, &l.AgentName, &l.StepNumber, &l.LogType, &l.Content, &l.CreatedAt); err == nil {
			logs = append(logs, l)
		}
	}
	return logs, nil
}

func (r *SessionRepository) ListSessions(ctx context.Context) ([]models.ExecutionSession, error) {
	query := `SELECT id, workflow_id, status, input_query, COALESCE(final_output, ''), started_at, completed_at FROM execution_sessions ORDER BY started_at DESC`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []models.ExecutionSession
	for rows.Next() {
		var s models.ExecutionSession
		if err := rows.Scan(&s.ID, &s.WorkflowID, &s.Status, &s.InputQuery, &s.FinalOutput, &s.StartedAt, &s.CompletedAt); err == nil {
			if wf, _ := r.workflowRepo.GetByID(ctx, s.WorkflowID); wf != nil {
				s.Workflow = wf
			}
			sessions = append(sessions, s)
		}
	}
	return sessions, nil
}

func (r *SessionRepository) ListWorkflowSessions(ctx context.Context, workflowID uuid.UUID) ([]models.ExecutionSession, error) {
	query := `
		SELECT id, workflow_id, status, input_query, COALESCE(final_output, ''), started_at, completed_at 
		FROM execution_sessions 
		WHERE workflow_id = $1 
		ORDER BY started_at DESC
	`
	rows, err := r.pool.Query(ctx, query, workflowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []models.ExecutionSession
	for rows.Next() {
		var s models.ExecutionSession
		if err := rows.Scan(&s.ID, &s.WorkflowID, &s.Status, &s.InputQuery, &s.FinalOutput, &s.StartedAt, &s.CompletedAt); err == nil {
			sessions = append(sessions, s)
		}
	}
	return sessions, nil
}
