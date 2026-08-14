ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS command TEXT DEFAULT '';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS args JSONB DEFAULT '[]';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS working_directory TEXT DEFAULT '';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS last_connection_status TEXT DEFAULT '';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS last_connection_error TEXT DEFAULT '';
ALTER TABLE mcp_servers ADD COLUMN IF NOT EXISTS last_discovered_at TIMESTAMPTZ;

UPDATE mcp_servers
SET command = server_url
WHERE transport_type = 'stdio'
  AND COALESCE(command, '') = ''
  AND COALESCE(server_url, '') <> '';

UPDATE mcp_servers
SET status = 'REGISTERED'
WHERE status = 'ACTIVE';

ALTER TABLE mcp_tools ADD COLUMN IF NOT EXISTS command TEXT DEFAULT '';
ALTER TABLE mcp_tools ADD COLUMN IF NOT EXISTS args JSONB DEFAULT '[]';
ALTER TABLE mcp_tools ADD COLUMN IF NOT EXISTS working_directory TEXT DEFAULT '';

UPDATE mcp_tools
SET command = server_url
WHERE transport_type = 'stdio'
  AND COALESCE(command, '') = ''
  AND COALESCE(server_url, '') <> '';