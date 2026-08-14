package transport

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"

	"agentic-platform/backend/internal/llm"
	"agentic-platform/backend/internal/models"
)

type StdioConfig struct {
	Command          string
	Args             []string
	WorkingDirectory string
	ToolName         string
	Schema           json.RawMessage
	AuthConfig       models.AuthConfig
}

type StdioClient struct {
	config StdioConfig
}

type stdioSession struct {
	cmd       *exec.Cmd
	stdin     io.WriteCloser
	stdout    *bufio.Reader
	stderr    *boundedBuffer
	encoder   *json.Encoder
	nextID    int
	closeOnce sync.Once
}

type boundedBuffer struct {
	mu    sync.Mutex
	limit int
	data  []byte
}

func NewStdioClient(config StdioConfig) *StdioClient {
	return &StdioClient{config: config}
}

func newBoundedBuffer(limit int) *boundedBuffer {
	return &boundedBuffer{limit: limit}
}

func (b *boundedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.data = append(b.data, p...)
	if len(b.data) > b.limit {
		b.data = b.data[len(b.data)-b.limit:]
	}
	return len(p), nil
}

func (b *boundedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return strings.TrimSpace(string(b.data))
}

func (c *StdioClient) prepareEnv() []string {
	env := os.Environ()
	for k, v := range c.config.AuthConfig.EnvVars {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}
	return env
}

func (c *StdioClient) startSession(ctx context.Context) (*stdioSession, error) {
	if c.config.Command == "" {
		return nil, fmt.Errorf("stdio MCP command is required")
	}

	cmd := exec.CommandContext(ctx, c.config.Command, c.config.Args...)
	cmd.Env = c.prepareEnv()
	if c.config.WorkingDirectory != "" {
		cmd.Dir = c.config.WorkingDirectory
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to open MCP stdio stdin: %w", err)
	}
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		_ = stdin.Close()
		return nil, fmt.Errorf("failed to open MCP stdio stdout: %w", err)
	}
	stderr := newBoundedBuffer(8192)
	cmd.Stderr = stderr

	if err := cmd.Start(); err != nil {
		_ = stdin.Close()
		return nil, fmt.Errorf("failed to start MCP stdio command %q: %w", c.config.Command, err)
	}

	session := &stdioSession{
		cmd:     cmd,
		stdin:   stdin,
		stdout:  bufio.NewReader(stdoutPipe),
		stderr:  stderr,
		encoder: json.NewEncoder(stdin),
		nextID:  1,
	}

	if err := session.initialize(ctx); err != nil {
		_ = session.Close()
		if stderrText := stderr.String(); stderrText != "" {
			return nil, fmt.Errorf("%w; stderr: %s", err, stderrText)
		}
		return nil, err
	}

	return session, nil
}

func (s *stdioSession) initialize(ctx context.Context) error {
	if _, err := s.request(ctx, InitializeRequest(s.next())); err != nil {
		return fmt.Errorf("MCP stdio initialize failed: %w", err)
	}
	if err := s.encoder.Encode(InitializedNotification()); err != nil {
		return fmt.Errorf("failed to send MCP initialized notification: %w", err)
	}
	return nil
}

func (s *stdioSession) next() int {
	id := s.nextID
	s.nextID++
	return id
}

func (s *stdioSession) request(ctx context.Context, req JSONRPCRequest) (json.RawMessage, error) {
	if err := s.encoder.Encode(req); err != nil {
		return nil, err
	}

	responseCh := make(chan JSONRPCResponse, 1)
	errorCh := make(chan error, 1)
	go func() {
		line, err := s.stdout.ReadBytes('\n')
		if err != nil {
			errorCh <- err
			return
		}
		var response JSONRPCResponse
		if err := json.Unmarshal(line, &response); err != nil {
			errorCh <- fmt.Errorf("invalid MCP stdio JSON-RPC response %q: %w", strings.TrimSpace(string(line)), err)
			return
		}
		responseCh <- response
	}()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case err := <-errorCh:
		if stderrText := s.stderr.String(); stderrText != "" {
			return nil, fmt.Errorf("%w; stderr: %s", err, stderrText)
		}
		return nil, err
	case response := <-responseCh:
		if response.Error != nil {
			return nil, fmt.Errorf("MCP JSON-RPC error %d: %s", response.Error.Code, response.Error.Message)
		}
		return response.Result, nil
	}
}

func (s *stdioSession) Close() error {
	var err error
	s.closeOnce.Do(func() {
		_ = s.stdin.Close()
		if s.cmd.Process != nil {
			_ = s.cmd.Process.Kill()
		}
		err = s.cmd.Wait()
	})
	return err
}

func (c *StdioClient) DiscoverTools(ctx context.Context) (models.MCPDiscoveryResult, error) {
	session, err := c.startSession(ctx)
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
	}
	defer session.Close()

	result, err := session.request(ctx, ToolsListRequest(session.next()))
	if err != nil {
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: err.Error(), Tools: []models.DiscoveredTool{}}, err
	}

	var list struct {
		Tools []struct {
			Name        string          `json:"name"`
			Description string          `json:"description"`
			InputSchema json.RawMessage `json:"inputSchema"`
		} `json:"tools"`
	}
	if err := json.Unmarshal(result, &list); err != nil {
		parseErr := fmt.Errorf("failed to parse MCP tools/list result: %w", err)
		return models.MCPDiscoveryResult{Status: models.MCPDiscoveryStatusError, Message: parseErr.Error(), Tools: []models.DiscoveredTool{}}, parseErr
	}

	discovered := make([]models.DiscoveredTool, 0, len(list.Tools))
	for _, tool := range list.Tools {
		discovered = append(discovered, models.DiscoveredTool{
			Name:        tool.Name,
			Description: tool.Description,
			InputSchema: tool.InputSchema,
			Selected:    true,
		})
	}

	if len(discovered) == 0 {
		return models.MCPDiscoveryResult{
			Status:          models.MCPDiscoveryStatusEmpty,
			Message:         "Connected to MCP stdio server, but it returned no tools.",
			ProtocolVersion: DefaultProtocolVersion,
			Tools:           []models.DiscoveredTool{},
		}, nil
	}

	return models.MCPDiscoveryResult{
		Status:          models.MCPDiscoveryStatusConnected,
		Message:         fmt.Sprintf("Connected to MCP stdio server and discovered %d tools.", len(discovered)),
		ProtocolVersion: DefaultProtocolVersion,
		Tools:           discovered,
	}, nil
}

func (c *StdioClient) ListTools(ctx context.Context) ([]llm.ToolDefinition, error) {
	var inputSchema interface{}
	if len(c.config.Schema) > 0 {
		_ = json.Unmarshal(c.config.Schema, &inputSchema)
	}
	if inputSchema == nil {
		inputSchema = map[string]interface{}{"type": "object", "properties": map[string]interface{}{}}
	}
	return []llm.ToolDefinition{{
		Name:        c.config.ToolName,
		Description: fmt.Sprintf("MCP stdio tool %s via command %s", c.config.ToolName, c.config.Command),
		InputSchema: inputSchema,
	}}, nil
}

func (c *StdioClient) CallTool(ctx context.Context, name string, args map[string]interface{}) (interface{}, error) {
	session, err := c.startSession(ctx)
	if err != nil {
		return nil, err
	}
	defer session.Close()

	result, err := session.request(ctx, ToolsCallRequest(session.next(), name, args))
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"jsonrpc": "2.0",
		"result":  json.RawMessage(result),
	}, nil
}

func (c *StdioClient) Close() error {
	return nil
}