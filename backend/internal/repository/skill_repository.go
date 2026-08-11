package repository

import (
	"context"
	"fmt"
	"time"

	"agentic-platform/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SkillRepository struct {
	pool *pgxpool.Pool
}

func NewSkillRepository(pool *pgxpool.Pool) *SkillRepository {
	return &SkillRepository{pool: pool}
}

func (r *SkillRepository) Create(ctx context.Context, req models.CreateSkillRequest) (*models.Skill, error) {
	skillID := uuid.New()
	now := time.Now()

	query := `
		INSERT INTO skills (id, title, content, file_type, created_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, title, content, file_type, created_at
	`
	var skill models.Skill
	err := r.pool.QueryRow(ctx, query, skillID, req.Title, req.Content, req.FileType, now).Scan(
		&skill.ID, &skill.Title, &skill.Content, &skill.FileType, &skill.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create skill: %w", err)
	}
	return &skill, nil
}

func (r *SkillRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Skill, error) {
	query := `SELECT id, title, content, file_type, created_at FROM skills WHERE id = $1`
	var s models.Skill
	err := r.pool.QueryRow(ctx, query, id).Scan(&s.ID, &s.Title, &s.Content, &s.FileType, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("skill not found: %w", err)
	}
	return &s, nil
}

func (r *SkillRepository) List(ctx context.Context) ([]models.Skill, error) {
	query := `SELECT id, title, content, file_type, created_at FROM skills ORDER BY created_at DESC`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list skills: %w", err)
	}
	defer rows.Close()

	var skills []models.Skill
	for rows.Next() {
		var s models.Skill
		if err := rows.Scan(&s.ID, &s.Title, &s.Content, &s.FileType, &s.CreatedAt); err == nil {
			skills = append(skills, s)
		}
	}
	return skills, nil
}

func (r *SkillRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM skills WHERE id = $1", id)
	return err
}
