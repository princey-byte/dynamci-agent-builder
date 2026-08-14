'use client';

import React from 'react';
import { Agent } from '../../../lib/types';
import { Cpu, X, Plus, Sparkles, Wrench } from 'lucide-react';
import { Badge } from '../../ui/badge';

interface QuickAttachModalProps {
  isOpen: boolean;
  parentSourceId: string | null;
  availableWorkers: Agent[];
  onClose: () => void;
  onSelectWorker: (agentId: string, parentSourceId: string) => void;
}

export function QuickAttachModal({
  isOpen,
  parentSourceId,
  availableWorkers,
  onClose,
  onSelectWorker,
}: QuickAttachModalProps) {
  if (!isOpen || !parentSourceId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border-subtle bg-background-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Connect Downstream</span>
            <h3 className="text-sm font-bold text-foreground">Attach Child Worker Agent</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
          {availableWorkers.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              All worker agents are already attached to the workflow.
            </p>
          ) : (
            availableWorkers.map((worker) => (
              <div
                key={worker.id}
                onClick={() => {
                  onSelectWorker(worker.id, parentSourceId);
                  onClose();
                }}
                className="group flex cursor-pointer items-center justify-between rounded-xl border border-border-subtle bg-background p-3 transition-all hover:border-primary hover:bg-primary/5 hover:shadow-md"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground group-hover:bg-primary/20 group-hover:text-primary">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{worker.name}</h4>
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

                <div className="flex items-center space-x-2">
                  <Badge variant={worker.model_provider as 'openai' | 'azure_openai' | 'anthropic' | 'gemini'}>
                    {worker.model_name}
                  </Badge>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Plus className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
