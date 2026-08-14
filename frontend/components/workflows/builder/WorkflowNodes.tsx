import { Handle, Position } from '@xyflow/react';
import { Bot } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { SupervisorNodeData, WorkerNodeData } from './types';

export function SupervisorNode({ data }: { data: SupervisorNodeData }) {
  return (
    <div className="w-72 rounded-2xl border-2 border-primary bg-card p-5 text-card-foreground shadow-2xl shadow-primary/10">
      <Handle type="target" position={Position.Top} className="h-3! w-3! bg-primary!" />
      <div className="mb-3 flex items-center space-x-2">
        <Bot className="h-5 w-5 text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Supervisor</span>
      </div>
      <div className="text-base font-semibold text-foreground">{data.agent.name}</div>
      <div className="mt-3 flex items-center space-x-2">
        <Badge variant="supervisor">Supervisor</Badge>
        <Badge variant={data.agent.model_provider as 'openai' | 'azure_openai' | 'anthropic' | 'gemini'}>
          {data.agent.model_name}
        </Badge>
      </div>
      <Handle type="source" position={Position.Bottom} className="h-3! w-3! bg-primary!" />
    </div>
  );
}

export function WorkerNode({ data }: { data: WorkerNodeData }) {
  return (
    <div className="w-72 rounded-2xl border border-agent-delegation/40 bg-card p-5 text-card-foreground shadow-xl shadow-agent-delegation/10">
      <Handle type="target" position={Position.Top} className="h-3! w-3! bg-agent-delegation!" />
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Bot className="h-4 w-4 text-agent-delegation" />
          <span className="text-xs font-bold text-agent-delegation">Worker Node #{data.order}</span>
        </div>
      </div>
      <div className="text-sm font-semibold text-foreground">{data.agent.name}</div>
      {data.routing && (
        <div className="mt-2 rounded border bg-background p-2 font-mono text-[11px] text-muted-foreground">
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