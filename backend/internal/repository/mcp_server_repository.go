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

type MCPServerRepository struct {
	pool     *pgxpool.Pool
	toolRepo *MCPToolRepository
}

func NewMCPServerRepository(pool *pgxpool.Pool, toolRepo *MCPToolRepository) *MCPServerRepository {
	return &MCPServerRepository{pool: pool, toolRepo: toolRepo}
}

func (r *MCPServerRepository) Create(ctx context.Context, req models.CreateMCPServerRequest) (*models.MCPServer, error) {
	serverID := uuid.New()
	now := time.Now()

	transport := req.TransportType
	if transport == "" {
		transport = models.TransportSSE
	}
	authType := req.AuthType
	if authType == "" {
		authType = models.AuthTypeNone
	}

	authBytes, err := json.Marshal(req.AuthConfig)
	if err != nil {
		authBytes = []byte("{}")
	}

	query := `
		INSERT INTO mcp_servers (id, name, description, server_url, transport_type, auth_type, auth_config, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $9)
		RETURNING id, name, description, server_url, transport_type, auth_type, auth_config, status, created_at, updated_at
	`
	var s models.MCPServer
	var rawAuth []byte
	err = r.pool.QueryRow(ctx, query, serverID, req.Name, req.Description, req.ServerURL, transport, authType, authBytes, now, now).Scan(
		&s.ID, &s.Name, &s.Description, &s.ServerURL, &s.TransportType, &s.AuthType, &rawAuth, &s.Status, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create MCP server: %w", err)
	}

	_ = json.Unmarshal(rawAuth, &s.AuthConfig)

	// Import and link discovered tools
	for _, tool := range req.ImportTools {
		tID := uuid.New()
		tQuery := `
			INSERT INTO mcp_tools (id, server_id, name, description, server_url, transport_type, input_schema, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`
		desc := tool.Description
		if desc == "" {
			desc = fmt.Sprintf("Tool %s from server %s", tool.Name, s.Name)
		}
		_, _ = r.pool.Exec(ctx, tQuery, tID, s.ID, tool.Name, desc, s.ServerURL, s.TransportType, tool.InputSchema, now)
	}

	return r.GetByID(ctx, s.ID)
}

func (r *MCPServerRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.MCPServer, error) {
	query := `SELECT id, name, COALESCE(description, ''), server_url, transport_type, auth_type, auth_config, status, created_at, updated_at FROM mcp_servers WHERE id = $1`
	var s models.MCPServer
	var rawAuth []byte
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&s.ID, &s.Name, &s.Description, &s.ServerURL, &s.TransportType, &s.AuthType, &rawAuth, &s.Status, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("MCP server not found: %w", err)
	}

	_ = json.Unmarshal(rawAuth, &s.AuthConfig)

	// Load tools linked to server
	toolsQuery := `SELECT id, server_id, name, description, server_url, transport_type, input_schema, created_at FROM mcp_tools WHERE server_id = $1 ORDER BY name ASC`
	rows, err := r.pool.Query(ctx, toolsQuery, s.ID)
	if err == nil {
		defer rows.Close()
		var tools []models.MCPTool
		for rows.Next() {
			var t models.MCPTool
			if scanErr := rows.Scan(&t.ID, &t.ServerID, &t.Name, &t.Description, &t.ServerURL, &t.TransportType, &t.InputSchema, &t.CreatedAt); scanErr == nil {
				t.Server = &s
				tools = append(tools, t)
			}
		}
		s.Tools = tools
	}

	return &s, nil
}

func (r *MCPServerRepository) List(ctx context.Context) ([]models.MCPServer, error) {
	query := `SELECT id, name, COALESCE(description, ''), server_url, transport_type, auth_type, auth_config, status, created_at, updated_at FROM mcp_servers ORDER BY created_at DESC`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list MCP servers: %w", err)
	}
	defer rows.Close()

	var servers []models.MCPServer
	for rows.Next() {
		var s models.MCPServer
		var rawAuth []byte
		if err := rows.Scan(&s.ID, &s.Name, &s.Description, &s.ServerURL, &s.TransportType, &s.AuthType, &rawAuth, &s.Status, &s.CreatedAt, &s.UpdatedAt); err == nil {
			_ = json.Unmarshal(rawAuth, &s.AuthConfig)
			full, _ := r.GetByID(ctx, s.ID)
			if full != nil {
				s.Tools = full.Tools
			}
			servers = append(servers, s)
		}
	}
	return servers, nil
}

func (r *MCPServerRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM mcp_servers WHERE id = $1", id)
	return err
}
