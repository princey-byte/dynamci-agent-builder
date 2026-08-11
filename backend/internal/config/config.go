package config

import (
	"encoding/json"
	"os"
)

type Config struct {
	Server ServerConfig `json:"server"`
	LLM    LLMConfig    `json:"llm"`
}

type ServerConfig struct {
	Port        string `json:"port"`
	DatabaseURL string `json:"database_url"`
}

type LLMConfig struct {
	DefaultProvider string             `json:"default_provider"`
	OpenAI          OpenAIConfig       `json:"openai"`
	AzureOpenAI     AzureOpenAIConfig  `json:"azure_openai"`
	Anthropic       AnthropicConfig    `json:"anthropic"`
	Gemini          GeminiConfig       `json:"gemini"`
}

type OpenAIConfig struct {
	APIKey string `json:"api_key"`
}

type AzureOpenAIConfig struct {
	APIKey      string            `json:"api_key"`
	Endpoint    string            `json:"endpoint"`
	APIVersion  string            `json:"api_version"`
	Deployments map[string]string `json:"deployments"` // model_name -> deployment_id/name
}

type AnthropicConfig struct {
	APIKey string `json:"api_key"`
}

type GeminiConfig struct {
	APIKey string `json:"api_key"`
}

var GlobalConfig *Config

func LoadConfig(configPath string) (*Config, error) {
	if configPath == "" {
		configPath = "config.json"
	}

	cfg := &Config{
		Server: ServerConfig{
			Port:        "8080",
			DatabaseURL: "postgres://fpuser:secretpgpassword@localhost:5432/postgres?sslmode=disable",
		},
		LLM: LLMConfig{
			DefaultProvider: "openai",
			AzureOpenAI: AzureOpenAIConfig{
				APIVersion:  "2024-02-15-preview",
				Deployments: make(map[string]string),
			},
		},
	}

	data, err := os.ReadFile(configPath)
	if err == nil {
		if parseErr := json.Unmarshal(data, cfg); parseErr != nil {
			return nil, parseErr
		}
	}

	// Environment variable overrides
	if envPort := os.Getenv("PORT"); envPort != "" {
		cfg.Server.Port = envPort
	}
	if envDB := os.Getenv("DATABASE_URL"); envDB != "" {
		cfg.Server.DatabaseURL = envDB
	}
	if envOpenAI := os.Getenv("OPENAI_API_KEY"); envOpenAI != "" {
		cfg.LLM.OpenAI.APIKey = envOpenAI
	}
	if envAzureKey := os.Getenv("AZURE_OPENAI_API_KEY"); envAzureKey != "" {
		cfg.LLM.AzureOpenAI.APIKey = envAzureKey
	}
	if envAzureEnd := os.Getenv("AZURE_OPENAI_ENDPOINT"); envAzureEnd != "" {
		cfg.LLM.AzureOpenAI.Endpoint = envAzureEnd
	}
	if envAzureVer := os.Getenv("AZURE_OPENAI_API_VERSION"); envAzureVer != "" {
		cfg.LLM.AzureOpenAI.APIVersion = envAzureVer
	}
	if envAzureDeploy := os.Getenv("AZURE_OPENAI_DEPLOYMENT"); envAzureDeploy != "" {
		if cfg.LLM.AzureOpenAI.Deployments == nil {
			cfg.LLM.AzureOpenAI.Deployments = make(map[string]string)
		}
		cfg.LLM.AzureOpenAI.Deployments[envAzureDeploy] = envAzureDeploy
		cfg.LLM.AzureOpenAI.Deployments["model-router"] = envAzureDeploy
		cfg.LLM.AzureOpenAI.Deployments["gpt-4o"] = envAzureDeploy
	}
	if envAnthropic := os.Getenv("ANTHROPIC_API_KEY"); envAnthropic != "" {
		cfg.LLM.Anthropic.APIKey = envAnthropic
	}
	if envGemini := os.Getenv("GEMINI_API_KEY"); envGemini != "" {
		cfg.LLM.Gemini.APIKey = envGemini
	}

	GlobalConfig = cfg
	return cfg, nil
}
