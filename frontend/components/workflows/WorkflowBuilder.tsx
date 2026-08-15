'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Agent, Workflow, SSELogEvent } from '../../lib/types';
import { WorkflowCanvas } from './builder/WorkflowCanvas';
import { WorkflowTopBar } from './builder/WorkflowTopBar';
import { AgentPaletteSidebar } from './builder/AgentPaletteSidebar';
import { EdgeConditionDrawer } from './builder/EdgeConditionDrawer';
import { QuickAttachModal } from './builder/QuickAttachModal';
import { CanvasExecutionDrawer } from './builder/CanvasExecutionDrawer';
import { SelectedWorker, WorkflowEdgeData } from './builder/types';
import { useWorkflowGraph } from './builder/useWorkflowGraph';
import { useWorkflowStudio } from './builder/useWorkflowStudio';
import { useWorkflowExecution } from '../../hooks/useWorkflowExecution';
import { Edge } from '@xyflow/react';

interface WorkflowBuilderProps {
  availableAgents: Agent[];
  initialWorkflow?: Workflow;
  initialLogs?: SSELogEvent[];
  initialOutput?: string | null;
  initialQuery?: string;
}

export function WorkflowBuilder({
  availableAgents,
  initialWorkflow,
  initialLogs = [],
  initialOutput = null,
  initialQuery = '',
}: WorkflowBuilderProps) {
  const [workflowName, setWorkflowName] = useState(initialWorkflow?.name || '');
  const [description, setDescription] = useState(initialWorkflow?.description || '');
  const [selectedSupervisorID, setSelectedSupervisorID] = useState<string>(
    initialWorkflow?.supervisor_agent_id || ''
  );
  const [selectedWorkers, setSelectedWorkers] = useState<SelectedWorker[]>(
    initialWorkflow?.nodes?.map((n) => ({
      agent_id: n.agent_id,
      execution_order: n.execution_order,
      routing_condition: n.routing_condition || 'Always execute subtask',
    })) || []
  );

  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);
  const [isExecutionDrawerOpen, setIsExecutionDrawerOpen] = useState(Boolean(initialLogs.length > 0 || initialOutput));
  const [testQuery, setTestQuery] = useState(initialQuery);

  // Quick attach child state
  const [quickAttachParentId, setQuickAttachParentId] = useState<string | null>(null);

  const {
    activeWorkflowId,
    setActiveWorkflowId,
    isSaving,
    studioError,
    setStudioError,
    saveWorkflowToDB,
  } = useWorkflowStudio(initialWorkflow?.id);

  const {
    logs,
    status: executionStatus,
    finalOutput,
    activeNodeId,
    nodeStatuses,
    edgeStatuses,
    clearLogs,
    startExecution,
  } = useWorkflowExecution(activeWorkflowId || initialWorkflow?.id || '', initialLogs, initialOutput);

  // Compute real-time action description from streaming logs
  const currentActionText = useMemo(() => {
    if (executionStatus !== 'running' || logs.length === 0) return undefined;
    const latest = logs[logs.length - 1];
    const payload = latest.payload as Record<string, unknown>;

    switch (latest.event) {
      case 'TOOL_CALL':
        return `🔧 Tool: ${String(payload.tool_name || 'Executing')}`;
      case 'TOOL_RESULT':
        return `Tool Result Received`;
      case 'AGENT_DELEGATION':
        return `Delegating to ${String(payload.agent_name || payload.to_agent || 'Worker')}`;
      case 'AGENT_THOUGHT':
        return `⚡ Thinking...`;
      case 'CONDITION_EVALUATED':
        return `Condition Matched`;
      case 'BRANCH_SKIPPED':
        return `Branch Skipped`;
      default:
        return 'Executing...';
    }
  }, [executionStatus, logs]);

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
    initialNodes: initialWorkflow?.nodes,
    initialEdges: initialWorkflow?.edges,
    activeNodeId,
    nodeStatuses,
    edgeStatuses,
    currentActionText,
    onRemoveWorker: removeWorkerNode,
    onOpenQuickAttach: (parentId) => setQuickAttachParentId(parentId),
  });

  const handleEdgeClick = (_event: React.MouseEvent, edge: Edge<WorkflowEdgeData>) => {
    setSelectedEdgeId(edge.id);
  };

  const handleSaveDraft = useCallback(
    async (e?: React.FormEvent): Promise<Workflow | null> => {
      if (e) e.preventDefault();
      if (!workflowName.trim()) {
        setStudioError('Please provide a workflow name.');
        return null;
      }
      const selectedSupervisor = supervisors.find((s) => s.id === selectedSupervisorID);
      if (!selectedSupervisor) {
        setStudioError('Please select a root supervisor agent.');
        return null;
      }

      try {
        const formattedCustomEdges = edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          condition_type: (edge.data?.condition_type || 'always') as any,
          condition_expression: edge.data?.condition_expression,
          label: edge.data?.label,
        }));

        const saved = await saveWorkflowToDB({
          workflowId: activeWorkflowId || initialWorkflow?.id || null,
          workflowName,
          description,
          supervisorId: selectedSupervisorID,
          workers: selectedWorkers,
          edges: formattedCustomEdges,
        });

        setSavedSuccessMessage(`Workflow saved successfully.`);
        setTimeout(() => setSavedSuccessMessage(null), 3000);
        return saved;
      } catch (err: unknown) {
        return null;
      }
    },
    [workflowName, description, selectedSupervisorID, selectedWorkers, edges, activeWorkflowId, initialWorkflow?.id, saveWorkflowToDB, supervisors, setStudioError]
  );

  const handleRunExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim() || executionStatus === 'running') return;

    // 1. Auto-save current canvas topology to PostgreSQL
    const saved = await handleSaveDraft();
    const targetWfId = saved?.id || activeWorkflowId || initialWorkflow?.id;
    if (!targetWfId) return;

    // 2. Open drawer and launch execution stream
    setIsExecutionDrawerOpen(true);
    startExecution(testQuery, targetWfId);
  };

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden bg-background text-foreground">
      <WorkflowTopBar
        workflowName={workflowName}
        description={description}
        saving={isSaving}
        canSave={Boolean(selectedSupervisorID && workflowName.trim())}
        executionStatus={executionStatus}
        onWorkflowNameChange={setWorkflowName}
        onDescriptionChange={setDescription}
        onAutoLayout={autoLayout}
        onSave={handleSaveDraft}
        onOpenExecutionDrawer={() => setIsExecutionDrawerOpen(true)}
      />

      {studioError && (
        <div className="absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-2.5 text-xs font-semibold text-destructive shadow-2xl backdrop-blur">
          {studioError}
        </div>
      )}

      {savedSuccessMessage && (
        <div className="absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-xl border border-agent-success/40 bg-agent-success/15 px-5 py-2.5 text-xs font-bold text-agent-success shadow-2xl backdrop-blur animate-fade-in">
          {savedSuccessMessage}
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

      <CanvasExecutionDrawer
        logs={logs}
        status={executionStatus}
        finalOutput={finalOutput}
        query={testQuery}
        isOpen={isExecutionDrawerOpen}
        onToggleOpen={() => setIsExecutionDrawerOpen(!isExecutionDrawerOpen)}
        onQueryChange={setTestQuery}
        onRun={handleRunExecution}
        onClearLogs={clearLogs}
      />
    </div>
  );
}
