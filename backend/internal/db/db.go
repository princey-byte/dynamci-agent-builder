package db

import (
	"context"
	"embed"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations_embedded/*.sql
var embeddedMigrations embed.FS

var Pool *pgxpool.Pool

func InitDB(connString string) (*pgxpool.Pool, error) {
	ctx := context.Background()
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("unable to parse db config: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		log.Printf("Warning: Database ping failed: %v", err)
	} else {
		log.Println("Database connection pool established successfully.")
	}

	Pool = pool

	// Automatically run migrations on app start
	if err := AutoMigrate(pool); err != nil {
		log.Printf("Warning during auto-migration: %v", err)
	}

	return pool, nil
}

func AutoMigrate(pool *pgxpool.Pool) error {
	if pool == nil {
		return fmt.Errorf("database pool is nil")
	}
	ctx := context.Background()

	// 1. Try embedded migrations first
	entries, err := embeddedMigrations.ReadDir("migrations_embedded")
	if err == nil && len(entries) > 0 {
		var filenames []string
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
				filenames = append(filenames, e.Name())
			}
		}
		sort.Strings(filenames)

		for _, name := range filenames {
			content, err := embeddedMigrations.ReadFile("migrations_embedded/" + name)
			if err != nil {
				continue
			}
			_, execErr := pool.Exec(ctx, string(content))
			if execErr != nil {
				log.Printf("Auto-migration notice [%s]: %v", name, execErr)
			} else {
				log.Printf("Auto-migrated database schema: %s", name)
			}
		}
		return nil
	}

	// 2. Fallback to filesystem search
	possibleDirs := []string{"migrations", "backend/migrations", "../migrations"}
	for _, dir := range possibleDirs {
		files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
		if err == nil && len(files) > 0 {
			sort.Strings(files)
			for _, file := range files {
				content, err := os.ReadFile(file)
				if err != nil {
					continue
				}
				_, execErr := pool.Exec(ctx, string(content))
				if execErr != nil {
					log.Printf("Auto-migration notice [%s]: %v", filepath.Base(file), execErr)
				} else {
					log.Printf("Auto-migrated database schema: %s", filepath.Base(file))
				}
			}
			return nil
		}
	}

	return nil
}
