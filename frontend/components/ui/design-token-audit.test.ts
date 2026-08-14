import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

const migratedFiles = [
  "app/layout.tsx",
  "app/page.tsx",
  "app/(dashboard)/layout.tsx",
  "app/(dashboard)/agents/page.tsx",
  "app/(dashboard)/agents/create/page.tsx",
  "app/(dashboard)/agents/[id]/edit/page.tsx",
  "app/(dashboard)/workflows/page.tsx",
  "app/(dashboard)/workflows/create/page.tsx",
  "app/(dashboard)/workflows/[id]/execute/page.tsx",
  "app/(dashboard)/skills/page.tsx",
  "app/(dashboard)/skills/upload/page.tsx",
  "app/(dashboard)/mcp-tools/page.tsx",
  "app/(dashboard)/mcp-tools/register/page.tsx",
  "app/(dashboard)/sessions/page.tsx",
  "app/(dashboard)/sessions/[id]/page.tsx",
  "app/mcp/oauth/callback/page.tsx",
  "components/ui/Sidebar.tsx",
  "components/ui/DashboardContent.tsx",
  "components/ui/EmptyState.tsx",
  "components/agents/AgentCard.tsx",
  "components/agents/AgentForm.tsx",
  "components/mcp/MCPServerCard.tsx",
  "components/mcp/MCPServerForm.tsx",
  "components/console/EventRenderer.tsx",
  "components/console/SSEStatusPill.tsx",
  "components/console/ThoughtConsole.tsx",
  "components/workflows/WorkflowBuilder.tsx",
  "components/workflows/builder/WorkflowCanvas.tsx",
  "components/workflows/builder/WorkflowControlsPanel.tsx",
  "components/workflows/builder/WorkflowNodes.tsx",
  "components/workflows/builder/useWorkflowGraph.ts",
]

const forbiddenPatterns = [
  /bg-\[#(?:[0-9a-fA-F]{3,8})\]/,
  /text-\[#(?:[0-9a-fA-F]{3,8})\]/,
  /border-\[#(?:[0-9a-fA-F]{3,8})\]/,
  /#[0-9a-fA-F]{6}/,
  /text-slate-/,
  /bg-slate-/,
  /border-slate-/,
  /text-indigo-/,
  /bg-indigo-/,
  /border-indigo-/,
]

describe("semantic design token migration", () => {
  it.each(migratedFiles)("keeps %s free of raw theme colors", (relativeFile) => {
    const source = fs.readFileSync(path.join(frontendRoot, relativeFile), "utf8")
    const matches = forbiddenPatterns.flatMap((pattern) => source.match(pattern) ?? [])

    expect(matches).toEqual([])
  })
})
