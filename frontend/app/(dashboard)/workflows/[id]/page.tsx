'use client';

import { useState, useEffect, use } from 'react';
import { api } from '../../../../lib/api';
import { Agent, Workflow, SSELogEvent, ExecutionSession } from '../../../../lib/types';
import { WorkflowBuilder } from '../../../../components/workflows/WorkflowBuilder';

export default function WorkflowStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<ExecutionSession[]>([]);
  const [initialLogs, setInitialLogs] = useState<SSELogEvent[]>([]);
  const [initialOutput, setInitialOutput] = useState<string | null>(null);
  const [initialQuery, setInitialQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudioData() {
      try {
        const [wfData, agentsData, sessionsData] = await Promise.all([
          api.getWorkflow(resolvedParams.id),
          api.getAgents(),
          api.getWorkflowSessions(resolvedParams.id).catch(() => []),
        ]);

        setWorkflow(wfData);
        setAgents(agentsData || []);
        setSessions(sessionsData || []);

        // Preload the latest session if available
        if (sessionsData && sessionsData.length > 0) {
          const latest = sessionsData[0];
          try {
            const fullSession = await api.getSession(latest.id);
            if (fullSession) {
              setInitialQuery(fullSession.input_query || '');
              setInitialOutput(fullSession.final_output || null);
              if (fullSession.logs && fullSession.logs.length > 0) {
                const mappedLogs: SSELogEvent[] = fullSession.logs.map((l) => ({
                  event: l.log_type as SSELogEvent['event'],
                  session_id: fullSession.id,
                  agent_name: l.agent_name,
                  agent_id: l.agent_id,
                  step: l.step_number,
                  payload: typeof l.content === 'string' ? JSON.parse(l.content) : (l.content as Record<string, unknown>),
                }));
                setInitialLogs(mappedLogs);
              }
            }
          } catch (e) {
            console.error('Failed to load session logs:', e);
          }
        }
      } catch (err) {
        console.error('Failed to load workflow studio:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStudioData();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs font-mono text-muted-foreground">
        Loading workflow studio & agent topology...
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs font-mono text-destructive">
        Workflow not found.
      </div>
    );
  }

  return (
    <WorkflowBuilder
      availableAgents={agents}
      initialWorkflow={workflow}
      initialSessions={sessions}
      initialLogs={initialLogs}
      initialOutput={initialOutput}
      initialQuery={initialQuery}
    />
  );
}
