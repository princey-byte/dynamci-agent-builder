'use client';

import { useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import { SelectedWorker, CustomWorkflowEdge } from './types';
import { Workflow } from '../../../lib/types';

interface SaveWorkflowParams {
  workflowId: string | null;
  workflowName: string;
  description: string;
  supervisorId: string;
  workers: SelectedWorker[];
  edges: CustomWorkflowEdge[];
}

export function useWorkflowStudio(initialWorkflowId?: string | null) {
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(initialWorkflowId || null);
  const [isSaving, setIsSaving] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);

  const saveWorkflowToDB = useCallback(
    async ({
      workflowId,
      workflowName,
      description,
      supervisorId,
      workers,
      edges,
    }: SaveWorkflowParams): Promise<Workflow> => {
      setIsSaving(true);
      setStudioError(null);

      const targetId = workflowId || activeWorkflowId;

      const formattedEdges = edges.map((e) => ({
        source_node_id: e.source.replace('worker-node-', '').replace('sup-node', supervisorId),
        target_node_id: e.target.replace('worker-node-', ''),
        condition_type: e.condition_type || 'always',
        condition_expression: e.condition_expression || '',
        label: e.label || '',
      }));

      const payload = {
        name: workflowName.trim() || 'Untitled Workflow',
        description,
        supervisor_agent_id: supervisorId,
        nodes: workers,
        edges: formattedEdges,
      };

      try {
        let saved: Workflow;
        if (targetId) {
          saved = await api.updateWorkflow(targetId, payload);
        } else {
          saved = await api.createWorkflow(payload);
          setActiveWorkflowId(saved.id);
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', `/workflows/${saved.id}/edit`);
          }
        }
        return saved;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save workflow';
        setStudioError(msg);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [activeWorkflowId]
  );

  return {
    activeWorkflowId,
    setActiveWorkflowId,
    isSaving,
    studioError,
    setStudioError,
    saveWorkflowToDB,
  };
}
