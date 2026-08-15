'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import { Agent } from '../../../lib/types';
import { SelectedWorker, SupervisorNodeData, WorkerNodeData, WorkflowEdgeData } from './types';

type NodeLayout = Pick<Node, 'position' | 'measured'>;
type NodeLayoutMap = Record<string, Partial<NodeLayout>>;

interface UseWorkflowGraphArgs {
  availableAgents: Agent[];
  selectedSupervisorID: string;
  selectedWorkers: SelectedWorker[];
  onRemoveWorker: (agentId: string) => void;
  onOpenQuickAttach?: (parentSourceId: string) => void;
}

export function useWorkflowGraph({
  availableAgents,
  selectedSupervisorID,
  selectedWorkers,
  onRemoveWorker,
  onOpenQuickAttach,
}: UseWorkflowGraphArgs) {
  const [nodeLayouts, setNodeLayouts] = useState<NodeLayoutMap>({});
  const [customEdges, setCustomEdges] = useState<Edge<WorkflowEdgeData>[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

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

  // Nodes calculation
  const nodes = useMemo<Node<SupervisorNodeData | WorkerNodeData>[]>(() => {
    const supervisor = availableAgents.find((agent) => agent.id === selectedSupervisorID);
    const nextNodes: Node<SupervisorNodeData | WorkerNodeData>[] = [];

    if (supervisor) {
      nextNodes.push({
        id: 'sup-node',
        type: 'supervisorNode',
        position: nodeLayouts['sup-node']?.position || { x: 500, y: 60 },
        measured: nodeLayouts['sup-node']?.measured,
        data: {
          agent: supervisor,
          onAddChild: onOpenQuickAttach,
        },
      });
    }

    selectedWorkers.forEach((worker, index) => {
      const workerAgent = availableAgents.find((agent) => agent.id === worker.agent_id);
      if (!workerAgent) return;
      const nodeID = `worker-node-${worker.agent_id}`;
      nextNodes.push({
        id: nodeID,
        type: 'workerNode',
        position: nodeLayouts[nodeID]?.position || {
          x: 200 + (index % 3) * 340,
          y: 300 + Math.floor(index / 3) * 240,
        },
        measured: nodeLayouts[nodeID]?.measured,
        data: {
          agent: workerAgent,
          order: worker.execution_order,
          routing: worker.routing_condition,
          onAddChild: onOpenQuickAttach,
          onRemove: () => onRemoveWorker(worker.agent_id),
        },
      });
    });

    return nextNodes;
  }, [availableAgents, selectedSupervisorID, selectedWorkers, nodeLayouts, onOpenQuickAttach, onRemoveWorker]);

  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    setNodeLayouts((currentLayouts) => {
      let changed = false;
      const nextLayouts = { ...currentLayouts };

      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          nextLayouts[change.id] = {
            ...nextLayouts[change.id],
            position: change.position,
          };
          changed = true;
        }

        if (change.type === 'dimensions' && change.dimensions) {
          nextLayouts[change.id] = {
            ...nextLayouts[change.id],
            measured: change.dimensions,
          };
          changed = true;
        }
      }

      return changed ? nextLayouts : currentLayouts;
    });
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes: EdgeChange[]) => {
    setCustomEdges((eds) => applyEdgeChanges(changes, eds) as Edge<WorkflowEdgeData>[]);
  }, []);

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) {
      return;
    }

    setCustomEdges((eds) => {
      const exists = eds.some(
        (e) => e.source === connection.source && e.target === connection.target
      );
      if (exists) return eds;

      const newEdge: Edge<WorkflowEdgeData> = {
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        type: 'conditionEdge',
        data: {
          condition_type: 'always',
          label: 'Always',
        },
      };
      return addEdge(newEdge, eds);
    });
  }, []);

  const updateEdgeCondition = useCallback((edgeId: string, updated: WorkflowEdgeData) => {
    setCustomEdges((eds) =>
      eds.map((edge) => (edge.id === edgeId ? { ...edge, data: updated } : edge))
    );
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    setCustomEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
    setSelectedEdgeId(null);
  }, []);

  const autoLayout = useCallback(() => {
    const newLayouts: NodeLayoutMap = {};
    newLayouts['sup-node'] = {
      ...nodeLayouts['sup-node'],
      position: { x: 500, y: 60 },
    };

    selectedWorkers.forEach((worker, index) => {
      const nodeID = `worker-node-${worker.agent_id}`;
      const col = index % 3;
      const row = Math.floor(index / 3);
      newLayouts[nodeID] = {
        ...nodeLayouts[nodeID],
        position: {
          x: 180 + col * 340,
          y: 280 + row * 240,
        },
      };
    });

    setNodeLayouts(newLayouts);
  }, [nodeLayouts, selectedWorkers]);

  const addEdgeDirect = useCallback((sourceNodeId: string, targetNodeId: string) => {
    setCustomEdges((eds) => {
      const exists = eds.some(
        (e) => e.source === sourceNodeId && e.target === targetNodeId
      );
      if (exists) return eds;

      const newEdge: Edge<WorkflowEdgeData> = {
        id: `e-${sourceNodeId}-${targetNodeId}-${Date.now()}`,
        source: sourceNodeId,
        target: targetNodeId,
        type: 'conditionEdge',
        data: {
          condition_type: 'always',
          label: 'Always',
        },
      };
      return addEdge(newEdge, eds);
    });
  }, []);

  const selectedEdgeData = useMemo(() => {
    if (!selectedEdgeId) return null;
    const found = customEdges.find((edge) => edge.id === selectedEdgeId);
    return found?.data || null;
  }, [selectedEdgeId, customEdges]);

  return {
    supervisors,
    workers,
    availableWorkerOptions,
    selectedWorkerIDs,
    nodes,
    edges: customEdges,
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
  };
}