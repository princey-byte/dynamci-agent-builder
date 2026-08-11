'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { ExecutionSession } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/ui/Badge';
import { Activity, Clock, CheckCircle, AlertCircle, Play } from 'lucide-react';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<ExecutionSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.getSessions();
      setSessions(data || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Execution Sessions Audit History</h1>
          <p className="text-xs text-slate-400 mt-1">
            Persisted step-by-step trace logs of past supervisor and worker execution sessions.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[#111726] border border-[#1e293b] rounded-xl animate-pulse" />
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
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1e293b] bg-[#090d16] text-xs font-mono uppercase tracking-wider text-slate-400">
                <th className="p-4">Session ID</th>
                <th className="p-4">Workflow Name</th>
                <th className="p-4">Input Query</th>
                <th className="p-4">Status</th>
                <th className="p-4">Started At</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b] text-xs font-mono">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-[#1a2236]/40 transition-colors">
                  <td className="p-4 text-indigo-400 font-semibold">{session.id.slice(0, 8)}...</td>
                  <td className="p-4 text-slate-200">{session.workflow?.name || 'Workflow'}</td>
                  <td className="p-4 text-slate-300 font-sans line-clamp-1 max-w-xs">{session.input_query}</td>
                  <td className="p-4">
                    {session.status === 'COMPLETED' ? (
                      <span className="inline-flex items-center space-x-1 text-emerald-400 font-bold">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>COMPLETED</span>
                      </span>
                    ) : session.status === 'ERROR' ? (
                      <span className="inline-flex items-center space-x-1 text-red-400 font-bold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>ERROR</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-amber-400 font-bold">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>RUNNING</span>
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-slate-400">{new Date(session.started_at).toLocaleString()}</td>
                  <td className="p-4 text-right">
                    <Link
                      href={`/sessions/${session.id}`}
                      className="px-3 py-1.5 bg-[#090d16] hover:bg-[#1a2236] border border-[#1e293b] text-slate-200 text-xs rounded-md transition-colors"
                    >
                      View Log Replay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
