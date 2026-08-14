'use client';

import React, { useState } from 'react';
import { SSELogEvent } from '../../lib/types';
import { Brain, ArrowRight, Wrench, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface EventRendererProps {
  log: SSELogEvent;
}

export function EventRenderer({ log }: EventRendererProps) {
  const [expanded, setExpanded] = useState(true);
  const payload = log.payload;

  switch (log.event) {
    case 'AGENT_THOUGHT': {
      const thoughtText = String(payload.thought ?? JSON.stringify(payload));
      return (
        <div className="my-2 rounded-r-lg border-l-2 border-agent-thought bg-card p-3 font-mono text-xs">
          <div className="mb-1 flex items-center gap-2 font-semibold text-agent-thought">
            <Brain className="size-3.5 animate-pulse" />
            <span>[{log.agent_name || 'Agent Thought'}] Step #{log.step}</span>
          </div>
          <p className="text-foreground whitespace-pre-wrap leading-relaxed">{thoughtText}</p>
        </div>
      );
    }

    case 'AGENT_DELEGATION': {
      const fromAgent = String(payload.from_agent ?? 'Supervisor');
      const toAgent = String(payload.to_agent ?? 'Worker');
      const taskDesc = String(payload.task_description ?? '');
      return (
        <div className="my-2 rounded-lg border border-agent-delegation/30 bg-agent-delegation/10 p-3 font-mono text-xs">
          <div className="mb-1 flex items-center gap-2 font-semibold text-agent-delegation">
            <span>{fromAgent}</span>
            <ArrowRight className="size-3.5" />
            <span>{toAgent}</span>
          </div>
          {taskDesc && <p className="text-foreground mt-1">{taskDesc}</p>}
        </div>
      );
    }

    case 'TOOL_CALL': {
      const toolName = String(payload.tool_name ?? 'Tool Call');
      const args = payload.arguments ?? JSON.stringify(payload.args ?? {});
      return (
        <div className="my-2 overflow-hidden rounded-lg border border-agent-tool/40 bg-background font-mono text-xs">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between bg-agent-tool/10 p-2.5 font-semibold text-agent-tool"
          >
            <div className="flex items-center gap-2">
              <Wrench className="size-3.5" />
              <span>TOOL_CALL: {toolName}</span>
            </div>
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
          {expanded && (
            <div className="bg-background p-3 text-agent-tool">
              <pre className="overflow-x-auto whitespace-pre-wrap text-[11px]">
                {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    }

    case 'TOOL_RESULT': {
      const toolName = String(payload.tool_name ?? 'Tool Result');
      const result = payload.result ?? payload;
      return (
        <div className="my-2 rounded-lg border bg-background p-3 font-mono text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-muted-foreground">
            <span className="size-2 rounded-full bg-agent-tool"></span>
            <span>TOOL_RESULT: {toolName}</span>
          </div>
          <div className="overflow-x-auto rounded border border-border/80 bg-background p-2.5 text-[11px] text-agent-success">
            <pre className="whitespace-pre-wrap">{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      );
    }

    case 'WORKFLOW_COMPLETE': {
      const output = String(payload.final_output ?? 'Workflow Execution Completed.');
      return (
        <div className="my-4 rounded-xl border border-agent-success/40 bg-agent-success/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-agent-success">
            <CheckCircle2 className="size-4" />
            <span>Workflow Completed Successfully</span>
          </div>
          <div className="whitespace-pre-wrap rounded-lg border bg-background p-4 font-sans text-xs leading-relaxed text-foreground">
            {output}
          </div>
        </div>
      );
    }

    case 'ERROR': {
      const errorMsg = String(payload.error ?? 'An error occurred during workflow execution.');
      return (
        <div className="my-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 font-mono text-xs">
          <div className="mb-1 flex items-center gap-2 text-sm font-bold text-destructive">
            <AlertCircle className="size-4" />
            <span>Execution Error</span>
          </div>
          <p className="text-foreground">{errorMsg}</p>
        </div>
      );
    }

    default:
      return (
        <div className="p-2 text-xs font-mono text-muted-foreground bg-card/40 rounded my-1">
          <pre>{JSON.stringify(log, null, 2)}</pre>
        </div>
      );
  }
}
