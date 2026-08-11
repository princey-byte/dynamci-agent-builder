package models

import (
	"time"

	"github.com/google/uuid"
)

type FileType string

const (
	FileTypeMarkdown FileType = "markdown"
	FileTypeText     FileType = "text"
)

type Skill struct {
	ID        uuid.UUID `json:"id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	FileType  FileType  `json:"file_type"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateSkillRequest struct {
	Title    string   `json:"title" binding:"required"`
	Content  string   `json:"content" binding:"required"`
	FileType FileType `json:"file_type" binding:"required"`
}
