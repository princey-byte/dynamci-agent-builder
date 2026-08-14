'use client';

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react';
import { WorkflowEdgeData } from './types';
import { GitCommit } from 'lucide-react';

export function CustomConditionEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as WorkflowEdgeData | undefined;
  const conditionType = edgeData?.condition_type || 'always';
  const label = edgeData?.label || conditionType;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          strokeWidth: selected ? 2.5 : 1.5,
          stroke: selected ? 'var(--primary)' : 'var(--border-strong)',
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="group flex cursor-pointer items-center space-x-1.5 rounded-full border border-border-subtle bg-background-surface px-3 py-1 text-[11px] font-medium shadow-md transition-all hover:border-primary hover:scale-105"
        >
          <GitCommit className="h-3.5 w-3.5 text-primary" />
          <span className="text-foreground">{label}</span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">({conditionType})</span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
