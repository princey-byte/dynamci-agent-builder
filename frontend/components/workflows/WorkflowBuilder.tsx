'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Agent } from '../../lib/types';
import { api } from '../../lib/api';
import { WorkflowCanvas } from './builder/WorkflowCanvas';
import { WorkflowTopBar } from './builder/WorkflowTopBar';
import { AgentPaletteSidebar } from './builder/AgentPaletteSidebar';
import { EdgeConditionDrawer } from './builder/EdgeConditionDrawer';
import { QuickAttachModal } from './builder/QuickAttachModal';
import { SelectedWorker } from './builder/types';
import { useWorkflowGraph } from './builder/useWorkflowGraph';
import { Edge } from '@xyflow/react';
import { WorkflowEdgeData } from './builder/types';

interface WorkflowBuilderProps {
  availableAgents: Agent[];
}

export function WorkflowBuilder({ availableAgents }: WorkflowBuilderProps) {
  const router = useRouter();
  const [workflowName, setWorkflowName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSupervisorID, setSelectedSupervisorID] = useState<string>('');
  const [selectedWorkers, setSelectedWorkers] = useState<SelectedWorker[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick attach child state
  const [quickAttachParentId, setQuickAttachParentId] = useState<string | null>(null);

  const addWorkerNode = (agentId: string, parentSourceId?: string) => {
    if (!agentId) return;

    setSelectedWorkers((previous) => {
      if (previous.some((worker) => worker.agent_id === agentId)) {
        return previous;
      }
      return [
        ...previous,
        {
          agent_id: agentId,
          execution_order: previous.length + 1,
          routing_condition: 'Always execute subtask',
        },
      ];
    });

    // If added from a parent node, also create connection edge
    if (parentSourceId) {
      setTimeout(() => {
        addEdgeDirect(parentSourceId, `worker-node-${agentId}`);
      }, 50);
    }
  };

  const removeWorkerNode = (agentId: string) => {
    setSelectedWorkers((previous) =>
      previous
        .filter((w) => w.agent_id !== agentId)
        .map((worker, itemIndex) => ({ ...worker, execution_order: itemIndex + 1 }))
    );
  };

  const {
    supervisors,
    workers,
    availableWorkerOptions,
    selectedWorkerIDs,
    nodes,
    edges,
    selectedEdgeId,
    selectedEdgeData,
    setSelectedEdgeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    updateEdgeCondition,
    deleteEdge,
    autoLayout,
    addEdgeDirect,
  } = useWorkflowGraph({
    availableAgents,
    selectedSupervisorID,
    selectedWorkers,
    onAddWorker: addWorkerNode,
    onRemoveWorker: removeWorkerNode,
    onOpenQuickAttach: (parentId) => setQuickAttachParentId(parentId),
  });

  const handleEdgeClick = (_event: React.MouseEvent, edge: Edge<WorkflowEdgeData>) => {
    setSelectedEdgeId(edge.id);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workflowName.trim()) {
      setError('Please provide a workflow name.');
      return;
    }
    const selectedSupervisor = supervisors.find((supervisor) => supervisor.id === selectedSupervisorID);
    if (!selectedSupervisor) {
      setError('Please select an agent with role_type supervisor as the root coordinator.');
      return;
    }
    const invalidWorker = selectedWorkers.find((worker) => !workers.some((agent) => agent.id === worker.agent_id));
    if (invalidWorker) {
      setError('Only agents with role_type worker can be connected as worker nodes.');
      return;
    }

    setSaving(true);
    setError(null);

    // Format edges for backend API
    const formattedEdges = edges.map((edge) => {
      const sourceClean = edge.source.replace('worker-node-', '').replace('sup-node', selectedSupervisorID);
      const targetClean = edge.target.replace('worker-node-', '');
      return {
        source_node_id: sourceClean,
        target_node_id: targetClean,
        condition_type: edge.data?.condition_type || 'always',
        condition_expression: edge.data?.condition_expression || '',
        label: edge.data?.label || '',
      };
    });

    try {
      await api.createWorkflow({
        name: workflowName,
        description,
        supervisor_agent_id: selectedSupervisorID,
        nodes: selectedWorkers,
        edges: formattedEdges,
      });
      router.push('/workflows');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-background text-foreground">
      <WorkflowTopBar
        workflowName={workflowName}
        description={description}
        saving={saving}
        canSave={Boolean(selectedSupervisorID && workflowName.trim())}
        onWorkflowNameChange={setWorkflowName}
        onDescriptionChange={setDescription}
        onAutoLayout={autoLayout}
        onSave={handleSave}
      />

      {error && (
        <div className="absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-2.5 text-xs font-semibold text-destructive shadow-2xl backdrop-blur">
          {error}
        </div>
      )}

      <AgentPaletteSidebar
        supervisors={supervisors}
        workers={workers}
        selectedSupervisorId={selectedSupervisorID}
        selectedWorkerIds={selectedWorkerIDs}
        onSelectSupervisor={setSelectedSupervisorID}
        onAddWorker={(agentId) => addWorkerNode(agentId)}
      />

      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={handleEdgeClick}
      />

      <EdgeConditionDrawer
        edgeId={selectedEdgeId}
        edgeData={selectedEdgeData}
        isOpen={Boolean(selectedEdgeId)}
        onClose={() => setSelectedEdgeId(null)}
        onSave={updateEdgeCondition}
        onDelete={deleteEdge}
      />

      <QuickAttachModal
        isOpen={Boolean(quickAttachParentId)}
        parentSourceId={quickAttachParentId}
        availableWorkers={availableWorkerOptions}
        onClose={() => setQuickAttachParentId(null)}
        onSelectWorker={(agentId, parentId) => addWorkerNode(agentId, parentId)}
      />
    </div>
  );
}
