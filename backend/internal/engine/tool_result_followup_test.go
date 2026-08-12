package engine

import (
	"strings"
	"testing"
)

func TestBuildToolResultFollowUpIncludesSuccessfulMCPContent(t *testing.T) {
	results := []executedToolResult{
		{
			Name:      "get_me",
			Arguments: map[string]interface{}{},
			Result: map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      float64(1),
				"result": map[string]interface{}{
					"content": []interface{}{
						map[string]interface{}{
							"type": "text",
							"text": `{"login":"princey-byte","details":{"public_repos":1,"total_private_repos":10}}`,
						},
					},
				},
			},
		},
	}

	message := buildToolResultFollowUp("list all the github repos i have", results)

	assertContains(t, message, "Original task: list all the github repos i have")
	assertContains(t, message, "Tool: get_me")
	assertContains(t, message, "princey-byte")
	assertContains(t, message, "public_repos")
	assertContains(t, message, "Use the tool results above")
}

func TestBuildToolResultFollowUpIncludesMCPToolErrors(t *testing.T) {
	results := []executedToolResult{
		{
			Name:      "atlassianUserInfo",
			Arguments: map[string]interface{}{},
			Result: map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      float64(1),
				"result": map[string]interface{}{
					"isError": true,
					"content": []interface{}{
						map[string]interface{}{
							"type": "text",
							"text": `{"error":true,"message":"We are having trouble completing this action. Please try again shortly."}`,
						},
					},
				},
			},
		},
	}

	message := buildToolResultFollowUp("who am i in atlassian", results)

	assertContains(t, message, "Tool: atlassianUserInfo")
	assertContains(t, message, "isError")
	assertContains(t, message, "We are having trouble completing this action")
	assertContains(t, message, "Do not claim unavailable data was retrieved")
}

func TestFallbackToolResultOutputReturnsReadableContent(t *testing.T) {
	results := []executedToolResult{
		{
			Name:      "get_me",
			Arguments: map[string]interface{}{},
			Result: map[string]interface{}{
				"jsonrpc": "2.0",
				"result": map[string]interface{}{
					"content": []interface{}{
						map[string]interface{}{
							"type": "text",
							"text": `{"login":"princey-byte","details":{"total_private_repos":10}}`,
						},
					},
				},
			},
		},
	}

	output := fallbackToolResultOutput(results)

	assertContains(t, output, "Tool results were returned, but the model produced no final text")
	assertContains(t, output, "get_me")
	assertContains(t, output, "princey-byte")
	assertContains(t, output, "total_private_repos")
}

func TestChooseWorkerFinalOutputPrefersModelFollowUp(t *testing.T) {
	results := []executedToolResult{
		{Name: "get_me", Result: map[string]interface{}{"ok": true}},
	}

	output := chooseWorkerFinalOutput("You have 11 repositories.", results)

	if output != "You have 11 repositories." {
		t.Fatalf("expected model follow-up output, got %q", output)
	}
}

func TestChooseWorkerFinalOutputFallsBackToToolResults(t *testing.T) {
	results := []executedToolResult{
		{Name: "get_me", Result: map[string]interface{}{"login": "princey-byte"}},
	}

	output := chooseWorkerFinalOutput("   ", results)

	assertContains(t, output, "Tool results were returned")
	assertContains(t, output, "get_me")
	assertContains(t, output, "princey-byte")
}

func assertContains(t *testing.T, value string, expected string) {
	t.Helper()
	if !strings.Contains(value, expected) {
		t.Fatalf("expected %q to contain %q", value, expected)
	}
}
