'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Agent } from '../../lib/types';
import { api } from '../../lib/api';
import { Save, ArrowLeft } from 'lucide-react';
import { WorkflowCanvas } from './builder/WorkflowCanvas';
import { WorkflowControlsPanel } from './builder/WorkflowControlsPanel';
import { SelectedWorker } from './builder/types';
import { useWorkflowGraph } from './builder/useWorkflowGraph';

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

  const { supervisors, workers, availableWorkerOptions, nodes, edges, onNodesChange } = useWorkflowGraph({
    availableAgents,
    selectedSupervisorID,
    selectedWorkers,
  });

  const addWorkerNode = (agentId: string) => {
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
  };

  const removeWorkerNode = (index: number) => {
    setSelectedWorkers((previous) =>
      previous
        .filter((_, itemIndex) => itemIndex !== index)
        .map((worker, itemIndex) => ({ ...worker, execution_order: itemIndex + 1 }))
    );
  };

  const updateWorkerRouting = (index: number, value: string) => {
    setSelectedWorkers((previous) =>
      previous.map((worker, itemIndex) => (itemIndex === index ? { ...worker, routing_condition: value } : worker))
    );
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedSupervisor = supervisors.find((supervisor) => supervisor.id === selectedSupervisorID);
    if (!selectedSupervisor) {
      setError('Please select an agent with role_type supervisor. Worker agents cannot supervise workflows.');
      return;
    }
    const invalidWorker = selectedWorkers.find((worker) => !workers.some((agent) => agent.id === worker.agent_id));
    if (invalidWorker) {
      setError('Only agents with role_type worker can be connected as worker nodes.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api.createWorkflow({
        name: workflowName,
        description,
        supervisor_agent_id: selectedSupervisorID,
        nodes: selectedWorkers,
      });
      router.push('/workflows');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="relative h-full min-h-0 overflow-hidden bg-background text-foreground">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-border-subtle bg-background-surface/95 px-5 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Workflows</span>
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">Visual Workflow Builder</h2>
          <button
            type="submit"
            disabled={saving || supervisors.length === 0}
            className="flex items-center space-x-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Workflow'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="absolute left-5 right-5 top-16 z-30 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive shadow-xl">
          {error}
        </div>
      )}

      <WorkflowControlsPanel
        workflowName={workflowName}
        description={description}
        selectedSupervisorID={selectedSupervisorID}
        selectedWorkers={selectedWorkers}
        supervisors={supervisors}
        workers={workers}
        availableWorkerOptions={availableWorkerOptions}
        availableAgents={availableAgents}
        onWorkflowNameChange={setWorkflowName}
        onDescriptionChange={setDescription}
        onSupervisorChange={setSelectedSupervisorID}
        onAddWorker={addWorkerNode}
        onRemoveWorker={removeWorkerNode}
        onWorkerRoutingChange={updateWorkerRouting}
      />

      <WorkflowCanvas nodes={nodes} edges={edges} onNodesChange={onNodesChange} />
    </form>
  );
}
