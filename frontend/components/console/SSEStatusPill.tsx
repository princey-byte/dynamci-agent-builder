import React from 'react';

interface SSEStatusPillProps {
  status: 'idle' | 'running' | 'completed' | 'error';
}

export function SSEStatusPill({ status }: SSEStatusPillProps) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-950/80 border border-emerald-800 text-emerald-300">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>Live Stream Connected</span>
      </span>
    );
  }

  if (status === 'completed') {
    return (
      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono bg-indigo-950/80 border border-indigo-800 text-indigo-300">
        <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
        <span>Execution Completed</span>
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono bg-red-950/80 border border-red-800 text-red-300">
        <span className="w-2 h-2 rounded-full bg-red-500"></span>
        <span>Connection Terminated</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono bg-slate-800 border border-slate-700 text-slate-400">
      <span className="w-2 h-2 rounded-full bg-slate-500"></span>
      <span>Idle</span>
    </span>
  );
}
