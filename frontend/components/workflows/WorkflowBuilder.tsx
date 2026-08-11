'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  Handle,
  Position,
} from '@xyflow/react';
import { Agent } from '../../lib/types';
import { api } from '../../lib/api';
import { Badge } from '../ui/Badge';
import { Bot, Plus, Save, ArrowLeft } from 'lucide-react';

interface WorkflowBuilderProps {
  availableAgents: Agent[];
}

// Custom Node for Supervisor Agent
function SupervisorNode({ data }: { data: { agent: Agent } }) {
  return (
    <div className="p-4 bg-[#111726] border-2 border-indigo-500 rounded-xl shadow-lg w-64">
      <Handle type="target" position={Position.Top} className="!bg-indigo-500 !w-3 !h-3" />
      <div className="flex items-center space-x-2 mb-2">
        <Bot className="w-5 h-5 text-indigo-400" />
        <span className="font-bold text-xs text-indigo-300 uppercase tracking-wider">Supervisor</span>
      </div>
      <div className="font-semibold text-slate-100 text-sm">{data.agent.name}</div>
      <div className="flex items-center space-x-2 mt-2">
        <Badge variant="supervisor">Supervisor</Badge>
        <Badge variant={data.agent.model_provider as any}>{data.agent.model_name}</Badge>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !w-3 !h-3" />
    </div>
  );
}

// Custom Node for Worker Agent
function WorkerNode({ data }: { data: { agent: Agent; order: number; routing?: string } }) {
  return (
    <div className="p-4 bg-[#111726] border border-cyan-800/80 rounded-xl shadow-lg w-64">
      <Handle type="target" position={Position.Top} className="!bg-cyan-400 !w-3 !h-3" />
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-xs text-cyan-300">Worker Node #{data.order}</span>
        </div>
      </div>
      <div className="font-semibold text-slate-100 text-sm">{data.agent.name}</div>
      {data.routing && (
        <div className="text-[11px] text-slate-400 font-mono mt-1 bg-[#090d16] p-1.5 rounded border border-[#1e293b]">
          Condition: {data.routing}
        </div>
      )}
      <div className="flex items-center space-x-2 mt-2">
        <Badge variant="worker">Worker</Badge>
        <Badge variant={data.agent.model_provider as any}>{data.agent.model_name}</Badge>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-cyan-400 !w-3 !h-3" />
    </div>
  );
}

export function WorkflowBuilder({ availableAgents }: WorkflowBuilderProps) {
  const router = useRouter();

  const supervisors = availableAgents.filter((a) => a.role_type === 'supervisor' || a.role_type === 'worker');
  const workers = availableAgents.filter((a) => a.role_type === 'worker' || a.role_type === 'supervisor');

  const [workflowName, setWorkflowName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSupervisorID, setSelectedSupervisorID] = useState<string>(supervisors[0]?.id || '');
  const [selectedWorkers, setSelectedWorkers] = useState<
    Array<{ agent_id: string; execution_order: number; routing_condition: string }>
  >([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Define React Flow nodeTypes
  const nodeTypes = useMemo(
    () => ({
      supervisorNode: SupervisorNode,
      workerNode: WorkerNode,
    }),
    []
  );

  // Generate nodes array for React Flow preview
  const nodes: Node[] = useMemo(() => {
    const list: Node[] = [];
    const supAgent = availableAgents.find((a) => a.id === selectedSupervisorID);

    if (supAgent) {
      list.push({
        id: 'sup-node',
        type: 'supervisorNode',
        position: { x: 250, y: 30 },
        data: { agent: supAgent },
      });
    }

    selectedWorkers.forEach((w, idx) => {
      const wAgent = availableAgents.find((a) => a.id === w.agent_id);
      if (wAgent) {
        list.push({
          id: `worker-node-${idx}`,
          type: 'workerNode',
          position: { x: 100 + (idx % 3) * 280, y: 220 + Math.floor(idx / 3) * 180 },
          data: { agent: wAgent, order: w.execution_order, routing: w.routing_condition },
        });
      }
    });

    return list;
  }, [selectedSupervisorID, selectedWorkers, availableAgents]);

  // Generate edges connecting Supervisor -> Workers
  const edges: Edge[] = useMemo(() => {
    return selectedWorkers.map((_, idx) => ({
      id: `e-sup-worker-${idx}`,
      source: 'sup-node',
      target: `worker-node-${idx}`,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
    }));
  }, [selectedWorkers]);

  const addWorkerNode = (agentId: string) => {
    if (!agentId) return;
    setSelectedWorkers((prev) => [
      ...prev,
      {
        agent_id: agentId,
        execution_order: prev.length + 1,
        routing_condition: 'Always execute subtask',
      },
    ]);
  };

  const removeWorkerNode = (index: number) => {
    setSelectedWorkers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupervisorID) {
      setError('Please select a supervisor agent.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      await api.createWorkflow({
        name: workflowName,
        description,
        supervisor_agent_id: selectedSupervisorID,
        nodes: selectedWorkers,
      });
      router.push('/workflows');
    } catch (err: any) {
      setError(err.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workflows</span>
        </button>
        <h2 className="text-xl font-bold text-slate-100">Visual Workflow Builder</h2>
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Metadata */}
      <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Workflow Name
          </label>
          <input
            type="text"
            required
            placeholder="e.g. PR Automated Security Audit Team"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Select Supervisor Agent
          </label>
          <select
            value={selectedSupervisorID}
            onChange={(e) => setSelectedSupervisorID(e.target.value)}
            className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="">-- Choose Supervisor --</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.model_provider} / {s.model_name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* React Flow Interactive Graph */}
      <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 border-b border-[#1e293b] pb-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Hierarchical Topology Graph (React Flow Canvas)
          </h3>
          <div className="flex items-center space-x-2">
            <select
              id="worker-picker"
              className="bg-[#090d16] border border-[#1e293b] rounded-md text-xs text-slate-200 px-3 py-1.5"
              onChange={(e) => {
                if (e.target.value) {
                  addWorkerNode(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="">+ Connect Worker Agent</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.model_name})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-[420px] rounded-lg overflow-hidden border border-[#1e293b] bg-[#090d16]">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
            <Background color="#1e293b" gap={16} />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* Connected Workers Configuration List */}
      {selectedWorkers.length > 0 && (
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Worker Routing Conditions</h3>
          {selectedWorkers.map((w, idx) => {
            const agentObj = availableAgents.find((a) => a.id === w.agent_id);
            return (
              <div key={idx} className="flex items-center space-x-3 bg-[#090d16] p-3 rounded-lg border border-[#1e293b]">
                <span className="font-mono text-xs text-indigo-400 font-bold">#{idx + 1}</span>
                <span className="text-xs font-semibold text-slate-200 w-48 truncate">
                  {agentObj?.name}
                </span>
                <input
                  type="text"
                  placeholder="Routing condition prompt..."
                  value={w.routing_condition}
                  onChange={(e) => {
                    const newCond = e.target.value;
                    setSelectedWorkers((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, routing_condition: newCond } : item))
                    );
                  }}
                  className="flex-1 bg-[#111726] border border-[#1e293b] rounded px-3 py-1.5 text-xs text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => removeWorkerNode(idx)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-lg shadow-indigo-600/30 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving Workflow...' : 'Save Workflow'}</span>
        </button>
      </div>
    </form>
  );
}
