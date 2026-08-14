'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Workflow } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { GitFork, Plus, Play, Trash2, Bot } from 'lucide-react';

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
    let ignore = false;

    api.getWorkflows()
      .then((data) => {
        if (!ignore) setWorkflows(data || []);
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
    if (confirm('Delete this workflow graph?')) {
      await api.deleteWorkflow(id);
      loadWorkflows();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agent Workflows</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Hierarchical multi-agent team topologies. Connect Supervisor to specialized Worker agents.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/workflows/create" />}>
          <Plus />
          <span>Build Workflow</span>
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
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
            <Card
              key={wf.id}
              className="flex h-full flex-col justify-between transition-colors hover:ring-foreground/20"
            >
              <div>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-primary">
                        <GitFork className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{wf.name}</CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {wf.nodes?.length || 0} Connected Worker Nodes
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">

                {wf.description && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {wf.description}
                  </p>
                )}

                {/* Supervisor badge */}
                {wf.supervisor_agent && (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2.5 text-xs">
                    <Bot className="size-4 text-primary" />
                    <span className="text-muted-foreground">Supervisor:</span>
                    <span className="font-semibold text-foreground">{wf.supervisor_agent.name}</span>
                  </div>
                )}
                </CardContent>
              </div>

              <CardFooter className="justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(wf.id)}
                  aria-label="Delete workflow"
                >
                  <Trash2 />
                </Button>
                <Button nativeButton={false} size="sm" render={<Link href={`/workflows/${wf.id}/execute`} />}>
                  <Play className="fill-current" />
                  <span>Execute Workflow</span>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
