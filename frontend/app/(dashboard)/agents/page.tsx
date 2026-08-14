'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Agent } from '../../../lib/types';
import { AgentCard } from '../../../components/agents/AgentCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
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
    let ignore = false;

    api.getAgents()
      .then((data) => {
        if (!ignore) setAgents(data || []);
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
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
      <div className="flex items-center justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Agents Library</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure custom personas, multi-LLM providers, and attached skills.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={loadAgents}
            aria-label="Refresh agents"
          >
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
          </Button>
          <Button render={<Link href="/agents/create" />}>
            <Plus />
            <span>Create Agent</span>
          </Button>
        </div>
      </div>

      {/* Grid or Empty state */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
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
