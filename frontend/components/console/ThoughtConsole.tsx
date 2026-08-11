'use client';

import React, { useEffect, useRef } from 'react';
import { SSELogEvent } from '../../lib/types';
import { EventRenderer } from './EventRenderer';
import { SSEStatusPill } from './SSEStatusPill';
import { Terminal } from 'lucide-react';

interface ThoughtConsoleProps {
  logs: SSELogEvent[];
  status: 'idle' | 'running' | 'completed' | 'error';
}

export function ThoughtConsole({ logs, status }: ThoughtConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-[#090d16] border border-[#1e293b] rounded-xl overflow-hidden shadow-2xl flex flex-col h-[550px]">
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#111726] border-b border-[#1e293b]">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span className="font-mono text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Real-Time Agent Thought & Execution Console
          </span>
        </div>
        <SSEStatusPill status={status} />
      </div>

      {/* Stream Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs text-slate-300 scrollbar-thin scrollbar-thumb-slate-800">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-center p-8 space-y-2">
            <Terminal className="w-8 h-8 text-slate-700 mb-2" />
            <p>Awaiting workflow execution request...</p>
            <p className="text-[11px] text-slate-600">
              Live step-by-step thoughts, delegations, and tool calls will stream here in real-time.
            </p>
          </div>
        ) : (
          logs.map((log, index) => <EventRenderer key={`${log.session_id}-${log.step}-${index}`} log={log} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
