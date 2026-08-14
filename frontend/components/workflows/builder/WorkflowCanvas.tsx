'use client';

import React, { useMemo } from 'react';
import {
  Background,
  Controls,
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SupervisorNode, WorkerNode } from './WorkflowNodes';
import { CustomConditionEdge } from './CustomConditionEdge';
import { SupervisorNodeData, WorkerNodeData, WorkflowEdgeData } from './types';

interface WorkflowCanvasProps {
  nodes: Node<SupervisorNodeData | WorkerNodeData>[];
  edges: Edge<WorkflowEdgeData>[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onEdgeClick: (event: React.MouseEvent, edge: Edge<WorkflowEdgeData>) => void;
}

export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onEdgeClick,
}: WorkflowCanvasProps) {
  const nodeTypes = useMemo(
    () => ({
      supervisorNode: SupervisorNode,
      workerNode: WorkerNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      conditionEdge: CustomConditionEdge,
    }),
    []
  );

  return (
    <section className="absolute inset-0 pt-[57px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.25}
        maxZoom={1.5}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        className="bg-background"
      >
        <Background color="var(--border-subtle)" gap={20} size={1} />
        <Controls className="!border-border-subtle !bg-background-surface shadow-lg" />
      </ReactFlow>
    </section>
  );
}