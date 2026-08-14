import React from 'react';

interface SSEStatusPillProps {
  status: 'idle' | 'running' | 'completed' | 'error';
}

export function SSEStatusPill({ status }: SSEStatusPillProps) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-agent-success/30 bg-agent-success/10 px-3 py-1 font-mono text-xs text-agent-success">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-agent-success opacity-75"></span>
          <span className="relative inline-flex size-2 rounded-full bg-agent-success"></span>
        </span>
        <span>Live Stream Connected</span>
      </span>
    );
  }

  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
        <span className="size-2 rounded-full bg-primary"></span>
        <span>Execution Completed</span>
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 font-mono text-xs text-destructive">
        <span className="size-2 rounded-full bg-destructive"></span>
        <span>Connection Terminated</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
      <span className="size-2 rounded-full bg-muted-foreground"></span>
      <span>Idle</span>
    </span>
  );
}
