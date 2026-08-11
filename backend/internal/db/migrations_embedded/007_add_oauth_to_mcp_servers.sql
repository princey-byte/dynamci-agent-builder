ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS oauth_client_id TEXT;
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS oauth_client_secret TEXT;
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS oauth_scopes TEXT;
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS oauth_tokens JSONB DEFAULT '{}';

ALTER TABLE mcp_servers DROP CONSTRAINT IF EXISTS mcp_servers_auth_type_check;
ALTER TABLE mcp_servers ADD CONSTRAINT mcp_servers_auth_type_check CHECK (auth_type IN ('none', 'bearer', 'api_key', 'custom_headers', 'env_vars', 'oauth2'));

ALTER TABLE mcp_tools DROP CONSTRAINT IF EXISTS mcp_tools_name_key;
