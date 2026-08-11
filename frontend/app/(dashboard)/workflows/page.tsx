'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Workflow } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/ui/Badge';
import { GitFork, Plus, Play, Trash2, Bot, Layers } from 'lucide-react';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const data = await api.getWorkflows();
      setWorkflows(data || []);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this workflow graph?')) {
      await api.deleteWorkflow(id);
      loadWorkflows();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Agent Workflows</h1>
          <p className="text-xs text-slate-400 mt-1">
            Hierarchical multi-agent team topologies. Connect Supervisor to specialized Worker agents.
          </p>
        </div>
        <Link
          href="/workflows/create"
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-md shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Build Workflow</span>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 bg-[#111726] border border-[#1e293b] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <EmptyState
          icon={GitFork}
          title="No Workflows Defined"
          description="Build multi-agent hierarchical teams with a supervisor agent routing tasks to worker agents."
          actionHref="/workflows/create"
          actionLabel="Build Workflow Topology"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                      <GitFork className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-100">{wf.name}</h3>
                      <span className="text-xs text-slate-400">
                        {wf.nodes?.length || 0} Connected Worker Nodes
                      </span>
                    </div>
                  </div>
                </div>

                {wf.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                    {wf.description}
                  </p>
                )}

                {/* Supervisor badge */}
                {wf.supervisor_agent && (
                  <div className="flex items-center space-x-2 bg-[#090d16] p-2.5 rounded-lg border border-[#1e293b] text-xs">
                    <Bot className="w-4 h-4 text-indigo-400" />
                    <span className="text-slate-400">Supervisor:</span>
                    <span className="font-semibold text-slate-200">{wf.supervisor_agent.name}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-5 pt-3 border-t border-[#1e293b]">
                <button
                  onClick={() => handleDelete(wf.id)}
                  className="text-slate-400 hover:text-red-400 p-1.5 rounded"
                  title="Delete Workflow"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Link
                  href={`/workflows/${wf.id}/execute`}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-emerald-600/20 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Workflow</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
