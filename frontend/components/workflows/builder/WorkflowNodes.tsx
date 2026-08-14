import { Handle, Position } from '@xyflow/react';
import { Bot } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { SupervisorNodeData, WorkerNodeData } from './types';

export function SupervisorNode({ data }: { data: SupervisorNodeData }) {
  return (
    <div className="w-72 rounded-2xl border-2 border-indigo-500 bg-background-surface p-5 shadow-2xl shadow-indigo-950/40">
      <Handle type="target" position={Position.Top} className="h-3! w-3! bg-indigo-500!" />
      <div className="mb-3 flex items-center space-x-2">
        <Bot className="h-5 w-5 text-indigo-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Supervisor</span>
      </div>
      <div className="text-base font-semibold text-slate-100">{data.agent.name}</div>
      <div className="mt-3 flex items-center space-x-2">
        <Badge variant="supervisor">Supervisor</Badge>
        <Badge variant={data.agent.model_provider as 'openai' | 'azure_openai' | 'anthropic' | 'gemini'}>
          {data.agent.model_name}
        </Badge>
      </div>
      <Handle type="source" position={Position.Bottom} className="h-3! w-3! bg-indigo-500!" />
    </div>
  );
}

export function WorkerNode({ data }: { data: WorkerNodeData }) {
  return (
    <div className="w-72 rounded-2xl border border-cyan-800/80 bg-background-surface p-5 shadow-xl shadow-cyan-950/20">
      <Handle type="target" position={Position.Top} className="h-3! w-3! bg-cyan-400!" />
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Bot className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold text-cyan-300">Worker Node #{data.order}</span>
        </div>
      </div>
      <div className="text-sm font-semibold text-slate-100">{data.agent.name}</div>
      {data.routing && (
        <div className="mt-2 rounded border border-border-subtle bg-background p-2 font-mono text-[11px] text-slate-400">
          Condition: {data.routing}
        </div>
      )}
      <div className="mt-3 flex items-center space-x-2">
        <Badge variant="worker">Worker</Badge>
        <Badge variant={data.agent.model_provider as 'openai' | 'azure_openai' | 'anthropic' | 'gemini'}>
          {data.agent.model_name}
        </Badge>
      </div>
    </div>
  );
}