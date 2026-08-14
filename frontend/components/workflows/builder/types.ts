import { Agent } from '../../../lib/types';

export type ConditionType = 'always' | 'llm_decision' | 'rule_match' | 'fallback';

export interface WorkflowEdgeData extends Record<string, unknown> {
  condition_type: ConditionType;
  condition_expression?: string;
  label?: string;
}

export interface SelectedWorker {
  agent_id: string;
  execution_order: number;
  routing_condition: string;
}

export interface CustomWorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition_type: ConditionType;
  condition_expression?: string;
  label?: string;
}

export interface SupervisorNodeData extends Record<string, unknown> {
  agent: Agent;
  onAddChild?: (parentSourceId: string) => void;
  onRemove?: () => void;
}

export interface WorkerNodeData extends Record<string, unknown> {
  agent: Agent;
  order?: number;
  routing?: string;
  isTeamLead?: boolean;
  onAddChild?: (parentSourceId: string) => void;
  onRemove?: (agentId: string) => void;
}