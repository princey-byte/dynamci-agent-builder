'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { Workflow } from '../../../../../lib/types';
import { useWorkflowExecution } from '../../../../../hooks/useWorkflowExecution';
import { ThoughtConsole } from '../../../../../components/console/ThoughtConsole';
import { ArrowLeft, Play, Bot, Sparkles } from 'lucide-react';

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
          className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workflows</span>
        </button>
        <div className="flex items-center space-x-2 font-mono text-xs text-slate-400">
          <span>Workflow ID:</span>
          <span className="text-slate-200">{resolvedParams.id.slice(0, 8)}...</span>
        </div>
      </div>

      {/* Header Info */}
      {workflow && (
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold text-slate-100">{workflow.name}</h1>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">{workflow.description}</p>
          </div>
          {workflow.supervisor_agent && (
            <div className="text-right font-mono text-xs text-slate-400">
              <div>Supervisor: <span className="text-indigo-300 font-semibold">{workflow.supervisor_agent.name}</span></div>
              <div className="text-[11px] text-slate-500">{workflow.nodes?.length || 0} Workers Connected</div>
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
          className="flex-1 bg-[#111726] border border-[#1e293b] focus:border-indigo-500 rounded-xl px-5 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={status === 'running' || !query.trim()}
          className="flex items-center space-x-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
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
