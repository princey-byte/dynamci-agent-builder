### 2. `PRODUCT.md`
[file-tag: code-generated-file-1-1786357600257567000]

Explains the **real-world business purpose and product use cases** of the platform.
- **Real Use Cases**: Includes concrete examples (e.g. Automated PR Code Review Team, Customer Support Triage with Stripe MCP tool).
- **User Personas**: Target users (AI Architect, Operations Lead, Software Engineer).
- **User Journeys**: Step-by-step product walkthroughs from creation to live streaming console.

```markdown
# PRODUCT.md — Product Vision, Use Cases & Workflows

## 1. Product Vision & Value Proposition

The **Agentic Workflow Platform** is an enterprise-grade, self-serve platform designed to democratize multi-agent automation. Instead of hardcoding AI agents into single-file scripts, teams can visually build, train, and orchestrate specialized AI worker teams under central supervisor control.

### Core Value Drivers
- **Dynamic Skill Ingestion**: Train agents on company domain knowledge by simply dropping Markdown (`.md`) or text (`.txt`) SOPs and documentation.
- **Model Agnostic**: Mix and match LLM providers (e.g. Claude for complex reasoning, GPT for coding, Gemini for speed, Ollama for local privacy).
- **Extensible Function Calling**: Plug into external systems using Model Context Protocol (MCP) servers.
- **Transparent Execution**: See every step of the agent's thought process, tool call, and delegation live via Server-Sent Events (SSE).

---

## 2. Target User Personas

1. **AI System Architect**: Configures multi-agent team hierarchies, assigns MCP tools, and establishes routing policies.
2. **Domain Operations Lead**: Uploads skill manuals (`SKILL.md`), writes agent personas, and tests workflows against real scenarios.
3. **Software Developer / Engineer**: Integrates the backend SSE APIs into web applications and monitors step-by-step execution logs.

---

## 3. Real-World Use Cases

### Use Case 1: Automated Software Architecture & Code Review Team
- **Supervisor Agent**: Architectural Lead (Runs on `claude-3-5-sonnet`)
- **Worker Agent 1**: Security Compliance Auditor (Runs on `gpt-4o`, equipped with OWASP `.md` skill file and GitHub MCP tool)
- **Worker Agent 2**: Performance & DB Optimizer (Runs on `gemini-1.5-pro`, equipped with SQL performance `.txt` guide)
- **Workflow**:
  1. User submits a pull request URL.
  2. Supervisor routes the PR diff to Security Worker and Database Worker.
  3. Security Worker uses MCP to fetch code, checks OWASP guidelines, and flags vulnerabilities.
  4. Database Worker analyzes query execution plans.
  5. Supervisor combines findings into a single structured report.

### Use Case 2: Enterprise Customer Support & Escalation Dispatch
- **Supervisor Agent**: Support Triage Dispatcher
- **Worker Agent 1**: Billing Specialist (equipped with Refund Policy `.md` skill and Stripe MCP tool)
- **Worker Agent 2**: Technical Troubleshooting Agent (equipped with API docs `.md` skill)
- **Workflow**:
  1. Customer submits a query.
  2. Supervisor identifies query intent and routes to Billing Specialist.
  3. Billing Specialist invokes Stripe MCP tool to inspect transaction history and process refund.
  4. Real-time updates stream directly to support dashboard via SSE.

---

## 4. Key User Journeys

1. **Creating an Agent**: Navigates to `/agents/create` -> Fills name, persona, provider, model -> Uploads `SKILL.md` file -> Attaches MCP tools.
2. **Building a Workflow**: Navigates to `/workflows/builder` -> Selects Supervisor Agent -> Connects Worker Agents -> Saves graph.
3. **Live Execution**: Executes workflow -> Renders real-time stream console showing thinking steps, tool invocations, and delegations.