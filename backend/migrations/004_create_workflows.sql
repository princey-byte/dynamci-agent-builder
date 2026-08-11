CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    supervisor_agent_id UUID REFERENCES agents(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    parent_node_id UUID REFERENCES workflow_nodes(id),
    agent_id UUID REFERENCES agents(id),
    execution_order INT NOT NULL,
    routing_condition TEXT
);
