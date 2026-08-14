'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { Workflow } from '../../../../../lib/types';
import { useWorkflowExecution } from '../../../../../hooks/useWorkflowExecution';
import { ThoughtConsole } from '../../../../../components/console/ThoughtConsole';
import { ArrowLeft, Play, Sparkles } from 'lucide-react';

export default function ExecuteWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [query, setQuery] = useState('');

  const { logs, status, startExecution } = useWorkflowExecution(resolvedParams.id);

  useEffect(() => {
    api.getWorkflow(resolvedParams.id)
      .then(setWorkflow)
      .catch(console.error);
  }, [resolvedParams.id]);

  const handleRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || status === 'running') return;
    startExecution(query);
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workflows</span>
        </button>
        <div className="flex items-center space-x-2 font-mono text-xs text-muted-foreground">
          <span>Workflow ID:</span>
          <span className="text-foreground">{resolvedParams.id.slice(0, 8)}...</span>
        </div>
      </div>

      {/* Header Info */}
      {workflow && (
        <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <Sparkles className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">{workflow.name}</h1>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">{workflow.description}</p>
          </div>
          {workflow.supervisor_agent && (
            <div className="text-right font-mono text-xs text-muted-foreground">
              <div>Supervisor: <span className="text-primary font-semibold">{workflow.supervisor_agent.name}</span></div>
              <div className="text-[11px] text-muted-foreground">{workflow.nodes?.length || 0} Workers Connected</div>
            </div>
          )}
        </div>
      )}

      {/* Input Query Bar */}
      <form onSubmit={handleRun} className="flex gap-3">
        <input
          type="text"
          required
          placeholder="Enter task query or input URL (e.g. Audit security compliance for PR #104)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={status === 'running'}
          className="flex-1 rounded-xl border bg-card px-5 py-3.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === 'running' || !query.trim()}
          className="flex items-center space-x-2 px-6 py-3.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-primary/20 transition-all"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{status === 'running' ? 'Executing Stream...' : 'Start Execution'}</span>
        </button>
      </form>

      {/* Real-time Thought Console */}
      <ThoughtConsole logs={logs} status={status} />
    </div>
  );
}
