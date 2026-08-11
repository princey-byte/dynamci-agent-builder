'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { ExecutionSession, SSELogEvent } from '../../../../lib/types';
import { ThoughtConsole } from '../../../../components/console/ThoughtConsole';
import { ArrowLeft, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [session, setSession] = useState<ExecutionSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSession(resolvedParams.id)
      .then(setSession)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resolvedParams.id]);

  if (loading) {
    return <div className="p-8 text-slate-400 font-mono text-xs">Loading session trace...</div>;
  }

  if (!session) {
    return <div className="p-8 text-red-400 font-mono text-xs">Session log not found.</div>;
  }

  const sseEvents: SSELogEvent[] = (session.logs || []).map((l) => ({
    event: l.log_type as any,
    session_id: session.id,
    agent_name: l.agent_name,
    step: l.step_number,
    payload: typeof l.content === 'string' ? JSON.parse(l.content) : l.content,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sessions</span>
        </button>
        <span className="font-mono text-xs text-slate-400">Session ID: {session.id}</span>
      </div>

      <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-100">
            Workflow: {session.workflow?.name || 'Execution Session'}
          </h1>
          <span className="font-mono text-xs text-slate-400">
            Started: {new Date(session.started_at).toLocaleString()}
          </span>
        </div>
        <div className="bg-[#090d16] p-3 rounded-lg border border-[#1e293b] text-xs font-mono text-slate-300">
          <span className="text-slate-500 font-semibold mr-2">Query:</span>
          {session.input_query}
        </div>
      </div>

      <ThoughtConsole
        logs={sseEvents}
        status={session.status === 'COMPLETED' ? 'completed' : session.status === 'ERROR' ? 'error' : 'idle'}
      />
    </div>
  );
}
