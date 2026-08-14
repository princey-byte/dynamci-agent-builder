'use client';

import { Background, Controls, Edge, Node, OnNodesChange, ReactFlow } from '@xyflow/react';
import { useMemo } from 'react';
import { SupervisorNode, WorkerNode } from './WorkflowNodes';
import { SupervisorNodeData, WorkerNodeData } from './types';

interface WorkflowCanvasProps {
  nodes: Node<SupervisorNodeData | WorkerNodeData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
}

export function WorkflowCanvas({ nodes, edges, onNodesChange }: WorkflowCanvasProps) {
  const nodeTypes = useMemo(
    () => ({
      supervisorNode: SupervisorNode,
      workerNode: WorkerNode,
    }),
    []
  );

  return (
    <section className="absolute inset-0 pt-[57px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.25}
        maxZoom={1.5}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        className="bg-background"
      >
        <Background color="var(--border)" gap={20} />
        <Controls />
      </ReactFlow>
    </section>
  );
}