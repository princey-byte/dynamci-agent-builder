'use client';

import { Agent } from '../../../lib/types';
import { SelectedWorker } from './types';

interface WorkflowControlsPanelProps {
  workflowName: string;
  description: string;
  selectedSupervisorID: string;
  selectedWorkers: SelectedWorker[];
  supervisors: Agent[];
  workers: Agent[];
  availableWorkerOptions: Agent[];
  availableAgents: Agent[];
  onWorkflowNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSupervisorChange: (value: string) => void;
  onAddWorker: (agentID: string) => void;
  onRemoveWorker: (index: number) => void;
  onWorkerRoutingChange: (index: number, value: string) => void;
}

export function WorkflowControlsPanel({
  workflowName,
  description,
  selectedSupervisorID,
  selectedWorkers,
  supervisors,
  workers,
  availableWorkerOptions,
  availableAgents,
  onWorkflowNameChange,
  onDescriptionChange,
  onSupervisorChange,
  onAddWorker,
  onRemoveWorker,
  onWorkerRoutingChange,
}: WorkflowControlsPanelProps) {
  return (
    <aside className="absolute bottom-5 left-5 top-20 z-20 w-[min(360px,calc(100vw-2.5rem))] overflow-y-auto rounded-xl border border-border-subtle bg-background-surface/95 p-4 shadow-2xl backdrop-blur">
      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">Workflow</p>
          <h1 className="mt-1 text-lg font-bold text-slate-100">Build agent topology</h1>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">Workflow Name</label>
            <input
              type="text"
              required
              placeholder="e.g. PR Automated Security Audit Team"
              value={workflowName}
              onChange={(event) => onWorkflowNameChange(event.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">Description</label>
            <textarea
              rows={3}
              placeholder="What should this workflow coordinate?"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              className="w-full resize-none rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">Supervisor Agent</label>
            <select
              value={selectedSupervisorID}
              onChange={(event) => onSupervisorChange(event.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">-- Choose Supervisor --</option>
              {supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.name} ({supervisor.model_provider} / {supervisor.model_name})
                </option>
              ))}
            </select>
            {supervisors.length === 0 && (
              <p className="mt-2 text-xs text-amber-300">Create an agent with role_type supervisor before saving a workflow.</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">Add Worker Agent</label>
            <select
              id="worker-picker"
              className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              onChange={(event) => {
                if (event.target.value) {
                  onAddWorker(event.target.value);
                  event.target.value = '';
                }
              }}
            >
              <option value="">+ Connect Worker Agent</option>
              {availableWorkerOptions.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} ({worker.model_name})
                </option>
              ))}
            </select>
            {workers.length === 0 && (
              <p className="mt-2 text-xs text-amber-300">Create worker agents before adding workflow nodes.</p>
            )}
          </div>
        </div>

        {selectedWorkers.length > 0 && (
          <div className="space-y-3 border-t border-border-subtle pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Worker Routing</h3>
            {selectedWorkers.map((worker, index) => {
              const agent = availableAgents.find((item) => item.id === worker.agent_id);
              return (
                <div key={worker.agent_id} className="rounded-lg border border-border-subtle bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-slate-200">#{index + 1} {agent?.name}</span>
                    <button type="button" onClick={() => onRemoveWorker(index)} className="text-xs text-red-400 hover:text-red-300">
                      Remove
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Routing condition prompt..."
                    value={worker.routing_condition}
                    onChange={(event) => onWorkerRoutingChange(index, event.target.value)}
                    className="w-full rounded border border-border-subtle bg-background-surface px-2 py-1.5 text-xs text-slate-200"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}