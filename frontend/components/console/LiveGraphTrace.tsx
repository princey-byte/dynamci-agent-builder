'use client';

import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Workflow, NodeExecutionStatus, EdgeExecutionStatus } from '../../lib/types';
import { SupervisorNode, WorkerNode } from '../workflows/builder/WorkflowNodes';
import { CustomConditionEdge } from '../workflows/builder/CustomConditionEdge';
import { SupervisorNodeData, WorkerNodeData, WorkflowEdgeData } from '../workflows/builder/types';

const nodeTypes = {
  supervisorNode: SupervisorNode,
  workerNode: WorkerNode,
};

const edgeTypes = {
  conditionEdge: CustomConditionEdge,
};

interface LiveGraphTraceProps {
  workflow: Workflow;
  activeNodeId: string | null;
  nodeStatuses?: Record<string, NodeExecutionStatus>;
  edgeStatuses?: Record<string, EdgeExecutionStatus>;
}

export function LiveGraphTrace({
  workflow,
  activeNodeId,
  nodeStatuses = {},
  edgeStatuses = {},
}: LiveGraphTraceProps) {
  const nodes = useMemo<Node<SupervisorNodeData | WorkerNodeData>[]>(() => {
    const list: Node<SupervisorNodeData | WorkerNodeData>[] = [];
    if (workflow.supervisor_agent) {
      const isSupActive =
        activeNodeId === workflow.supervisor_agent_id ||
        activeNodeId === workflow.supervisor_agent.id;

      list.push({
        id: 'sup-node',
        type: 'supervisorNode',
        position: { x: 450, y: 40 },
        data: { agent: workflow.supervisor_agent },
        className: isSupActive
          ? 'ring-4 ring-primary ring-offset-4 ring-offset-background animate-pulse rounded-2xl'
          : '',
      });
    }

    workflow.nodes?.forEach((node, idx) => {
      if (!node.agent) return;
      const isActive =
        activeNodeId === node.agent_id ||
        activeNodeId === node.id ||
        activeNodeId === node.agent.id;

      const status = nodeStatuses[node.id] || nodeStatuses[node.agent_id] || 'idle';

      list.push({
        id: `worker-node-${node.agent_id}`,
        type: 'workerNode',
        position: {
          x: 180 + (idx % 3) * 320,
          y: 260 + Math.floor(idx / 3) * 220,
        },
        data: {
          agent: node.agent,
          order: node.execution_order,
          routing: node.routing_condition,
        },
        className: isActive
          ? 'ring-4 ring-agent-delegation ring-offset-4 ring-offset-background animate-pulse rounded-2xl'
          : status === 'skipped'
          ? 'opacity-40 grayscale'
          : '',
      });
    });

    return list;
  }, [workflow, activeNodeId, nodeStatuses]);

  const edges = useMemo<Edge<WorkflowEdgeData>[]>(() => {
    if (!workflow.edges || workflow.edges.length === 0) {
      // Fallback star edges
      return (workflow.nodes || []).map((node) => ({
        id: `e-sup-${node.id}`,
        source: 'sup-node',
        target: `worker-node-${node.agent_id}`,
        type: 'conditionEdge',
        animated: activeNodeId === node.agent_id || activeNodeId === node.id,
        data: {
          condition_type: 'always',
          label: node.routing_condition || 'Always',
        },
      }));
    }

    return workflow.edges.map((edge) => {
      const status = edgeStatuses[edge.id] || 'idle';
      const sourceId =
        edge.source_node_id === workflow.supervisor_agent_id
          ? 'sup-node'
          : `worker-node-${edge.source_node_id}`;
      const targetId = `worker-node-${edge.target_node_id}`;

      return {
        id: edge.id,
        source: sourceId,
        target: targetId,
        type: 'conditionEdge',
        data: {
          condition_type: (edge.condition_type || 'always') as any,
          condition_expression: edge.condition_expression,
          label: edge.label || edge.condition_type,
        },
        animated: status === 'traversed',
        style: {
          stroke:
            status === 'traversed'
              ? 'var(--primary)'
              : status === 'skipped'
              ? 'var(--muted-foreground)'
              : 'var(--border-strong)',
          strokeDasharray: status === 'skipped' ? '4 4' : undefined,
          opacity: status === 'skipped' ? 0.35 : 1,
        },
      };
    });
  }, [workflow, activeNodeId, edgeStatuses]);

  return (
    <div className="relative h-full min-h-[360px] w-full rounded-2xl border border-border-subtle bg-background-canvas overflow-hidden shadow-xl">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        className="bg-background"
      >
        <Background color="var(--border-subtle)" gap={20} size={1} />
        <Controls className="!border-border-subtle !bg-background-surface shadow-md" />
      </ReactFlow>
    </div>
  );
}
