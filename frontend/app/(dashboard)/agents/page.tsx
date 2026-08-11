'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Agent } from '../../../lib/types';
import { AgentCard } from '../../../components/agents/AgentCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Bot, Plus, RefreshCw } from 'lucide-react';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const data = await api.getAgents();
      setAgents(data || []);
    } catch (err) {
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      await api.deleteAgent(id);
      loadAgents();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">AI Agents Library</h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure custom personas, multi-LLM providers, and attached skills.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadAgents}
            className="p-2 bg-[#111726] border border-[#1e293b] hover:border-slate-700 text-slate-300 rounded-lg transition-colors"
            title="Refresh Agents"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/agents/create"
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-md shadow-indigo-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Agent</span>
          </Link>
        </div>
      </div>

      {/* Grid or Empty state */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-[#111726] border border-[#1e293b] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No Agents Created Yet"
          description="Get started by configuring your first specialized AI agent with a custom persona and skill set."
          actionHref="/agents/create"
          actionLabel="Create Your First Agent"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
