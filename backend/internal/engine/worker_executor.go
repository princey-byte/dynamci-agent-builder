package engine

import (
	"context"
	"encoding/json"
	"fmt"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/mcp"
	"agentic-platform/backend/internal/models"
	"agentic-platform/backend/internal/repository"
)

type WorkerExecutor struct {
	aggregator   *ContextAggregator
	toolRegistry *mcp.ToolRegistry
	sessionRepo  *repository.SessionRepository
}

func NewWorkerExecutor(aggregator *ContextAggregator, toolRegistry *mcp.ToolRegistry, sessionRepo *repository.SessionRepository) *WorkerExecutor {
	return &WorkerExecutor{
		aggregator:   aggregator,
		toolRegistry: toolRegistry,
		sessionRepo:  sessionRepo,
	}
}

func (we *WorkerExecutor) ExecuteWorker(
	ctx context.Context,
	worker *models.Agent,
	taskDescription string,
	sessionID string,
	stepNum *int,
	eventChan chan<- models.StreamMessage,
) (string, error) {
	*stepNum++
	currentStep := *stepNum

	// 1. Emit AGENT_THOUGHT
	thoughtMsg := models.StreamMessage{
		Event:     models.EventAgentThought,
		SessionID: sessionID,
		AgentName: worker.Name,
		Step:      currentStep,
		Payload: map[string]interface{}{
			"thought": fmt.Sprintf("Worker '%s' received task: %s. Analyzing persona and skills context window...", worker.Name, taskDescription),
		},
	}
	eventChan <- thoughtMsg
	_ = we.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &worker.ID, currentStep, string(models.EventAgentThought), thoughtMsg.Payload)

	// 2. Build system context window
	systemPrompt := we.aggregator.BuildSystemPrompt(worker)

	// 3. Prepare tools
	toolDefs := we.toolRegistry.GetTools(worker.MCPTools)

	// 4. Instantiate LLM
	provider, err := llm.GetLLMProvider(worker.ModelProvider, worker.ModelName)
	if err != nil {
		return "", err
	}

	messages := []llm.ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: taskDescription},
	}

	// 5. Query LLM
	resp, err := provider.Chat(ctx, messages, toolDefs, worker.Temperature)
	if err != nil {
		return "", fmt.Errorf("worker LLM execution failed: %w", err)
	}

	// 6. Handle tool calls if triggered
	var executedResults []executedToolResult
	if len(resp.ToolCalls) > 0 {
		for _, tc := range resp.ToolCalls {
			*stepNum++
			tStep := *stepNum

			argsMap := map[string]interface{}{}
			if tc.Arguments != "" {
				_ = json.Unmarshal([]byte(tc.Arguments), &argsMap)
			}

			toolCallMsg := models.StreamMessage{
				Event:     models.EventToolCall,
				SessionID: sessionID,
				AgentName: worker.Name,
				Step:      tStep,
				Payload: map[string]interface{}{
					"tool_name": tc.Name,
					"arguments": tc.Arguments,
				},
			}
			eventChan <- toolCallMsg
			_ = we.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &worker.ID, tStep, string(models.EventToolCall), toolCallMsg.Payload)

			toolResult, execErr := we.toolRegistry.ExecuteTool(ctx, tc.Name, argsMap)
			executedResults = append(executedResults, executedToolResult{
				Name:      tc.Name,
				Arguments: argsMap,
				Result:    toolResult,
				Err:       execErr,
			})

			*stepNum++
			rStep := *stepNum

			resultMsg := models.StreamMessage{
				Event:     models.EventToolResult,
				SessionID: sessionID,
				AgentName: worker.Name,
				Step:      rStep,
				Payload: map[string]interface{}{
					"tool_name": tc.Name,
					"result":    toolResult,
					"error":     execErr,
				},
			}
			eventChan <- resultMsg
			_ = we.sessionRepo.AppendLog(ctx, parseUUID(sessionID), &worker.ID, rStep, string(models.EventToolResult), resultMsg.Payload)
		}
	}

	if len(executedResults) > 0 {
		followUpMessages := append([]llm.ChatMessage{}, messages...)
		followUpMessages = append(followUpMessages, llm.ChatMessage{
			Role:    "user",
			Content: buildToolResultFollowUp(taskDescription, executedResults),
		})

		finalResp, followUpErr := provider.Chat(ctx, followUpMessages, nil, worker.Temperature)
		if followUpErr != nil {
			return fallbackToolResultOutput(executedResults), nil
		}
		return chooseWorkerFinalOutput(finalResp.Content, executedResults), nil
	}

	return resp.Content, nil
}
