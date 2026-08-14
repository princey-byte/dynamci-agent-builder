# AGENTS.md - Agentic Workflow Platform Guide

Use this file as the first stop for AI coding agents working in this repository. Keep it concise, actionable, and linked to canonical docs instead of duplicating them.

## Project Purpose

The Agentic Workflow Platform is a full-stack system for creating and running hierarchical AI agent workflows. Users can define supervisor and worker agents, attach Markdown/text skills, connect MCP tools and servers, build workflows, execute them, and inspect streamed execution logs.

## Local Agent Rules And Skills

Before developing a new feature, check the local agent resources:

- Rules: [.agents/rules/guidelines.md](.agents/rules/guidelines.md) contains project coding standards for the Go backend and TypeScript/React frontend.
- Skills: [.agents/skills](.agents/skills) contains workflows that must be used when relevant. Load the specific `SKILL.md` before acting.

Commonly relevant skills include:

- `brainstorming` for feature shaping or behavior changes before implementation.
- `test-driven-development` for feature and bug-fix implementation.
- `systematic-debugging` for bugs, failing tests, or unexpected behavior.
- `frontend-design`, `impeccable`, `nextjs`, `shadcn`, and `vercel-react-best-practices` for frontend work.
- `frontend-api-integration` for typed frontend API calls to the Go backend.
- `verification-before-completion` before claiming work is complete.
- `requesting-code-review` before major merges or larger feature completion.

Prefer adding or updating a focused skill when a repeated workflow cannot be captured cleanly in this root guide.

## Repository Shape

- [backend](backend): Go backend engine using Gin, pgx/PostgreSQL, embedded migrations, repositories, handlers, MCP integration, LLM providers, and workflow execution.
- [frontend](frontend): Next.js App Router frontend using React 19, TypeScript, Tailwind CSS 4, Base UI/shadcn-style components, lucide icons, and Vitest.
- [backend/migrations](backend/migrations): SQL migration source files. Backend also embeds migration copies under `backend/internal/db/migrations_embedded`.
- [docs](docs): focused implementation notes and historical plans. Link these rather than copying their content.

## Backend Implementation Status

The backend entrypoint is [backend/cmd/server/main.go](backend/cmd/server/main.go). It loads `.env` when present, reads [backend/config.json](backend/config.json), initializes PostgreSQL, runs embedded migrations, constructs repositories, creates the MCP tool registry, and registers API routes.

Implemented backend areas:

- Agents: CRUD, skill attachment, and MCP tool attachment.
- Skills: JSON creation and multipart upload for Markdown/text skill files.
- MCP servers: create/list/get/delete, tool discovery, OAuth callback flow, connection state, stdio transport, and HTTP/SSE transport behavior.
- MCP tools: legacy direct register/list/get/delete endpoints.
- Workflows: create/list/get/delete plus execution over SSE.
- Sessions: persisted execution sessions and step logs.
- Engine: context aggregation, supervisor routing, worker execution, MCP tool calls, tool-result follow-up, orchestration, and SSE event streaming.
- LLM providers: provider abstraction with OpenAI, Azure OpenAI, Anthropic/Claude, and Gemini factory support.

Important backend files:

- API routes: [backend/internal/api/routes.go](backend/internal/api/routes.go)
- Models and validation: [backend/internal/models](backend/internal/models)
- Repositories: [backend/internal/repository](backend/internal/repository)
- Workflow engine: [backend/internal/engine](backend/internal/engine)
- MCP clients and registry: [backend/internal/mcp](backend/internal/mcp)
- LLM providers: [backend/internal/llm](backend/internal/llm)
- DB init and migration embedding: [backend/internal/db](backend/internal/db)

Backend commands, run from [backend](backend):

```bash
go run ./cmd/server
go test ./...
go test ./internal/engine
go test ./internal/mcp ./internal/mcp/transport
go test ./internal/models
```

Runtime notes:

- Default backend port is `8080`.
- PostgreSQL is configured through `server.database_url`; see [backend/config.example.json](backend/config.example.json).
- Do not invent a separate migration command; migrations run during DB initialization.

## Frontend Implementation Status

For any frontend changes or any kind of modification, or any kind of new pages or new module implementation use ".agents/skills/shadcn" skills and ui library from shadcn only 

The frontend uses Next.js 16 and React 19. Respect [frontend/AGENTS.md](frontend/AGENTS.md): consult local Next docs in `frontend/node_modules/next/dist/docs/` before relying on older framework assumptions.

Implemented frontend areas:

- App shell with persistent dashboard sidebar and content layout.
- Agent list/create/edit screens.
- Skill list/upload screens.
- MCP tool and MCP server management screens, including OAuth callback handling.
- Workflow list/create/builder/execute screens.
- Session list/detail screens.
- SSE workflow execution hook and real-time thought console components.
- Shared API client, shared TypeScript types, reusable UI primitives, theme mode support, and design-token tests.

Important frontend files:

- API client: [frontend/lib/api.ts](frontend/lib/api.ts)
- Shared types: [frontend/lib/types.ts](frontend/lib/types.ts)
- SSE hook: [frontend/hooks/useWorkflowExecution.ts](frontend/hooks/useWorkflowExecution.ts)
- App shell: [frontend/components/app-sidebar.tsx](frontend/components/app-sidebar.tsx)
- Console rendering: [frontend/components/console](frontend/components/console)
- Workflow builder: [frontend/components/workflows](frontend/components/workflows)
- UI components: [frontend/components/ui](frontend/components/ui)

Frontend commands, run from [frontend](frontend):

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run test:run
```

Runtime notes:

- Frontend dev server defaults to `http://localhost:3000`.
- API calls default to `http://localhost:8080/api/v1` unless `NEXT_PUBLIC_API_URL` is set.
- Existing browser sessions may use a different port, such as `3001`, when `3000` is occupied.

## Development Conventions

- Follow [.agents/rules/guidelines.md](.agents/rules/guidelines.md) for naming, file organization, state handling, error handling, and backend struct patterns.
- Keep edits scoped to the feature slice. Avoid broad refactors unless the feature requires them.
- Link to existing docs instead of embedding long reference material in instruction files.
- Preserve generated Next.js agent guidance in [frontend/AGENTS.md](frontend/AGENTS.md); Next may re-add it during development.
- Use semantic frontend design tokens and existing UI primitives. The design-token audit rejects raw hex colors and raw Tailwind color families in migrated UI files.
- Keep [backend/migrations](backend/migrations) and embedded migration files in sync when changing schema behavior.
- Treat workflow execution as supervisor-led sequential delegation unless intentionally changing the engine model.
- For MCP stdio servers, use command, args, optional working directory, and auth env vars. For HTTP/SSE MCP servers, use server URL plus headers/OAuth configuration.

## Verification Expectations

Run the narrowest relevant checks after edits:

- Backend logic: `go test ./...` or a narrower package test from [backend](backend).
- Frontend logic/UI: `npm run test:run`, `npm run lint`, or a targeted Vitest invocation from [frontend](frontend).
- Full frontend confidence: `npm run build` from [frontend](frontend) when routing, server/client boundaries, or Next.js behavior changes.

Before saying work is complete, use the `verification-before-completion` skill when relevant and report which checks passed or could not be run.