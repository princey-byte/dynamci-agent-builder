'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { ExecutionSession, SSELogEvent, Workflow } from '../../../../lib/types';
import { ThoughtConsole } from '../../../../components/console/ThoughtConsole';
import { LiveGraphTrace } from '../../../../components/console/LiveGraphTrace';
import { SessionReplayScrubber } from '../../../../components/sessions/SessionReplayScrubber';
import { ArrowLeft } from 'lucide-react';

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [session, setSession] = useState<ExecutionSession | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  useEffect(() => {
    api.getSession(resolvedParams.id)
      .then((sess) => {
        setSession(sess);
        if (sess?.logs && sess.logs.length > 0) {
          setCurrentStepIndex(sess.logs.length - 1);
        }
        if (sess?.workflow_id) {
          api.getWorkflow(sess.workflow_id).then(setWorkflow).catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resolvedParams.id]);

  const allEvents: SSELogEvent[] = useMemo(() => {
    if (!session?.logs) return [];
    return session.logs.map((l) => ({
      event: l.log_type as SSELogEvent['event'],
      session_id: session.id,
      agent_name: l.agent_name,
      agent_id: l.agent_id,
      step: l.step_number,
      payload: typeof l.content === 'string' ? JSON.parse(l.content) : (l.content as Record<string, unknown>),
    }));
  }, [session]);

  const visibleEvents = useMemo(() => {
    return allEvents.slice(0, currentStepIndex + 1);
  }, [allEvents, currentStepIndex]);

  const currentEvent = allEvents[currentStepIndex];
  const activeAgentId = currentEvent?.agent_id || currentEvent?.payload?.node_id as string || null;

  if (loading) {
    return <div className="p-8 text-muted-foreground font-mono text-xs">Loading session trace...</div>;
  }

  if (!session) {
    return <div className="p-8 text-destructive font-mono text-xs">Session log not found.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-muted-foreground hover:text-foreground text-xs font-semibold uppercase tracking-wider transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sessions</span>
        </button>
        <span className="font-mono text-xs text-muted-foreground">Session: {session.id.slice(0, 8)}...</span>
      </div>

      {/* Header Info */}
      <div className="bg-card border border-border-subtle rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-foreground">
            Workflow: {session.workflow?.name || workflow?.name || 'Execution Trace'}
          </h1>
          <span className="font-mono text-xs text-muted-foreground">
            Started: {new Date(session.started_at).toLocaleString()}
          </span>
        </div>
        <div className="bg-background p-3 rounded-xl border border-border-subtle text-xs font-mono text-foreground">
          <span className="text-muted-foreground font-semibold mr-2">Query:</span>
          {session.input_query}
        </div>
      </div>

      {/* Step Replay Scrubber */}
      <SessionReplayScrubber
        currentStepIndex={currentStepIndex}
        totalSteps={allEvents.length}
        onStepChange={setCurrentStepIndex}
      />

      {/* Split Graph & Console Replay */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[560px]">
        <div className="lg:col-span-6 h-full">
          {workflow ? (
            <LiveGraphTrace
              workflow={workflow}
              activeNodeId={activeAgentId}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-border-subtle bg-background-canvas text-xs text-muted-foreground">
              Loading topology for replay...
            </div>
          )}
        </div>

        <div className="lg:col-span-6 h-full">
          <ThoughtConsole
            logs={visibleEvents}
            status={session.status === 'COMPLETED' ? 'completed' : session.status === 'ERROR' ? 'error' : 'idle'}
          />
        </div>
      </div>
    </div>
  );
}
