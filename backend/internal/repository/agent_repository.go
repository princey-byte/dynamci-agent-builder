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

type AgentRepository struct {
	pool *pgxpool.Pool
}

func NewAgentRepository(pool *pgxpool.Pool) *AgentRepository {
	return &AgentRepository{pool: pool}
}

func (r *AgentRepository) Create(ctx context.Context, req models.CreateAgentRequest) (*models.Agent, error) {
	agentID := uuid.New()
	now := time.Now()

	query := `
		INSERT INTO agents (id, name, persona, model_provider, model_name, temperature, role_type, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, name, persona, model_provider, model_name, temperature, role_type, created_at, updated_at
	`

	var agent models.Agent
	err := r.pool.QueryRow(ctx, query, agentID, req.Name, req.Persona, req.ModelProvider, req.ModelName, req.Temperature, req.RoleType, now, now).Scan(
		&agent.ID, &agent.Name, &agent.Persona, &agent.ModelProvider, &agent.ModelName, &agent.Temperature, &agent.RoleType, &agent.CreatedAt, &agent.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create agent: %w", err)
	}

	for _, skillIDStr := range req.SkillIDs {
		if sID, parseErr := uuid.Parse(skillIDStr); parseErr == nil {
			_ = r.AttachSkill(ctx, agent.ID, sID)
		}
	}

	for _, toolIDStr := range req.MCPToolIDs {
		if tID, parseErr := uuid.Parse(toolIDStr); parseErr == nil {
			_ = r.AttachMCPTool(ctx, agent.ID, tID)
		}
	}

	return r.GetByID(ctx, agent.ID)
}

func (r *AgentRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Agent, error) {
	query := `
		SELECT id, name, persona, model_provider, model_name, temperature, role_type, created_at, updated_at
		FROM agents WHERE id = $1
	`
	var agent models.Agent
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&agent.ID, &agent.Name, &agent.Persona, &agent.ModelProvider, &agent.ModelName, &agent.Temperature, &agent.RoleType, &agent.CreatedAt, &agent.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("agent not found: %w", err)
	}

	// Fetch attached skills
	skillsQuery := `
		SELECT s.id, s.title, s.content, s.file_type, s.created_at
		FROM skills s
		JOIN agent_skills aks ON s.id = aks.skill_id
		WHERE aks.agent_id = $1
	`
	rows, err := r.pool.Query(ctx, skillsQuery, id)
	if err == nil {
		defer rows.Close()
		var skills []models.Skill
		for rows.Next() {
			var s models.Skill
			if scanErr := rows.Scan(&s.ID, &s.Title, &s.Content, &s.FileType, &s.CreatedAt); scanErr == nil {
				skills = append(skills, s)
			}
		}
		agent.Skills = skills
	}

	// Fetch attached MCP tools with parent MCP Server auth configuration
	toolsQuery := `
		SELECT 
			t.id, t.server_id, t.name, t.description, t.server_url, COALESCE(t.command, ''), COALESCE(t.args, '[]'), COALESCE(t.working_directory, ''), t.transport_type, t.input_schema, t.created_at,
			s.id, s.name, COALESCE(s.description, ''), s.server_url, COALESCE(s.command, ''), COALESCE(s.args, '[]'), COALESCE(s.working_directory, ''), s.transport_type, s.auth_type, s.auth_config, 
			COALESCE(s.oauth_client_id, ''), COALESCE(s.oauth_client_secret, ''), COALESCE(s.oauth_scopes, ''), s.oauth_tokens, s.status, s.created_at, s.updated_at
		FROM mcp_tools t
		JOIN agent_mcp_tools amt ON t.id = amt.mcp_tool_id
		LEFT JOIN mcp_servers s ON t.server_id = s.id
		WHERE amt.agent_id = $1
	`
	tRows, err := r.pool.Query(ctx, toolsQuery, id)
	if err == nil {
		defer tRows.Close()
		var tools []models.MCPTool
		for tRows.Next() {
			var t models.MCPTool
			var sID *uuid.UUID
			var sName, sDesc, sURL, sCommand, sWorkingDirectory, sStatus string
			var sTransport models.TransportType
			var sAuthType models.AuthType
			var rawToolArgs, rawServerArgs, rawAuth, rawOAuthTokens []byte
			var clientID, clientSecret, scopes string
			var sCreatedAt, sUpdatedAt time.Time

			if scanErr := tRows.Scan(
				&t.ID, &t.ServerID, &t.Name, &t.Description, &t.ServerURL, &t.Command, &rawToolArgs, &t.WorkingDirectory, &t.TransportType, &t.InputSchema, &t.CreatedAt,
				&sID, &sName, &sDesc, &sURL, &sCommand, &rawServerArgs, &sWorkingDirectory, &sTransport, &sAuthType, &rawAuth,
				&clientID, &clientSecret, &scopes, &rawOAuthTokens, &sStatus, &sCreatedAt, &sUpdatedAt,
			); scanErr == nil {
				_ = json.Unmarshal(rawToolArgs, &t.Args)
				if sID != nil {
					srv := models.MCPServer{
						ID:                *sID,
						Name:              sName,
						Description:       sDesc,
						ServerURL:         sURL,
						Command:           sCommand,
						WorkingDirectory:  sWorkingDirectory,
						TransportType:     sTransport,
						AuthType:          sAuthType,
						OAuthClientID:     clientID,
						OAuthClientSecret: clientSecret,
						OAuthScopes:       scopes,
						Status:            models.MCPConnectionStatus(sStatus),
						CreatedAt:         sCreatedAt,
						UpdatedAt:         sUpdatedAt,
					}
					_ = json.Unmarshal(rawServerArgs, &srv.Args)
					_ = json.Unmarshal(rawAuth, &srv.AuthConfig)
					if len(rawOAuthTokens) > 0 {
						var oauthTokens models.OAuthTokens
						if jsonErr := json.Unmarshal(rawOAuthTokens, &oauthTokens); jsonErr == nil && oauthTokens.AccessToken != "" {
							srv.OAuthTokens = &oauthTokens
							srv.AuthConfig.OAuth = &oauthTokens
						}
					}
					t.Server = &srv
				}
				tools = append(tools, t)
			}
		}
		agent.MCPTools = tools
	}

	return &agent, nil
}

func (r *AgentRepository) List(ctx context.Context) ([]models.Agent, error) {
	query := `
		SELECT id, name, persona, model_provider, model_name, temperature, role_type, created_at, updated_at
		FROM agents ORDER BY created_at DESC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list agents: %w", err)
	}
	defer rows.Close()

	var agents []models.Agent
	for rows.Next() {
		var a models.Agent
		if err := rows.Scan(&a.ID, &a.Name, &a.Persona, &a.ModelProvider, &a.ModelName, &a.Temperature, &a.RoleType, &a.CreatedAt, &a.UpdatedAt); err == nil {
			// Get skills and tools summary count
			full, _ := r.GetByID(ctx, a.ID)
			if full != nil {
				a.Skills = full.Skills
				a.MCPTools = full.MCPTools
			}
			agents = append(agents, a)
		}
	}
	return agents, nil
}

func (r *AgentRepository) Update(ctx context.Context, id uuid.UUID, req models.UpdateAgentRequest) (*models.Agent, error) {
	query := `
		UPDATE agents
		SET name = COALESCE(NULLIF($1, ''), name),
		    persona = COALESCE(NULLIF($2, ''), persona),
		    model_provider = COALESCE(NULLIF($3, ''), model_provider),
		    model_name = COALESCE(NULLIF($4, ''), model_name),
		    temperature = CASE WHEN $5 > 0 THEN $5 ELSE temperature END,
		    role_type = COALESCE(NULLIF($6, ''), role_type),
		    updated_at = NOW()
		WHERE id = $7
	`
	_, err := r.pool.Exec(ctx, query, req.Name, req.Persona, req.ModelProvider, req.ModelName, req.Temperature, req.RoleType, id)
	if err != nil {
		return nil, fmt.Errorf("failed to update agent: %w", err)
	}
	return r.GetByID(ctx, id)
}

func (r *AgentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM agents WHERE id = $1", id)
	return err
}

func (r *AgentRepository) AttachSkill(ctx context.Context, agentID, skillID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "INSERT INTO agent_skills (agent_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", agentID, skillID)
	return err
}

func (r *AgentRepository) DetachSkill(ctx context.Context, agentID, skillID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM agent_skills WHERE agent_id = $1 AND skill_id = $2", agentID, skillID)
	return err
}

func (r *AgentRepository) AttachMCPTool(ctx context.Context, agentID, toolID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "INSERT INTO agent_mcp_tools (agent_id, mcp_tool_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", agentID, toolID)
	return err
}

func (r *AgentRepository) DetachMCPTool(ctx context.Context, agentID, toolID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM agent_mcp_tools WHERE agent_id = $1 AND mcp_tool_id = $2", agentID, toolID)
	return err
}
