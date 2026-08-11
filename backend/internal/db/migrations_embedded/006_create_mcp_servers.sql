CREATE TABLE IF NOT EXISTS mcp_servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    server_url TEXT NOT NULL,
    transport_type VARCHAR(20) NOT NULL DEFAULT 'sse' CHECK (transport_type IN ('sse', 'stdio')),
    auth_type VARCHAR(50) NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'bearer', 'api_key', 'custom_headers', 'env_vars')),
    auth_config JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mcp_tools ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES mcp_servers(id) ON DELETE CASCADE;
