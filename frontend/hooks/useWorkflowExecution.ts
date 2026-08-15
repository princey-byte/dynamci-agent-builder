'use client';

import { useState, useCallback } from 'react';
import { SSELogEvent, NodeExecutionStatus, EdgeExecutionStatus } from '../lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export function useWorkflowExecution(
  workflowId: string,
  initialLogs: SSELogEvent[] = [],
  initialOutput: string | null = null
) {
  const [logs, setLogs] = useState<SSELogEvent[]>(initialLogs);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>(
    initialOutput ? 'completed' : 'idle'
  );
  const [finalOutput, setFinalOutput] = useState<string | null>(initialOutput);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeExecutionStatus>>({});
  const [edgeStatuses, setEdgeStatuses] = useState<Record<string, EdgeExecutionStatus>>({});

  const clearLogs = useCallback(() => {
    setLogs([]);
    setFinalOutput(null);
    setStatus('idle');
    setNodeStatuses({});
    setEdgeStatuses({});
    setActiveNodeId(null);
  }, []);

  const startExecution = useCallback(
    (query: string, overrideWorkflowId?: string) => {
      const targetId = overrideWorkflowId || workflowId;
      if (!targetId) {
        console.error('Cannot start execution: No workflow ID provided');
        setStatus('error');
        return;
      }

      setLogs([]);
      setFinalOutput(null);
      setStatus('running');
      setNodeStatuses({});
      setEdgeStatuses({});
      setActiveNodeId(null);

      const encodedQuery = encodeURIComponent(query);
      const url = `${API_BASE}/workflows/${targetId}/execute/stream?query=${encodedQuery}`;
      const eventSource = new EventSource(url);

      const handleEvent = (e: MessageEvent) => {
        try {
          const parsed: SSELogEvent = JSON.parse(e.data);
          setLogs((prev) => [...prev, parsed]);

          const payload = parsed.payload as Record<string, unknown>;

          // Track active executing node
          if (payload?.node_id || payload?.agent_id || parsed.agent_name) {
            const targetNodeOrAgentId = String(payload?.node_id || payload?.agent_id || '');
            if (targetNodeOrAgentId) {
              setActiveNodeId(targetNodeOrAgentId);
              setNodeStatuses((prev) => ({ ...prev, [targetNodeOrAgentId]: 'running' }));
            }
          }

          // Track condition evaluation & branch skipping
          if (parsed.event === 'CONDITION_EVALUATED' && payload?.edge_id) {
            const edgeId = String(payload.edge_id);
            setEdgeStatuses((prev) => ({ ...prev, [edgeId]: 'traversed' }));
          } else if (parsed.event === 'BRANCH_SKIPPED' && payload?.edge_id) {
            const edgeId = String(payload.edge_id);
            setEdgeStatuses((prev) => ({ ...prev, [edgeId]: 'skipped' }));
          }

          if (parsed.event === 'WORKFLOW_COMPLETE') {
            setStatus('completed');
            setActiveNodeId(null);
            if (payload?.final_output) {
              setFinalOutput(String(payload.final_output));
            }
            eventSource.close();
          } else if (parsed.event === 'ERROR') {
            setStatus('error');
            setActiveNodeId(null);
            eventSource.close();
          }
        } catch (err) {
          console.error('Error parsing SSE event data:', err);
        }
      };

      eventSource.onmessage = handleEvent;

      [
        'AGENT_THOUGHT',
        'AGENT_DELEGATION',
        'TOOL_CALL',
        'TOOL_RESULT',
        'CONDITION_EVALUATED',
        'BRANCH_SKIPPED',
        'WORKFLOW_COMPLETE',
        'ERROR',
      ].forEach((eventType) => {
        eventSource.addEventListener(eventType, handleEvent);
      });

      eventSource.onerror = (err) => {
        console.error('SSE Connection Error:', err);
        setStatus((prev) => (prev === 'completed' ? 'completed' : 'error'));
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    },
    [workflowId]
  );

  return {
    logs,
    status,
    finalOutput,
    activeNodeId,
    nodeStatuses,
    edgeStatuses,
    clearLogs,
    startExecution,
  };
}
