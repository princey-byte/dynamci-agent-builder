'use client';

import React, { useState } from 'react';
import { SSELogEvent } from '../../lib/types';
import { Brain, ArrowRight, Wrench, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface EventRendererProps {
  log: SSELogEvent;
}

export function EventRenderer({ log }: EventRendererProps) {
  const [expanded, setExpanded] = useState(true);

  switch (log.event) {
    case 'AGENT_THOUGHT': {
      const thoughtText = log.payload?.thought || JSON.stringify(log.payload);
      return (
        <div className="border-l-2 border-[#a855f7] bg-[#111726]/60 rounded-r-lg p-3 my-2 text-xs font-mono">
          <div className="flex items-center space-x-2 text-[#a855f7] font-semibold mb-1">
            <Brain className="w-3.5 h-3.5 animate-pulse" />
            <span>[{log.agent_name || 'Agent Thought'}] Step #{log.step}</span>
          </div>
          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{thoughtText}</p>
        </div>
      );
    }

    case 'AGENT_DELEGATION': {
      const fromAgent = log.payload?.from_agent || 'Supervisor';
      const toAgent = log.payload?.to_agent || 'Worker';
      const taskDesc = log.payload?.task_description || '';
      return (
        <div className="bg-[#06b6d4]/10 border border-[#06b6d4]/30 rounded-lg p-3 my-2 text-xs font-mono">
          <div className="flex items-center space-x-2 text-[#06b6d4] font-semibold mb-1">
            <span>{fromAgent}</span>
            <ArrowRight className="w-3.5 h-3.5" />
            <span>{toAgent}</span>
          </div>
          {taskDesc && <p className="text-slate-300 mt-1">{taskDesc}</p>}
        </div>
      );
    }

    case 'TOOL_CALL': {
      const toolName = log.payload?.tool_name || 'Tool Call';
      const args = log.payload?.arguments || JSON.stringify(log.payload?.args || {});
      return (
        <div className="border border-[#f59e0b]/40 rounded-lg bg-[#090d16] my-2 text-xs font-mono overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between p-2.5 bg-[#f59e0b]/10 text-[#f59e0b] font-semibold"
          >
            <div className="flex items-center space-x-2">
              <Wrench className="w-3.5 h-3.5 text-[#f59e0b]" />
              <span>TOOL_CALL: {toolName}</span>
            </div>
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {expanded && (
            <div className="p-3 text-[#f59e0b] bg-[#090d16]">
              <pre className="whitespace-pre-wrap text-[11px] overflow-x-auto">
                {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    }

    case 'TOOL_RESULT': {
      const toolName = log.payload?.tool_name || 'Tool Result';
      const result = log.payload?.result || log.payload;
      return (
        <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 my-2 text-xs font-mono">
          <div className="text-slate-400 font-semibold mb-1 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>TOOL_RESULT: {toolName}</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 text-emerald-400 overflow-x-auto text-[11px]">
            <pre className="whitespace-pre-wrap">{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      );
    }

    case 'WORKFLOW_COMPLETE': {
      const output = log.payload?.final_output || 'Workflow Execution Completed.';
      return (
        <div className="bg-[#10b981]/10 border border-[#10b981]/40 rounded-xl p-4 my-4">
          <div className="flex items-center space-x-2 text-[#10b981] font-bold text-sm mb-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Workflow Completed Successfully</span>
          </div>
          <div className="bg-[#090d16] p-4 rounded-lg border border-[#1e293b] text-slate-200 text-xs font-sans whitespace-pre-wrap leading-relaxed">
            {output}
          </div>
        </div>
      );
    }

    case 'ERROR': {
      const errorMsg = log.payload?.error || 'An error occurred during workflow execution.';
      return (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/40 rounded-xl p-4 my-4 text-xs font-mono">
          <div className="flex items-center space-x-2 text-[#ef4444] font-bold text-sm mb-1">
            <AlertCircle className="w-4 h-4" />
            <span>Execution Error</span>
          </div>
          <p className="text-slate-300">{errorMsg}</p>
        </div>
      );
    }

    default:
      return (
        <div className="p-2 text-xs font-mono text-slate-400 bg-[#111726]/40 rounded my-1">
          <pre>{JSON.stringify(log, null, 2)}</pre>
        </div>
      );
  }
}
