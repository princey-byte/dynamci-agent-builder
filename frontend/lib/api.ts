import { Agent, Skill, MCPTool, MCPServer, Workflow, ExecutionSession, SessionLog, DiscoverToolsRequest, DiscoveredTool, OAuthInitRequest, OAuthInitResponse, OAuthCallbackRequest, OAuthTokens, MCPDiscoveryResult, AuthConfig, FileType, JsonValue } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `API error: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  // Agents
  getAgents: () => fetchJSON<Agent[]>('/agents'),
  getAgent: (id: string) => fetchJSON<Agent>(`/agents/${id}`),
  createAgent: (data: Partial<Agent> & { skill_ids?: string[]; mcp_tool_ids?: string[] }) =>
    fetchJSON<Agent>('/agents', { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id: string, data: Partial<Agent>) =>
    fetchJSON<Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAgent: (id: string) => fetchJSON<{ message: string }>(`/agents/${id}`, { method: 'DELETE' }),
  attachSkill: (agentId: string, skillId: string) =>
    fetchJSON<{ message: string }>(`/agents/${agentId}/skills`, { method: 'POST', body: JSON.stringify({ skill_id: skillId }) }),
  detachSkill: (agentId: string, skillId: string) =>
    fetchJSON<{ message: string }>(`/agents/${agentId}/skills/${skillId}`, { method: 'DELETE' }),
  attachMCPTool: (agentId: string, toolId: string) =>
    fetchJSON<{ message: string }>(`/agents/${agentId}/tools`, { method: 'POST', body: JSON.stringify({ mcp_tool_id: toolId }) }),

  // Skills
  getSkills: () => fetchJSON<Skill[]>('/skills'),
  getSkill: (id: string) => fetchJSON<Skill>(`/skills/${id}`),
  createSkill: (data: { title: string; content: string; file_type: FileType }) =>
    fetchJSON<Skill>('/skills', { method: 'POST', body: JSON.stringify(data) }),
  uploadSkillFile: async (formData: FormData): Promise<Skill> => {
    const res = await fetch(`${API_BASE}/skills`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  deleteSkill: (id: string) => fetchJSON<{ message: string }>(`/skills/${id}`, { method: 'DELETE' }),

  // MCP Servers & Discovery
  getMCPServers: () => fetchJSON<MCPServer[]>('/mcp/servers'),
  getMCPServer: (id: string) => fetchJSON<MCPServer>(`/mcp/servers/${id}`),
  createMCPServer: (data: {
    name: string;
    description?: string;
    server_url: string;
    command?: string;
    args?: string[];
    working_directory?: string;
    transport_type: string;
    auth_type: string;
    auth_config: AuthConfig;
    oauth_client_id?: string;
    oauth_client_secret?: string;
    oauth_scopes?: string;
    import_tools?: DiscoveredTool[];
  }) => fetchJSON<{ message?: string; server?: MCPServer } | MCPServer>('/mcp/servers', { method: 'POST', body: JSON.stringify(data) }),
  deleteMCPServer: (id: string) => fetchJSON<{ message: string }>(`/mcp/servers/${id}`, { method: 'DELETE' }),
  discoverMCPTools: (data: DiscoverToolsRequest) =>
    fetchJSON<MCPDiscoveryResult>('/mcp/servers/discover', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // OAuth 2.1 Handlers
  initMCPOAuth: (data: OAuthInitRequest) =>
    fetchJSON<OAuthInitResponse>('/mcp/oauth/init', { method: 'POST', body: JSON.stringify(data) }),
  callbackMCPOAuth: (data: OAuthCallbackRequest) =>
    fetchJSON<{ status: string; tokens: OAuthTokens; tools: DiscoveredTool[] }>('/mcp/oauth/callback', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // MCP Tools (Legacy / Direct)
  getMCPTools: () => fetchJSON<MCPTool[]>('/mcp/tools'),
  getMCPTool: (id: string) => fetchJSON<MCPTool>(`/mcp/tools/${id}`),
  registerMCPTool: (data: { name: string; description: string; server_url: string; transport_type?: string; input_schema: JsonValue }) =>
    fetchJSON<MCPTool>('/mcp/tools', { method: 'POST', body: JSON.stringify(data) }),
  deleteMCPTool: (id: string) => fetchJSON<{ message: string }>(`/mcp/tools/${id}`, { method: 'DELETE' }),

  // Workflows
  getWorkflows: () => fetchJSON<Workflow[]>('/workflows'),
  getWorkflow: (id: string) => fetchJSON<Workflow>(`/workflows/${id}`),
  createWorkflow: (data: {
    name: string;
    description?: string;
    supervisor_agent_id: string;
    nodes?: Array<{ id?: string; parent_node_id?: string; agent_id: string; execution_order: number; routing_condition?: string }>;
    edges?: Array<{ source_node_id: string; target_node_id: string; condition_type?: string; condition_expression?: string; label?: string }>;
  }) => fetchJSON<Workflow>('/workflows', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkflow: (
    id: string,
    data: {
      name: string;
      description?: string;
      supervisor_agent_id: string;
      nodes?: Array<{ id?: string; parent_node_id?: string; agent_id: string; execution_order: number; routing_condition?: string }>;
      edges?: Array<{ source_node_id: string; target_node_id: string; condition_type?: string; condition_expression?: string; label?: string }>;
    }
  ) => fetchJSON<Workflow>(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkflow: (id: string) => fetchJSON<{ message: string }>(`/workflows/${id}`, { method: 'DELETE' }),
  getWorkflowSessions: (workflowId: string) => fetchJSON<ExecutionSession[]>(`/workflows/${workflowId}/sessions`),

  // Sessions
  getSessions: () => fetchJSON<ExecutionSession[]>('/sessions'),
  getSession: (id: string) => fetchJSON<ExecutionSession>(`/sessions/${id}`),
  getSessionLogs: (id: string) => fetchJSON<SessionLog[]>(`/sessions/${id}/logs`),
};
