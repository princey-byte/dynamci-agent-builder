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

type MCPToolRepository struct {
	pool *pgxpool.Pool
}

func NewMCPToolRepository(pool *pgxpool.Pool) *MCPToolRepository {
	return &MCPToolRepository{pool: pool}
}

func (r *MCPToolRepository) Create(ctx context.Context, req models.CreateMCPToolRequest) (*models.MCPTool, error) {
	toolID := uuid.New()
	now := time.Now()

	transport := req.TransportType
	if transport == "" {
		transport = models.TransportSSE
	}
	argsBytes, err := json.Marshal(req.Args)
	if err != nil {
		argsBytes = []byte("[]")
	}
	serverURL := req.ServerURL
	if transport == models.TransportStdio && serverURL == "" {
		serverURL = req.Command
	}

	var serverID *uuid.UUID
	if req.ServerID != nil && *req.ServerID != "" {
		if sID, pErr := uuid.Parse(*req.ServerID); pErr == nil {
			serverID = &sID
		}
	}

	query := `
		INSERT INTO mcp_tools (id, server_id, name, description, server_url, command, args, working_directory, transport_type, input_schema, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, server_id, name, description, server_url, command, args, working_directory, transport_type, input_schema, created_at
	`
	var t models.MCPTool
	var rawArgs []byte
	err = r.pool.QueryRow(ctx, query, toolID, serverID, req.Name, req.Description, serverURL, req.Command, argsBytes, req.WorkingDirectory, transport, req.InputSchema, now).Scan(
		&t.ID, &t.ServerID, &t.Name, &t.Description, &t.ServerURL, &t.Command, &rawArgs, &t.WorkingDirectory, &t.TransportType, &t.InputSchema, &t.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create MCP tool: %w", err)
	}
	_ = json.Unmarshal(rawArgs, &t.Args)
	return &t, nil
}

func (r *MCPToolRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.MCPTool, error) {
	query := `SELECT id, server_id, name, description, server_url, COALESCE(command, ''), COALESCE(args, '[]'), COALESCE(working_directory, ''), transport_type, input_schema, created_at FROM mcp_tools WHERE id = $1`
	var t models.MCPTool
	var rawArgs []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(&t.ID, &t.ServerID, &t.Name, &t.Description, &t.ServerURL, &t.Command, &rawArgs, &t.WorkingDirectory, &t.TransportType, &t.InputSchema, &t.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("MCP tool not found: %w", err)
	}
	_ = json.Unmarshal(rawArgs, &t.Args)
	return &t, nil
}

func (r *MCPToolRepository) List(ctx context.Context) ([]models.MCPTool, error) {
	query := `SELECT id, server_id, name, description, server_url, COALESCE(command, ''), COALESCE(args, '[]'), COALESCE(working_directory, ''), transport_type, input_schema, created_at FROM mcp_tools ORDER BY created_at DESC`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list MCP tools: %w", err)
	}
	defer rows.Close()

	var tools []models.MCPTool
	for rows.Next() {
		var t models.MCPTool
		var rawArgs []byte
		if err := rows.Scan(&t.ID, &t.ServerID, &t.Name, &t.Description, &t.ServerURL, &t.Command, &rawArgs, &t.WorkingDirectory, &t.TransportType, &t.InputSchema, &t.CreatedAt); err == nil {
			_ = json.Unmarshal(rawArgs, &t.Args)
			tools = append(tools, t)
		}
	}
	return tools, nil
}

func (r *MCPToolRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM mcp_tools WHERE id = $1", id)
	return err
}
