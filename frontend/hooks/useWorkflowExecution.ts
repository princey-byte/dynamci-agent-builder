import { useState, useCallback } from 'react';
import { SSELogEvent } from '../lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export function useWorkflowExecution(workflowId: string) {
  const [logs, setLogs] = useState<SSELogEvent[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [finalOutput, setFinalOutput] = useState<string | null>(null);

  const startExecution = useCallback((query: string) => {
    setLogs([]);
    setFinalOutput(null);
    setStatus('running');

    const encodedQuery = encodeURIComponent(query);
    const url = `${API_BASE}/workflows/${workflowId}/execute/stream?query=${encodedQuery}`;
    const eventSource = new EventSource(url);

    const handleEvent = (e: MessageEvent) => {
      try {
        const parsed: SSELogEvent = JSON.parse(e.data);
        setLogs((prev) => [...prev, parsed]);

        if (parsed.event === 'WORKFLOW_COMPLETE') {
          setStatus('completed');
          if (parsed.payload.final_output) {
            setFinalOutput(String(parsed.payload.final_output));
          }
          eventSource.close();
        } else if (parsed.event === 'ERROR') {
          setStatus('error');
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing SSE event data:', err);
      }
    };

    eventSource.onmessage = handleEvent;

    // Listen for custom event types sent over SSE
    ['AGENT_THOUGHT', 'AGENT_DELEGATION', 'TOOL_CALL', 'TOOL_RESULT', 'WORKFLOW_COMPLETE', 'ERROR'].forEach((eventType) => {
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
  }, [workflowId]);

  return { logs, status, finalOutput, startExecution };
}
