'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Cpu, Sparkles, Wrench, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { SupervisorNodeData, WorkerNodeData } from './types';

export function SupervisorNode({ data, id }: { data: SupervisorNodeData; id: string }) {
  return (
    <div className="group relative min-w-[280px] max-w-[320px] rounded-2xl border-2 border-primary bg-card p-5 text-card-foreground shadow-2xl shadow-primary/10 transition-all hover:border-primary hover:shadow-primary/20">
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
      </div>

      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{data.agent.persona || 'Workflow Coordinator'}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-2.5">
        <Badge variant="supervisor">Supervisor</Badge>
        <Badge variant={data.agent.model_provider as 'openai' | 'azure_openai' | 'anthropic' | 'gemini'}>
          {data.agent.model_name}
        </Badge>
      </div>

      {/* Output Connection Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-4 !w-4 !rounded-full !border-2 !border-background !bg-primary transition-transform hover:scale-150 shadow-md cursor-crosshair"
      />

      {/* Quick Add Child Button */}
      {data.onAddChild && (
        <button
          type="button"
          onClick={() => data.onAddChild?.(id)}
          className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 flex items-center space-x-1 rounded-full border border-primary/40 bg-background-surface px-2.5 py-0.5 text-[10px] font-semibold text-primary shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-primary hover:text-primary-foreground"
        >
          <Plus className="h-3 w-3" />
          <span>Add Child</span>
        </button>
      )}
    </div>
  );
}

export function WorkerNode({ data, id }: { data: WorkerNodeData; id: string }) {
  return (
    <div className="group relative min-w-[280px] max-w-[320px] rounded-2xl border border-border-subtle bg-card p-5 text-card-foreground shadow-xl transition-all hover:border-border-strong hover:shadow-2xl">
      {/* Input Connection Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-4 !w-4 !rounded-full !border-2 !border-background !bg-muted-foreground transition-transform hover:scale-150 hover:!bg-primary shadow-md cursor-crosshair"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Worker Node</span>
            <h4 className="text-sm font-bold text-foreground truncate max-w-[170px]">{data.agent.name}</h4>
          </div>
        </div>

        {data.onRemove && (
          <button
            type="button"
            onClick={() => data.onRemove?.(data.agent.id)}
            className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
            title="Remove Worker Node"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-border-subtle pt-2 text-[11px] text-muted-foreground">
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

      {/* Output Connection Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-4 !w-4 !rounded-full !border-2 !border-background !bg-primary transition-transform hover:scale-150 shadow-md cursor-crosshair"
      />

      {/* Quick Add Child Button */}
      {data.onAddChild && (
        <button
          type="button"
          onClick={() => data.onAddChild?.(id)}
          className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 flex items-center space-x-1 rounded-full border border-primary/40 bg-background-surface px-2.5 py-0.5 text-[10px] font-semibold text-primary shadow-md transition-all opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-primary hover:text-primary-foreground"
        >
          <Plus className="h-3 w-3" />
          <span>Add Child</span>
        </button>
      )}
    </div>
  );
}