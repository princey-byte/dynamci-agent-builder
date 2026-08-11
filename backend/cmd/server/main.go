package main

import (
	"fmt"
	"log"

	"agentic-platform/backend/internal/api"
	"agentic-platform/backend/internal/config"
	"agentic-platform/backend/internal/db"
	"agentic-platform/backend/internal/mcp"
	"agentic-platform/backend/internal/repository"

	"github.com/joho/godotenv"
)

func main() {
	log.Println("Starting Agentic Workflow Platform Backend Engine...")

	if err := godotenv.Load(".env"); err != nil {
		log.Println("Note: No .env file found or error reading .env, reading config.json and system env.")
	}

	cfg, err := config.LoadConfig("config.json")
	if err != nil {
		log.Printf("Warning: Failed to load config.json (%v), using default settings.", err)
	}

	pool, err := db.InitDB(cfg.Server.DatabaseURL)
	if err != nil {
		log.Fatalf("Fatal: Database initialization error: %v", err)
	}

	agentRepo := repository.NewAgentRepository(pool)
	skillRepo := repository.NewSkillRepository(pool)
	mcpToolRepo := repository.NewMCPToolRepository(pool)
	mcpServerRepo := repository.NewMCPServerRepository(pool, mcpToolRepo)
	workflowRepo := repository.NewWorkflowRepository(pool, agentRepo)
	sessionRepo := repository.NewSessionRepository(pool, workflowRepo)
	toolRegistry := mcp.NewToolRegistry()

	r := api.SetupRouter(agentRepo, skillRepo, mcpToolRepo, mcpServerRepo, workflowRepo, sessionRepo, toolRegistry)

	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	log.Printf("Server listening on %s...", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
