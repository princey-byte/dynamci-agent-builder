'use client';

import React, { useState } from 'react';
import { Agent } from '../../../lib/types';
import { Bot, Cpu, Search, Sparkles, Wrench, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Badge } from '../../ui/badge';

interface AgentPaletteSidebarProps {
  supervisors: Agent[];
  workers: Agent[];
  selectedSupervisorId: string;
  selectedWorkerIds: Set<string>;
  onSelectSupervisor: (agentId: string) => void;
  onAddWorker: (agentId: string) => void;
}

export function AgentPaletteSidebar({
  supervisors,
  workers,
  selectedSupervisorId,
  selectedWorkerIds,
  onSelectSupervisor,
  onAddWorker,
}: AgentPaletteSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [search, setSearch] = useState('');

  const filteredSupervisors = supervisors.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredWorkers = workers.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside
      className={`absolute bottom-4 left-4 top-18 z-20 flex flex-col rounded-2xl border border-border-subtle bg-background-surface/98 shadow-2xl backdrop-blur transition-all duration-300 ${
        isCollapsed ? 'w-12' : 'w-80'
      }`}
    >
      <div className="flex h-12 items-center justify-between border-b border-border-subtle px-3.5">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Agent Library</h3>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground mx-auto"
          title={isCollapsed ? 'Expand Agent Library' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex flex-1 flex-col overflow-hidden p-3.5 space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-background py-1.5 pl-8 pr-3 text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {/* Supervisors Section */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Supervisors</span>
              <div className="mt-1.5 space-y-2">
                {filteredSupervisors.map((supervisor) => {
                  const isSelected = selectedSupervisorId === supervisor.id;
                  return (
                    <div
                      key={supervisor.id}
                      onClick={() => onSelectSupervisor(supervisor.id)}
                      className={`group flex cursor-pointer items-center justify-between rounded-xl border p-2.5 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border-subtle bg-background hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-foreground">{supervisor.name}</h4>
                          <span className="text-[10px] text-muted-foreground">{supervisor.model_name}</span>
                        </div>
                      </div>
                      <Badge variant={isSelected ? 'default' : 'outline'}>
                        {isSelected ? 'Active Root' : 'Set Root'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Workers Section */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Workers</span>
              <div className="mt-1.5 space-y-2">
                {filteredWorkers.map((worker) => {
                  const isAttached = selectedWorkerIds.has(worker.id);
                  return (
                    <div
                      key={worker.id}
                      className="group flex items-center justify-between rounded-xl border border-border-subtle bg-background p-2.5 transition-all hover:border-border-strong"
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-foreground">
                          <Cpu className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-foreground">{worker.name}</h4>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Wrench className="h-2.5 w-2.5 text-agent-tool" /> {worker.mcp_tools?.length || 0}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Sparkles className="h-2.5 w-2.5 text-primary" /> {worker.skills?.length || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onAddWorker(worker.id)}
                        disabled={isAttached}
                        className="flex items-center space-x-1 rounded-lg border border-border-subtle bg-background-surface px-2 py-1 text-[10px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3" />
                        <span>{isAttached ? 'Added' : 'Add Node'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
