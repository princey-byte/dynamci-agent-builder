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

  const loadSessionData = useCallback(
    (
      loadedLogs: SSELogEvent[],
      output: string | null,
      initialStatus: 'idle' | 'running' | 'completed' | 'error' = 'completed'
    ) => {
      setLogs(loadedLogs);
      setFinalOutput(output);
      setStatus(initialStatus);
      setActiveNodeId(null);
    },
    []
  );

  const startExecution = useCallback(
    (query: string, overrideWorkflowId?: string, continueSessionId?: string | null) => {
      const targetId = overrideWorkflowId || workflowId;
      if (!targetId) {
        console.error('Cannot start execution: No workflow ID provided');
        setStatus('error');
        return;
      }

      // If continuing an existing session, preserve previous logs; otherwise reset
      if (!continueSessionId) {
        setLogs([]);
        setFinalOutput(null);
        setNodeStatuses({});
        setEdgeStatuses({});
      }
      setStatus('running');
      setActiveNodeId(null);

      const encodedQuery = encodeURIComponent(query);
      let url = `${API_BASE}/workflows/${targetId}/execute/stream?query=${encodedQuery}`;
      if (continueSessionId) {
        url += `&session_id=${encodeURIComponent(continueSessionId)}`;
      }

      const eventSource = new EventSource(url);

      const handleEvent = (e: MessageEvent) => {
        try {
          const parsed: SSELogEvent = JSON.parse(e.data);
          setLogs((prev) => [...prev, parsed]);

          const payload = parsed.payload as Record<string, unknown>;
          const targetNodeOrAgentId = String(
            payload?.agent_id ||
            payload?.node_id ||
            parsed.agent_id ||
            payload?.agent_name ||
            parsed.agent_name ||
            ''
          );

          // Track active executing node
          if (targetNodeOrAgentId && parsed.event !== 'WORKFLOW_COMPLETE' && parsed.event !== 'ERROR') {
            setActiveNodeId(targetNodeOrAgentId);
            setNodeStatuses((prev) => {
              const updated: Record<string, NodeExecutionStatus> = { ...prev };
              // Mark previously running nodes as completed
              Object.keys(updated).forEach((k) => {
                if (updated[k] === 'running') {
                  updated[k] = 'completed';
                }
              });
              updated[targetNodeOrAgentId] = 'running';
              if (payload?.agent_id) updated[String(payload.agent_id)] = 'running';
              if (parsed.agent_name) updated[String(parsed.agent_name)] = 'running';
              return updated;
            });
          }

          // Track condition evaluation & branch skipping
          if (parsed.event === 'CONDITION_EVALUATED' && payload?.edge_id) {
            const edgeId = String(payload.edge_id);
            setEdgeStatuses((prev) => ({ ...prev, [edgeId]: 'traversed' }));
          } else if (parsed.event === 'BRANCH_SKIPPED') {
            if (payload?.edge_id) {
              const edgeId = String(payload.edge_id);
              setEdgeStatuses((prev) => ({ ...prev, [edgeId]: 'skipped' }));
            }
            if (targetNodeOrAgentId) {
              setNodeStatuses((prev) => ({ ...prev, [targetNodeOrAgentId]: 'skipped' }));
            }
          }

          if (parsed.event === 'WORKFLOW_COMPLETE') {
            setStatus('completed');
            setActiveNodeId(null);
            setNodeStatuses((prev) => {
              const completed: Record<string, NodeExecutionStatus> = {};
              Object.keys(prev).forEach((k) => {
                completed[k] = prev[k] === 'skipped' ? 'skipped' : 'completed';
              });
              return completed;
            });
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
    loadSessionData,
    startExecution,
  };
}
