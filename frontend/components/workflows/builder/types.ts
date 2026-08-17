import { Agent, NodeExecutionStatus, EdgeExecutionStatus } from '../../../lib/types';

export type ConditionType = 'always' | 'llm_decision' | 'rule_match' | 'fallback';

export interface WorkflowEdgeData extends Record<string, unknown> {
  condition_type: ConditionType;
  condition_expression?: string;
  label?: string;
  executionStatus?: EdgeExecutionStatus;
}

export interface SelectedWorker {
  agent_id: string;
  execution_order: number;
  routing_condition: string;
  position_x?: number;
  position_y?: number;
}

export interface CustomWorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition_type: ConditionType;
  condition_expression?: string;
  label?: string;
  executionStatus?: EdgeExecutionStatus;
}

export interface SupervisorNodeData extends Record<string, unknown> {
  agent: Agent;
  executionStatus?: NodeExecutionStatus;
  currentActionText?: string;
  onAddChild?: (parentSourceId: string) => void;
  onRemove?: () => void;
}

export interface WorkerNodeData extends Record<string, unknown> {
  agent: Agent;
  order?: number;
  routing?: string;
  isTeamLead?: boolean;
  executionStatus?: NodeExecutionStatus;
  currentActionText?: string;
  onAddChild?: (parentSourceId: string) => void;
  onRemove?: (agentId: string) => void;
}