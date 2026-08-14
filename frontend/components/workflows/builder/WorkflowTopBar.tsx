'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, LayoutGrid, Info } from 'lucide-react';

interface WorkflowTopBarProps {
  workflowName: string;
  description: string;
  saving: boolean;
  canSave: boolean;
  onWorkflowNameChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onAutoLayout: () => void;
  onSave: (e: React.FormEvent) => void;
}

export function WorkflowTopBar({
  workflowName,
  description,
  saving,
  canSave,
  onWorkflowNameChange,
  onDescriptionChange,
  onAutoLayout,
  onSave,
}: WorkflowTopBarProps) {
  const router = useRouter();
  const [showDescModal, setShowDescModal] = useState(false);

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-border-subtle bg-background-surface/95 px-5 backdrop-blur">
      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center space-x-1.5 rounded-lg border border-border-subtle bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back</span>
        </button>

        <div className="h-4 w-px bg-border-subtle" />

        <div className="flex items-center space-x-2">
          <input
            type="text"
            required
            placeholder="Untitled Workflow (Click to edit)..."
            value={workflowName}
            onChange={(e) => onWorkflowNameChange(e.target.value)}
            className="w-64 md:w-80 rounded-lg border border-transparent bg-transparent px-2.5 py-1 text-sm font-bold text-foreground transition-colors hover:border-border-subtle focus:border-primary focus:bg-background focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setShowDescModal(!showDescModal)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Edit Description"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onAutoLayout}
          className="flex items-center space-x-1.5 rounded-lg border border-border-subtle bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground shadow-sm"
          title="Cleanly arrange nodes into hierarchical tiers"
        >
          <LayoutGrid className="h-3.5 w-3.5 text-primary" />
          <span>Auto-Layout</span>
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saving || !canSave}
          className="flex items-center space-x-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          <span>{saving ? 'Saving...' : 'Save Workflow'}</span>
        </button>
      </div>

      {showDescModal && (
        <div className="absolute left-32 top-14 z-30 w-96 rounded-xl border border-border-subtle bg-background-surface p-4 shadow-2xl backdrop-blur">
          <label className="text-xs font-semibold uppercase tracking-wider text-foreground">Workflow Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe what goal this multi-agent workflow coordinates..."
            className="mt-2 w-full resize-none rounded-lg border border-border-subtle bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowDescModal(false)}
              className="rounded-lg bg-secondary px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary/80"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
