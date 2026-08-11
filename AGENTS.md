Acts as the **master technical specification** for developers and AI coding assistants (e.g. Cursor, Claude Code, GitHub Copilot).
- **Core Requirements**: Details backend Go requirements, Next.js frontend setup, and PostgreSQL database migrations.
- **Database Schema**: Full PostgreSQL DDL for agents, skills, MCP tools, workflows, execution sessions, and session logs.
- **Direct References**: Directly links to `PRODUCT.md` for business logic/use cases and `DESIGN.md` for component rules.

```markdown
# AGENTS.md — System Implementation & Core Requirements

This document outlines the core requirements, architecture, and instructions for AI agents and developers implementing the **Agentic Workflow Platform**.

---

## 1. System Overview & Tech Stack

The platform allows users to create, configure, and run hierarchical AI agents with custom personas, skills (Markdown/Text files), MCP tools, multi-LLM support, persistent session storage, and real-time streaming cognition via Server-Sent Events (SSE).

### Technology Stack
- **Backend Engine**: Go (Golang 1.22+)
- **Frontend Application**: Next.js 14+ (App Router, TypeScript, Tailwind CSS)
- **Database & Storage**: PostgreSQL 16+
- **Tooling Protocol**: Model Context Protocol (MCP)
- **Streaming Protocol**: Server-Sent Events (SSE) via HTTP

---

## 2. References & Project Standards

Before implementing features or modifying code, refer to these foundational documents:
- 📖 **[PRODUCT.md](./PRODUCT.md)**: Product vision, user personas, real-world use cases, and functional workflows.
- 🎨 **[DESIGN.md](./DESIGN.md)**: UI/UX design system, color tokens, typography, component rules, and interaction patterns.

---

## 3. Core Functional Requirements

### 3.1 Agent & Skill Management
- **Agent Customization**: CRUD endpoints for agents (`name`, `persona`, `model_provider`, `model_name`, `temperature`, `role_type`).
- **Skill Aggregation**: Support uploading `.md` and `.txt` files. System must combine base persona prompts with active skill documents into a single system context window.
- **Multi-LLM Integration**: Implement an abstract interface (`LLMProvider`) supporting OpenAI, Anthropic Claude, Google Gemini, Ollama, and custom endpoints.

### 3.2 Tool Integration (Model Context Protocol)
- Registry to add external MCP servers (Stdio or SSE transport).
- Dynamically parse MCP tool signatures and expose them as JSON Schema tools to LLM drivers.

### 3.3 Hierarchical Workflow Engine
- Establish parent-child agent topologies (Supervisor -> Workers).
- **Supervisor Routing**: Supervisor agent evaluates incoming tasks, delegates subtasks to Worker agents, and aggregates results.

### 3.4 Execution Persistence & SSE Streaming
- Real-time SSE endpoint (`GET /api/v1/workflows/{id}/execute/stream`).
- Stream event types: `AGENT_THOUGHT`, `AGENT_DELEGATION`, `TOOL_CALL`, `TOOL_RESULT`, `WORKFLOW_COMPLETE`, `ERROR`.
- Save all step-by-step trace logs to PostgreSQL (`execution_sessions` and `session_logs`).

---

## 4. Database Schema Quick Reference (PostgreSQL)

```sql
CREATE TABLE agents (
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

CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('markdown', 'text')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_skills (
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, skill_id)
);

CREATE TABLE mcp_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    server_url TEXT NOT NULL,
    input_schema JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_mcp_tools (
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    mcp_tool_id UUID REFERENCES mcp_tools(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, mcp_tool_id)
);

CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    supervisor_agent_id UUID REFERENCES agents(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    parent_node_id UUID REFERENCES workflow_nodes(id),
    agent_id UUID REFERENCES agents(id),
    execution_order INT NOT NULL,
    routing_condition TEXT
);

CREATE TABLE execution_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id),
    status VARCHAR(50) NOT NULL DEFAULT 'RUNNING',
    input_query TEXT NOT NULL,
    final_output TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE session_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES execution_sessions(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id),
    step_number INT NOT NULL,
    log_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);