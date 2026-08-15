'use client';

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react';
import { WorkflowEdgeData } from './types';
import { GitCommit, Sparkles } from 'lucide-react';

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
  animated,
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

  const isTraversed = animated || edgeData?.executionStatus === 'traversed';
  const isSkipped = edgeData?.executionStatus === 'skipped';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          strokeWidth: isTraversed ? 3.5 : selected ? 3 : 2,
          stroke: isTraversed
            ? 'hsl(var(--primary))'
            : isSkipped
            ? 'hsl(var(--muted-foreground) / 0.3)'
            : selected
            ? 'hsl(var(--primary))'
            : 'hsl(var(--foreground) / 0.35)',
          strokeDasharray: isSkipped ? '4 4' : undefined,
          transition: 'stroke 0.3s, stroke-width 0.3s',
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
          className={`group flex cursor-pointer items-center space-x-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold shadow-md backdrop-blur transition-all hover:scale-105 ${
            isTraversed
              ? 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/20 scale-105 animate-pulse'
              : isSkipped
              ? 'border-border bg-background text-muted-foreground opacity-50'
              : selected
              ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/30'
              : 'border-border bg-card text-foreground hover:border-primary'
          }`}
        >
          {isTraversed ? (
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground animate-spin" />
          ) : (
            <GitCommit className={`h-3.5 w-3.5 ${selected ? 'text-primary-foreground' : 'text-primary'}`} />
          )}
          <span className="font-bold">{label}</span>
          {isTraversed ? (
            <span className="text-[9px] uppercase font-bold text-primary-foreground/90">● ACTIVE</span>
          ) : (
            <span className={`text-[9px] uppercase tracking-wider ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
              ({conditionType})
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
