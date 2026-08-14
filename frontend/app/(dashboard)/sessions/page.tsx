'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { ExecutionSession } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { Activity, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<ExecutionSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    api.getSessions()
      .then((data) => {
        if (!ignore) setSessions(data || []);
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Execution Sessions Audit History</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Persisted step-by-step trace logs of past supervisor and worker execution sessions.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No Sessions Recorded Yet"
          description="Execute an agent workflow to record execution logs and full trace history."
          actionHref="/workflows"
          actionLabel="View Workflows"
        />
      ) : (
        <Card className="overflow-hidden p-0 shadow-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4">Session ID</th>
                <th className="p-4">Workflow Name</th>
                <th className="p-4">Input Query</th>
                <th className="p-4">Status</th>
                <th className="p-4">Started At</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-xs">
              {sessions.map((session) => (
                <tr key={session.id} className="transition-colors hover:bg-accent/50">
                  <td className="p-4 font-semibold text-primary">{session.id.slice(0, 8)}...</td>
                  <td className="p-4 text-foreground">{session.workflow?.name || 'Workflow'}</td>
                  <td className="line-clamp-1 max-w-xs p-4 font-sans text-foreground">{session.input_query}</td>
                  <td className="p-4">
                    {session.status === 'COMPLETED' ? (
                      <span className="inline-flex items-center gap-1 font-bold text-agent-success">
                        <CheckCircle className="size-3.5" />
                        <span>COMPLETED</span>
                      </span>
                    ) : session.status === 'ERROR' ? (
                      <span className="inline-flex items-center gap-1 font-bold text-destructive">
                        <AlertCircle className="size-3.5" />
                        <span>ERROR</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-agent-tool">
                        <Clock className="size-3.5 animate-spin" />
                        <span>RUNNING</span>
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-muted-foreground">{new Date(session.started_at).toLocaleString()}</td>
                  <td className="p-4 text-right">
                    <Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/sessions/${session.id}`} />}>
                      View Log Replay
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
