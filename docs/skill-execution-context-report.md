# Skill Execution Context Report

Date: 2026-08-15

## Question

When an agent has multiple skills attached, does workflow execution send all attached skill content to the model, or does it retrieve only the skill relevant to the user query or current intent?

## Short Answer

The current implementation sends the full content of every skill attached to the executing agent as part of that agent's system prompt. There is no intent-based skill selection, semantic retrieval, vector search, ranking, chunking, or lazy skill fetch in the current backend execution path.

This applies per agent:

- A supervisor receives its own persona plus all skills attached to the supervisor.
- A worker receives its own persona plus all skills attached to that worker.
- The supervisor does not receive the full skill contents of worker agents; it receives only worker summaries containing worker name, role, and model.

## Evidence From Current Implementation

### 1. Skills Are Stored As Raw Content

Skills are modeled with a `Content` field in `backend/internal/models/skill.go`:

```go
type Skill struct {
    ID        uuid.UUID `json:"id"`
    Title     string    `json:"title"`
    Content   string    `json:"content"`
    FileType  FileType  `json:"file_type"`
    CreatedAt time.Time `json:"created_at"`
}
```

The skill upload/create handler reads the entire uploaded file or JSON content and stores it as one `Content` string. See `backend/internal/api/skill_handler.go`.

### 2. Agent Loading Fetches All Attached Skill Rows

`backend/internal/repository/agent_repository.go` loads attached skills in `GetByID` with this query:

```sql
SELECT s.id, s.title, s.content, s.file_type, s.created_at
FROM skills s
JOIN agent_skills aks ON s.id = aks.skill_id
WHERE aks.agent_id = $1
```

It appends every returned skill to `agent.Skills`. There is no filter based on the workflow query, user intent, routing condition, or semantic relevance.

### 3. Workflow Loading Hydrates Full Agents

`backend/internal/repository/workflow_repository.go` calls `agentRepo.GetByID` for the supervisor and each workflow node agent in `GetByID`.

Because `agentRepo.GetByID` loads all attached skills, workflow execution receives agents that already contain all attached skill records and their full content.

### 4. Prompt Construction Concatenates Every Attached Skill

The deciding behavior is in `backend/internal/engine/context_aggregator.go`:

```go
func (ca *ContextAggregator) BuildSystemPrompt(agent *models.Agent) string {
    var builder strings.Builder

    builder.WriteString(fmt.Sprintf("# Role Persona: %s\n\n", agent.Name))
    builder.WriteString(agent.Persona)
    builder.WriteString("\n\n")

    if len(agent.Skills) > 0 {
        builder.WriteString("# Attached Domain Knowledge & Skills (SOPs):\n\n")
        for i, skill := range agent.Skills {
            builder.WriteString(fmt.Sprintf("--- Skill %d: %s (%s) ---\n", i+1, skill.Title, skill.FileType))
            builder.WriteString(skill.Content)
            builder.WriteString("\n\n")
        }
    }

    return builder.String()
}
```

This loop appends every `skill.Content` value for the agent. It does not inspect the user query and does not choose a subset.

### 5. Worker Execution Sends That Full Prompt To The Model

`backend/internal/engine/worker_executor.go` builds the system prompt with:

```go
systemPrompt := we.aggregator.BuildSystemPrompt(worker)
```

Then it sends that prompt as a system message:

```go
messages := []llm.ChatMessage{
    {Role: "system", Content: systemPrompt},
    {Role: "user", Content: taskDescription},
}
```

The worker's full attached skill content is therefore included in the LLM request context.

### 6. Supervisor Execution Does The Same For Supervisor Skills

`backend/internal/engine/supervisor_router.go` uses the same aggregator for the supervisor:

```go
systemPrompt := sr.aggregator.BuildSystemPrompt(supervisor)
```

Then it appends worker summaries:

```go
fullSystemPrompt := systemPrompt + "\n\nAvailable Worker Team:\n" + strings.Join(workerSummaries, "\n")
```

The worker summaries include only name, role, and model:

```go
fmt.Sprintf("- Worker Agent: %s (Role: %s, Model: %s)", node.Agent.Name, node.Agent.RoleType, node.Agent.ModelName)
```

So the supervisor sees its own full attached skills, but not the full skill contents of every worker.

### 7. No Retrieval Or Relevance Selection Was Found

Targeted searches for retrieval-related implementation terms found no skill selection layer:

- `embedding`
- `vector`
- `semantic`
- `retrieve`
- `retrieval`
- `rank`
- `similarity`
- `select skill`
- `relevant skill`

The only execution-time skill prompt construction found was `ContextAggregator.BuildSystemPrompt`.

## Current Runtime Flow

```text
Skill upload/create
  -> stores full skill content in skills.content

Agent create/attach
  -> stores relationship in agent_skills

Workflow execute
  -> WorkflowRepository.GetByID
  -> AgentRepository.GetByID for supervisor and workers
  -> loads all attached skills for each agent
  -> ContextAggregator.BuildSystemPrompt(agent)
  -> appends every attached skill's full content
  -> LLM provider receives system prompt + user/task message
```

## Direct Answer To The User Question

If an agent has multiple skills attached, the current implementation sends all of those skills' full content to the model whenever that agent executes.

It does not currently fetch only one relevant skill based on the user query or intent.

It also does not chunk skills, summarize skills, retrieve skill excerpts, or call a retrieval tool to decide what to include.

## Practical Implications

### Advantages

- Simple and predictable implementation.
- The agent always has all attached domain knowledge available.
- No retrieval miss risk, because no attached skill is excluded.

### Risks

- Large attached skills can consume a lot of context window.
- Multiple large skills may increase LLM cost and latency.
- Irrelevant skill content can distract the model.
- There is no protection against exceeding model context limits except whatever behavior the downstream provider enforces.
- Skill ordering depends on database query order from the join query, which currently has no explicit `ORDER BY`.

## Implementation Gaps If Intent-Based Skill Use Is Desired Later

To support "only send relevant skills," the project would need a new retrieval or selection layer before `BuildSystemPrompt`, such as:

1. Skill chunking and embeddings.
2. A vector or full-text index over skill content.
3. Query/routing-condition based skill retrieval.
4. A prompt-building policy that includes only top relevant chunks or skill summaries.
5. Tests proving irrelevant attached skills are excluded and relevant skills are included.

## Conclusion

The current system uses attached skills as static prompt context, not as dynamically retrieved tools or query-scoped knowledge. Attached skill content is eagerly loaded from Postgres and fully appended to the executing agent's system prompt.