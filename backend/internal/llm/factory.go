package llm

import (
	"fmt"
	"strings"

	"agentic-platform/backend/internal/config"
)

func GetLLMProvider(providerName, modelName string) (LLMProvider, error) {
	cfg := config.GlobalConfig
	pName := strings.ToLower(providerName)

	switch pName {
	case "azure_openai", "azure":
		apiKey := ""
		endpoint := ""
		apiVersion := ""
		var deployments map[string]string

		if cfg != nil {
			apiKey = cfg.LLM.AzureOpenAI.APIKey
			endpoint = cfg.LLM.AzureOpenAI.Endpoint
			apiVersion = cfg.LLM.AzureOpenAI.APIVersion
			deployments = cfg.LLM.AzureOpenAI.Deployments
		}
		return NewAzureOpenAIProvider(apiKey, endpoint, apiVersion, modelName, deployments), nil

	case "openai":
		apiKey := ""
		if cfg != nil {
			apiKey = cfg.LLM.OpenAI.APIKey
		}
		return NewOpenAIProvider(apiKey, modelName), nil

	case "anthropic", "claude":
		apiKey := ""
		if cfg != nil {
			apiKey = cfg.LLM.Anthropic.APIKey
		}
		return NewAnthropicProvider(apiKey, modelName), nil

	case "gemini", "google":
		apiKey := ""
		if cfg != nil {
			apiKey = cfg.LLM.Gemini.APIKey
		}
		return NewGeminiProvider(apiKey, modelName), nil

	default:
		// Default fallback to OpenAI provider instance
		apiKey := ""
		if cfg != nil {
			apiKey = cfg.LLM.OpenAI.APIKey
		}
		if pName == "" {
			return NewOpenAIProvider(apiKey, modelName), nil
		}
		return nil, fmt.Errorf("unsupported LLM provider: %s", providerName)
	}
}
