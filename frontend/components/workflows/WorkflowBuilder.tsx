'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Agent, Workflow, SSELogEvent, ExecutionSession, NodeExecutionStatus, EdgeExecutionStatus } from '../../lib/types';
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
import { api } from '../../lib/api';
import { Edge } from '@xyflow/react';

interface WorkflowBuilderProps {
  availableAgents: Agent[];
  initialWorkflow?: Workflow;
  initialSessions?: ExecutionSession[];
  initialLogs?: SSELogEvent[];
  initialOutput?: string | null;
  initialQuery?: string;
}

export function WorkflowBuilder({
  availableAgents,
  initialWorkflow,
  initialSessions = [],
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

  // Multi-session execution history state
  const [sessions, setSessions] = useState<ExecutionSession[]>(initialSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessions.length > 0 ? initialSessions[0].id : null
  );
  const [isNewRunMode, setIsNewRunMode] = useState<boolean>(initialSessions.length === 0);

  // Historical node and edge highlights for selected past run
  const [historicalNodeStatuses, setHistoricalNodeStatuses] = useState<Record<string, NodeExecutionStatus>>({});
  const [historicalEdgeStatuses, setHistoricalEdgeStatuses] = useState<Record<string, EdgeExecutionStatus>>({});

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
    nodeStatuses: liveNodeStatuses,
    edgeStatuses: liveEdgeStatuses,
    clearLogs,
    loadSessionData,
    startExecution,
  } = useWorkflowExecution(activeWorkflowId || initialWorkflow?.id || '', initialLogs, initialOutput);

  // When live execution is running, use live statuses; otherwise use historical or neutral
  const activeNodeStatuses = useMemo(() => {
    if (executionStatus === 'running') return liveNodeStatuses;
    if (!isNewRunMode && Object.keys(historicalNodeStatuses).length > 0) return historicalNodeStatuses;
    return liveNodeStatuses;
  }, [executionStatus, liveNodeStatuses, isNewRunMode, historicalNodeStatuses]);

  const activeEdgeStatuses = useMemo(() => {
    if (executionStatus === 'running') return liveEdgeStatuses;
    if (!isNewRunMode && Object.keys(historicalEdgeStatuses).length > 0) return historicalEdgeStatuses;
    return liveEdgeStatuses;
  }, [executionStatus, liveEdgeStatuses, isNewRunMode, historicalEdgeStatuses]);

  // Refresh sessions when a live execution completes
  useEffect(() => {
    if (executionStatus === 'completed' || executionStatus === 'error') {
      const targetWfId = activeWorkflowId || initialWorkflow?.id;
      if (targetWfId) {
        api.getWorkflowSessions(targetWfId)
          .then((updatedSessions) => {
            if (updatedSessions && updatedSessions.length > 0) {
              setSessions(updatedSessions);
              setSelectedSessionId(updatedSessions[0].id);
              setIsNewRunMode(false);
            }
          })
          .catch(console.error);
      }
    }
  }, [executionStatus, activeWorkflowId, initialWorkflow?.id]);

  // Handle switching between past historical runs
  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      try {
        const fullSession = await api.getSession(sessionId);
        if (fullSession) {
          setSelectedSessionId(sessionId);
          setIsNewRunMode(false);
          setTestQuery('');

          const nodeStatusMap: Record<string, NodeExecutionStatus> = {};
          const edgeStatusMap: Record<string, EdgeExecutionStatus> = {};
          const mappedLogs: SSELogEvent[] = [];

          if (fullSession.logs && fullSession.logs.length > 0) {
            fullSession.logs.forEach((l) => {
              const agentKey = l.agent_id || l.agent_name;
              if (agentKey) {
                nodeStatusMap[agentKey] = l.log_type === 'BRANCH_SKIPPED' ? 'skipped' : 'completed';
              }

              let parsedContent: Record<string, unknown> = {};
              if (l.content) {
                parsedContent = typeof l.content === 'string' ? JSON.parse(l.content) : (l.content as Record<string, unknown>);
                if (parsedContent?.edge_id) {
                  edgeStatusMap[String(parsedContent.edge_id)] = l.log_type === 'BRANCH_SKIPPED' ? 'skipped' : 'traversed';
                }
              }

              mappedLogs.push({
                event: l.log_type as SSELogEvent['event'],
                session_id: fullSession.id,
                agent_name: l.agent_name,
                agent_id: l.agent_id,
                step: l.step_number,
                payload: parsedContent,
              });
            });
          }

          // Immediately update reactive logs and output in the execution hook
          loadSessionData(
            mappedLogs,
            fullSession.final_output || null,
            fullSession.status === 'ERROR' ? 'error' : 'completed'
          );

          setHistoricalNodeStatuses(nodeStatusMap);
          setHistoricalEdgeStatuses(edgeStatusMap);
        }
      } catch (err) {
        console.error('Failed to load session details:', err);
      }
    },
    [loadSessionData]
  );

  // Handle starting a fresh clean test run
  const handleNewRun = useCallback(() => {
    setSelectedSessionId(null);
    setIsNewRunMode(true);
    setTestQuery('');
    clearLogs();
    setHistoricalNodeStatuses({});
    setHistoricalEdgeStatuses({});
  }, [clearLogs]);

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
    nodeLayouts,
  } = useWorkflowGraph({
    availableAgents,
    selectedSupervisorID,
    selectedWorkers,
    initialNodes: initialWorkflow?.nodes,
    initialEdges: initialWorkflow?.edges,
    initialUISchema: initialWorkflow?.ui_schema,
    activeNodeId,
    nodeStatuses: activeNodeStatuses,
    edgeStatuses: activeEdgeStatuses,
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

        // Capture exact canvas positions for all nodes
        const positionsMap: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          positionsMap[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
        });

        const workersWithPositions = selectedWorkers.map((w) => {
          const nodeKey = `worker-node-${w.agent_id}`;
          const pos = positionsMap[nodeKey];
          return {
            ...w,
            position_x: pos ? pos.x : 0,
            position_y: pos ? pos.y : 0,
          };
        });

        const saved = await saveWorkflowToDB({
          workflowId: activeWorkflowId || initialWorkflow?.id || null,
          workflowName,
          description,
          supervisorId: selectedSupervisorID,
          workers: workersWithPositions,
          edges: formattedCustomEdges,
          uiSchema: {
            positions: positionsMap,
          },
        });

        setSavedSuccessMessage(`Workflow saved successfully.`);
        setTimeout(() => setSavedSuccessMessage(null), 3000);
        return saved;
      } catch (err: unknown) {
        return null;
      }
    },
    [workflowName, description, selectedSupervisorID, selectedWorkers, edges, nodes, activeWorkflowId, initialWorkflow?.id, saveWorkflowToDB, supervisors, setStudioError]
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
    const continueSessionId = !isNewRunMode && selectedSessionId ? selectedSessionId : null;
    startExecution(testQuery, targetWfId, continueSessionId);
    setTestQuery('');
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
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        isNewRunMode={isNewRunMode}
        onToggleOpen={() => setIsExecutionDrawerOpen(!isExecutionDrawerOpen)}
        onQueryChange={setTestQuery}
        onRun={handleRunExecution}
        onClearLogs={handleNewRun}
        onSelectSession={handleSelectSession}
        onNewRun={handleNewRun}
      />
    </div>
  );
}
