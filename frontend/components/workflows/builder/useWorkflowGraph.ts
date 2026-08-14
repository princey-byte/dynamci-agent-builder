'use client';

import { useCallback, useMemo, useState } from 'react';
import { Edge, Node, NodeChange, OnNodesChange, XYPosition } from '@xyflow/react';
import { Agent } from '../../../lib/types';
import { SelectedWorker, SupervisorNodeData, WorkerNodeData } from './types';

type PositionMap = Record<string, XYPosition>;

interface UseWorkflowGraphArgs {
  availableAgents: Agent[];
  selectedSupervisorID: string;
  selectedWorkers: SelectedWorker[];
}

export function useWorkflowGraph({ availableAgents, selectedSupervisorID, selectedWorkers }: UseWorkflowGraphArgs) {
  const [nodePositions, setNodePositions] = useState<PositionMap>({});

  const supervisors = useMemo(
    () => availableAgents.filter((agent) => agent.role_type === 'supervisor'),
    [availableAgents]
  );

  const workers = useMemo(
    () => availableAgents.filter((agent) => agent.role_type === 'worker'),
    [availableAgents]
  );

  const selectedWorkerIDs = useMemo(
    () => new Set(selectedWorkers.map((worker) => worker.agent_id)),
    [selectedWorkers]
  );

  const availableWorkerOptions = useMemo(
    () => workers.filter((worker) => !selectedWorkerIDs.has(worker.id)),
    [workers, selectedWorkerIDs]
  );

  const nodes = useMemo<Node<SupervisorNodeData | WorkerNodeData>[]>(() => {
    const supervisor = availableAgents.find((agent) => agent.id === selectedSupervisorID);
    const nextNodes: Node<SupervisorNodeData | WorkerNodeData>[] = [];

    if (supervisor) {
      nextNodes.push({
        id: 'sup-node',
        type: 'supervisorNode',
        position: nodePositions['sup-node'] || { x: 520, y: 160 },
        data: { agent: supervisor },
      });
    }

    selectedWorkers.forEach((worker, index) => {
      const workerAgent = availableAgents.find((agent) => agent.id === worker.agent_id);
      if (!workerAgent) return;
      const nodeID = `worker-node-${worker.agent_id}`;
      nextNodes.push({
        id: nodeID,
        type: 'workerNode',
        position: nodePositions[nodeID] || { x: 260 + (index % 3) * 340, y: 460 + Math.floor(index / 3) * 230 },
        data: { agent: workerAgent, order: worker.execution_order, routing: worker.routing_condition },
      });
    });

    return nextNodes;
  }, [availableAgents, selectedSupervisorID, selectedWorkers, nodePositions]);

  const edges = useMemo<Edge[]>(
    () =>
      selectedWorkers.map((worker) => ({
        id: `e-sup-worker-${worker.agent_id}`,
        source: 'sup-node',
        target: `worker-node-${worker.agent_id}`,
        animated: true,
        style: { stroke: 'var(--primary)', strokeWidth: 2 },
      })),
    [selectedWorkers]
  );

  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    setNodePositions((currentPositions) => {
      let changed = false;
      const nextPositions = { ...currentPositions };

      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          nextPositions[change.id] = change.position;
          changed = true;
        }
      }

      return changed ? nextPositions : currentPositions;
    });
  }, []);

  return {
    supervisors,
    workers,
    availableWorkerOptions,
    nodes,
    edges,
    onNodesChange,
  };
}