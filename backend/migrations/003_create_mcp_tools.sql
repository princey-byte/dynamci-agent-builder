CREATE TABLE IF NOT EXISTS mcp_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    server_url TEXT NOT NULL,
    transport_type VARCHAR(20) NOT NULL DEFAULT 'sse' CHECK (transport_type IN ('sse', 'stdio')),
    input_schema JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_mcp_tools (
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    mcp_tool_id UUID REFERENCES mcp_tools(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, mcp_tool_id)
);
