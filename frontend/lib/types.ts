export type RoleType = 'supervisor' | 'worker' | 'evaluator';
export type FileType = 'markdown' | 'text';
export type TransportType = 'sse' | 'stdio';
export type AuthType = 'none' | 'bearer' | 'api_key' | 'custom_headers' | 'env_vars' | 'oauth2';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_at?: string;
  scope?: string;
}

export interface AuthConfig {
  bearer_token?: string;
  api_key_header_name?: string;
  api_key_header_value?: string;
  custom_headers?: Record<string, string>;
  env_vars?: Record<string, string>;
  oauth?: OAuthTokens;
}

export interface Skill {
  id: string;
  title: string;
  content: string;
  file_type: FileType;
  created_at: string;
}

export interface MCPTool {
  id: string;
  server_id?: string;
  server?: MCPServer;
  name: string;
  description: string;
  server_url: string;
  transport_type: TransportType;
  input_schema: any;
  created_at: string;
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  server_url: string;
  transport_type: TransportType;
  auth_type: AuthType;
  auth_config: AuthConfig;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_scopes?: string;
  oauth_tokens?: OAuthTokens;
  status: string;
  created_at: string;
  updated_at: string;
  tools?: MCPTool[];
}

export interface DiscoveredTool {
  name: string;
  description: string;
  input_schema: any;
  selected?: boolean;
}

export interface DiscoverToolsRequest {
  server_url: string;
  transport_type: TransportType;
  auth_type: AuthType;
  auth_config: AuthConfig;
}

export interface OAuthInitRequest {
  server_url: string;
  authorize_url?: string;
  registration_url?: string;
  client_id?: string;
  scopes?: string;
  redirect_uri: string;
}

export interface OAuthInitResponse {
  authorization_url: string;
  state: string;
  code_verifier: string;
  client_id?: string;
  client_secret?: string;
}

export interface OAuthCallbackRequest {
  server_url: string;
  token_url?: string;
  code: string;
  code_verifier: string;
  client_id?: string;
  client_secret?: string;
  redirect_uri: string;
}

export interface Agent {
  id: string;
  name: string;
  persona: string;
  model_provider: string; // 'openai' | 'azure_openai' | 'anthropic' | 'gemini'
  model_name: string;
  temperature: number;
  role_type: RoleType;
  created_at: string;
  updated_at: string;
  skills?: Skill[];
  mcp_tools?: MCPTool[];
}

export interface WorkflowNode {
  id: string;
  workflow_id: string;
  parent_node_id?: string;
  agent_id: string;
  agent?: Agent;
  execution_order: number;
  routing_condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  supervisor_agent_id?: string;
  supervisor_agent?: Agent;
  created_at: string;
  nodes?: WorkflowNode[];
}

export interface SessionLog {
  id: string;
  session_id: string;
  agent_id?: string;
  agent_name?: string;
  step_number: number;
  log_type: 'AGENT_THOUGHT' | 'AGENT_DELEGATION' | 'TOOL_CALL' | 'TOOL_RESULT' | 'TOKEN_STREAM' | 'WORKFLOW_COMPLETE' | 'ERROR';
  content: any;
  created_at: string;
}

export interface ExecutionSession {
  id: string;
  workflow_id: string;
  workflow?: Workflow;
  status: 'RUNNING' | 'COMPLETED' | 'ERROR';
  input_query: string;
  final_output?: string;
  started_at: string;
  completed_at?: string;
  logs?: SessionLog[];
}

export interface SSELogEvent {
  event: 'AGENT_THOUGHT' | 'AGENT_DELEGATION' | 'TOOL_CALL' | 'TOOL_RESULT' | 'TOKEN_STREAM' | 'WORKFLOW_COMPLETE' | 'ERROR';
  session_id: string;
  agent_name?: string;
  step: number;
  payload: any;
}
