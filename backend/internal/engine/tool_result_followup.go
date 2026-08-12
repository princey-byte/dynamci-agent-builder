package engine

import (
	"encoding/json"
	"fmt"
	"strings"
)

type executedToolResult struct {
	Name      string
	Arguments map[string]interface{}
	Result    interface{}
	Err       error
}

func buildToolResultFollowUp(originalTask string, results []executedToolResult) string {
	var builder strings.Builder

	builder.WriteString("The previous assistant response requested MCP tool calls. The tools have now been executed.\n\n")
	builder.WriteString(fmt.Sprintf("Original task: %s\n\n", originalTask))
	builder.WriteString("MCP tool results:\n")

	for index, result := range results {
		builder.WriteString(fmt.Sprintf("\n%d. Tool: %s\n", index+1, result.Name))
		builder.WriteString(fmt.Sprintf("Arguments: %s\n", marshalToolValue(result.Arguments)))
		if result.Err != nil {
			builder.WriteString(fmt.Sprintf("Execution error: %s\n", result.Err.Error()))
		}
		builder.WriteString(fmt.Sprintf("Result: %s\n", marshalToolValue(result.Result)))
	}

	builder.WriteString("\nUse the tool results above to answer the original task directly. ")
	builder.WriteString("If a tool result contains isError=true or an error payload, explain that the tool returned an error. Do not claim unavailable data was retrieved.")

	return builder.String()
}

func fallbackToolResultOutput(results []executedToolResult) string {
	var builder strings.Builder

	builder.WriteString("Tool results were returned, but the model produced no final text.\n\n")
	for index, result := range results {
		builder.WriteString(fmt.Sprintf("### Tool %d: %s\n", index+1, result.Name))
		if result.Err != nil {
			builder.WriteString(fmt.Sprintf("Execution error: %s\n", result.Err.Error()))
		}
		builder.WriteString("```json\n")
		builder.WriteString(marshalToolValue(result.Result))
		builder.WriteString("\n```\n\n")
	}

	return strings.TrimSpace(builder.String())
}

func marshalToolValue(value interface{}) string {
	if value == nil {
		return "null"
	}

	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Sprintf("%v", value)
	}
	return string(data)
}

func chooseWorkerFinalOutput(modelContent string, results []executedToolResult) string {
	if strings.TrimSpace(modelContent) != "" {
		return modelContent
	}
	if len(results) > 0 {
		return fallbackToolResultOutput(results)
	}
	return modelContent
}
