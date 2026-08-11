# DESIGN.md — Design System & Component Guidelines

This document establishes the UI/UX design tokens, layout patterns, and component rules for building the **Agentic Workflow Platform** frontend using Next.js 14, Tailwind CSS, and Lucide icons.

---

## 1. Visual Theme & Color Tokens

The UI follows a sleek, developer-focused, high-contrast dark theme optimized for long monitoring sessions and complex data density.

### Design Tokens (Tailwind CSS)

```javascript
// tailwind.config.js extension
module.exports = {
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#090d16', // Deep Slate
          surface: '#111726',    // Card Background
          hover: '#1a2236',      // Interactive Hover
        },
        border: {
          subtle: '#1e293b',
          active: '#334155',
        },
        brand: {
          DEFAULT: '#6366f1', // Indigo Accent
          glow: '#818cf8',
        },
        agent: {
          thought: '#a855f7',    // Purple for Thinking steps
          delegation: '#06b6d4', // Cyan for Delegation
          tool: '#f59e0b',       // Amber for Tool Calls
          success: '#10b981',    // Emerald for Complete
          error: '#ef4444',      // Red for Errors
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    }
  }
}
```

---

## 2. Layout Architecture & Typography Rules

### Typography Hierarchy
- **Page Headings (H1)**: `text-2xl font-bold text-slate-100 tracking-tight`
- **Section Headers (H2)**: `text-lg font-semibold text-slate-200 border-b border-border-subtle pb-2 mb-4`
- **Card Titles (H3)**: `text-base font-medium text-slate-100`
- **Body Text**: `text-sm text-slate-400 leading-relaxed`
- **Console / Code / Logs**: `font-mono text-xs leading-5`

---

## 3. Core Component Guidelines

### 3.1 Agent Card Component (`AgentCard.tsx`)
- Container: Background `#111726`, 1px border `#1e293b`, rounded-xl.
- Badge: Display provider badge (`OpenAI`, `Claude`, `Gemini`) with pill shape.
- Skills Section: Display attached `.md` / `.txt` skill badges with document icons.

### 3.2 Real-Time Thought Console (`ThoughtConsole.tsx`)
- Terminal-style card container with dark background (`#090d16`).
- Live stream renderers:
  - **`AGENT_THOUGHT`**: Rendered with a purple left border (`border-l-2 border-agent-thought`) and pulsating brain icon.
  - **`AGENT_DELEGATION`**: Rendered in cyan box showing `From -> To` directional arrows.
  - **`TOOL_CALL`**: Rendered as an expandable accordion with collapsible JSON viewer (`font-mono text-amber-400`).
  - **`TOOL_RESULT`**: Dark inset code block showing stringified output.

---

## 4. UI Interaction States & Standards

- **SSE Connection Status**: Show live status pill in top right corner:
  - 🟢 `Live Stream Connected` (Pulse animation)
  - 🟡 `Executing Tool Call...`
  - 🔴 `Connection Terminated`
- **Empty States**: Every view (`/agents`, `/workflows`, `/sessions`) must render clear empty state guidance with primary CTA buttons.