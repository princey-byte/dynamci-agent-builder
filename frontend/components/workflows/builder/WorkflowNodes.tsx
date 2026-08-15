'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Cpu, Sparkles, Wrench, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { SupervisorNodeData, WorkerNodeData } from './types';

export function SupervisorNode({ data, id }: { data: SupervisorNodeData; id: string }) {
  return (
    <div className="group relative min-w-[290px] max-w-[320px] rounded-2xl border-2 border-primary bg-card p-5 text-card-foreground shadow-2xl shadow-primary/10 transition-all hover:border-primary hover:shadow-primary/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Root Supervisor</span>
            <h4 className="text-sm font-bold text-foreground truncate max-w-[180px]">{data.agent.name}</h4>
          </div>
        </div>

        {/* Quick Add Child Button located safely inside card header */}
        {data.onAddChild && (
          <button
            type="button"
            onClick={() => data.onAddChild?.(id)}
            className="flex items-center space-x-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground shadow-sm"
            title="Attach a downstream child worker"
          >
            <Plus className="h-3 w-3" />
            <span>Child</span>
          </button>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{data.agent.persona || 'Workflow Coordinator'}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
        <Badge variant="supervisor">Supervisor</Badge>
        <Badge variant={data.agent.model_provider as 'openai' | 'azure_openai' | 'anthropic' | 'gemini'}>
          {data.agent.model_name}
        </Badge>
      </div>

      {/* Connection Output Handle - Unobstructed and clear */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-4 !w-4 !rounded-full !border-2 !border-background !bg-primary transition-all hover:!scale-150 hover:!ring-4 hover:!ring-primary/40 shadow-lg cursor-crosshair z-20"
      />
    </div>
  );
}

export function WorkerNode({ data, id }: { data: WorkerNodeData; id: string }) {
  return (
    <div className="group relative min-w-[290px] max-w-[320px] rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl transition-all hover:border-primary/60 hover:shadow-2xl">
      {/* Input Connection Handle on Top - Unobstructed */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-4 !w-4 !rounded-full !border-2 !border-background !bg-muted-foreground transition-all hover:!scale-150 hover:!bg-primary hover:!ring-4 hover:!ring-primary/40 shadow-lg cursor-crosshair z-20"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Worker Node</span>
            <h4 className="text-sm font-bold text-foreground truncate max-w-[140px]">{data.agent.name}</h4>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          {data.onAddChild && (
            <button
              type="button"
              onClick={() => data.onAddChild?.(id)}
              className="flex items-center space-x-1 rounded-lg border border-border bg-secondary/80 px-2 py-1 text-[10px] font-bold text-foreground transition-all hover:border-primary hover:text-primary hover:bg-primary/10 shadow-sm"
              title="Attach downstream sub-worker"
            >
              <Plus className="h-3 w-3" />
              <span>Child</span>
            </button>
          )}

          {data.onRemove && (
            <button
              type="button"
              onClick={() => data.onRemove?.(data.agent.id)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Remove Worker Node"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Wrench className="h-3.5 w-3.5 text-agent-tool" /> {data.agent.mcp_tools?.length || 0} Tools
        </span>
        <span className="flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> {data.agent.skills?.length || 0} Skills
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge variant="worker">Worker</Badge>
        <Badge variant={data.agent.model_provider as 'openai' | 'azure_openai' | 'anthropic' | 'gemini'}>
          {data.agent.model_name}
        </Badge>
      </div>

      {/* Output Connection Handle on Bottom - Unobstructed */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-4 !w-4 !rounded-full !border-2 !border-background !bg-primary transition-all hover:!scale-150 hover:!ring-4 hover:!ring-primary/40 shadow-lg cursor-crosshair z-20"
      />
    </div>
  );
}