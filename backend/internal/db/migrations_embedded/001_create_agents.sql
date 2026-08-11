CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    persona TEXT NOT NULL,
    model_provider VARCHAR(100) NOT NULL DEFAULT 'openai',
    model_name VARCHAR(100) NOT NULL DEFAULT 'gpt-4o',
    temperature NUMERIC(3, 2) DEFAULT 0.20,
    role_type VARCHAR(50) NOT NULL CHECK (role_type IN ('supervisor', 'worker', 'evaluator')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
