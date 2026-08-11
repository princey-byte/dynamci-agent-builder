CREATE TABLE IF NOT EXISTS execution_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id),
    status VARCHAR(50) NOT NULL DEFAULT 'RUNNING',
    input_query TEXT NOT NULL,
    final_output TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS session_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES execution_sessions(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id),
    step_number INT NOT NULL,
    log_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
