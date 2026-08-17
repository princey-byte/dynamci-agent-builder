'use client';

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react';
import { WorkflowEdgeData } from './types';
import { GitCommit } from 'lucide-react';

export function CustomConditionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style,
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
  const isTraversed = edgeData?.executionStatus === 'traversed';
  const isSkipped = edgeData?.executionStatus === 'skipped';
  const skippedStroke = 'color-mix(in oklab, var(--muted-foreground) 30%, transparent)';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          strokeWidth: isTraversed ? 3 : selected ? 2.5 : 2,
          stroke: isTraversed
            ? 'var(--primary)'
            : isSkipped
            ? skippedStroke
            : selected
            ? 'var(--primary)'
            : '#64748b',
          strokeDasharray: isSkipped ? '4 4' : undefined,
          ...style,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`group flex cursor-pointer items-center space-x-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-md backdrop-blur transition-all ${
            isTraversed
              ? 'border-primary bg-primary text-primary-foreground shadow-primary/20'
              : isSkipped
              ? 'border-border bg-background text-muted-foreground opacity-50'
              : selected
              ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/30'
              : 'border-border bg-card text-foreground hover:border-primary'
          }`}
        >
          <GitCommit className={`h-3.5 w-3.5 ${isTraversed || selected ? 'text-primary-foreground' : 'text-primary'}`} />
          <span className="font-bold">{label}</span>
          <span className={`text-[9px] uppercase tracking-wider ${isTraversed || selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
            ({conditionType})
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
