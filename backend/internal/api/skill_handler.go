package api

import (
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"agentic-platform/backend/internal/models"
	"agentic-platform/backend/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SkillHandler struct {
	repo *repository.SkillRepository
}

func NewSkillHandler(repo *repository.SkillRepository) *SkillHandler {
	return &SkillHandler{repo: repo}
}

func (h *SkillHandler) CreateSkill(c *gin.Context) {
	contentType := c.GetHeader("Content-Type")

	if strings.Contains(contentType, "multipart/form-data") {
		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "file field is required in multipart upload"})
			return
		}
		defer file.Close()

		fileBytes, err := io.ReadAll(file)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file"})
			return
		}

		title := c.PostForm("title")
		if title == "" {
			title = header.Filename
		}

		ext := strings.ToLower(filepath.Ext(header.Filename))
		fileType := models.FileTypeText
		if ext == ".md" || ext == ".markdown" {
			fileType = models.FileTypeMarkdown
		}

		skill, err := h.repo.Create(c.Request.Context(), models.CreateSkillRequest{
			Title:    title,
			Content:  string(fileBytes),
			FileType: fileType,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, skill)
		return
	}

	var req models.CreateSkillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	skill, err := h.repo.Create(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, skill)
}

func (h *SkillHandler) GetSkill(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid skill ID"})
		return
	}
	skill, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, skill)
}

func (h *SkillHandler) ListSkills(c *gin.Context) {
	skills, err := h.repo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, skills)
}

func (h *SkillHandler) DeleteSkill(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid skill ID"})
		return
	}
	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "skill deleted successfully"})
}
