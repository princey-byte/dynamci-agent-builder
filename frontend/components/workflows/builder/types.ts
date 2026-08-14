import { Agent } from '../../../lib/types';

export interface SelectedWorker {
  agent_id: string;
  execution_order: number;
  routing_condition: string;
}

export interface SupervisorNodeData extends Record<string, unknown> {
  agent: Agent;
}

export interface WorkerNodeData extends Record<string, unknown> {
  agent: Agent;
  order: number;
  routing?: string;
}