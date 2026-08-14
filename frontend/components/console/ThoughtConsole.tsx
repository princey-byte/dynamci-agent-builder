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
    <div className="bg-background border border-border rounded-xl overflow-hidden shadow-2xl flex flex-col h-[550px]">
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
            Real-Time Agent Thought & Execution Console
          </span>
        </div>
        <SSEStatusPill status={status} />
      </div>

      {/* Stream Area */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4 font-mono text-xs text-foreground">
        {logs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center font-mono text-muted-foreground">
            <Terminal className="mb-2 size-8 text-muted-foreground/40" />
            <p>Awaiting workflow execution request...</p>
            <p className="text-[11px] text-muted-foreground/80">
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
