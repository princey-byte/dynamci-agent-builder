'use client';

import React, { useState, useEffect } from 'react';
import { ConditionType, WorkflowEdgeData } from './types';
import { X, Check, Trash2 } from 'lucide-react';

interface EdgeConditionDrawerProps {
  edgeId: string | null;
  edgeData: WorkflowEdgeData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (edgeId: string, updated: WorkflowEdgeData) => void;
  onDelete?: (edgeId: string) => void;
}

export function EdgeConditionDrawer({
  edgeId,
  edgeData,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: EdgeConditionDrawerProps) {
  const [conditionType, setConditionType] = useState<ConditionType>('always');
  const [expression, setExpression] = useState('');
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (edgeData) {
      setConditionType(edgeData.condition_type || 'always');
      setExpression(edgeData.condition_expression || '');
      setLabel(edgeData.label || '');
    }
  }, [edgeData]);

  if (!isOpen || !edgeId) return null;

  const handleSave = () => {
    onSave(edgeId, {
      condition_type: conditionType,
      condition_expression: expression,
      label: label || conditionType,
    });
    onClose();
  };

  const handleDelete = () => {
    if (onDelete && edgeId) {
      onDelete(edgeId);
      onClose();
    }
  };

  return (
    <div className="absolute right-0 top-0 z-30 h-full w-84 border-l border-border-subtle bg-background-surface/98 p-5 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Routing Inspector</span>
          <h3 className="text-sm font-semibold text-foreground">Edge Condition</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-4 text-xs">
        <div>
          <label className="font-semibold uppercase tracking-wider text-foreground">Condition Type</label>
          <select
            value={conditionType}
            onChange={(e) => setConditionType(e.target.value as ConditionType)}
            className="mt-1.5 w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none"
          >
            <option value="always">Always (Unconditional)</option>
            <option value="rule_match">Rule / Keyword Match</option>
            <option value="llm_decision">LLM Semantic Router</option>
            <option value="fallback">Fallback (Else Branch)</option>
          </select>
        </div>

        {conditionType === 'rule_match' && (
          <div>
            <label className="font-semibold uppercase tracking-wider text-foreground">Rule Expression</label>
            <input
              type="text"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder='contains("URGENT") or regex("ERR_[0-9]+")'
              className="mt-1.5 w-full rounded-lg border border-border-subtle bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Examples: <code className="text-primary font-mono">contains(&quot;ERROR&quot;)</code> or <code className="text-primary font-mono">regex(&quot;PAYMENT_[A-Z]+&quot;)</code>
            </p>
          </div>
        )}

        {conditionType === 'llm_decision' && (
          <div>
            <label className="font-semibold uppercase tracking-wider text-foreground">Classification Prompt</label>
            <textarea
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="e.g. Query requires code execution and API validation"
              rows={3}
              className="mt-1.5 w-full resize-none rounded-lg border border-border-subtle bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              An LLM classifier will evaluate whether the parent output satisfies this criteria.
            </p>
          </div>
        )}

        {conditionType === 'fallback' && (
          <div className="rounded-lg border border-border-subtle bg-background p-3 text-muted-foreground">
            This branch executes only if no other outgoing conditional edges match.
          </div>
        )}

        <div>
          <label className="font-semibold uppercase tracking-wider text-foreground">Edge Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. If Code Error"
            className="mt-1.5 w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="space-y-2 pt-3">
          <button
            type="button"
            onClick={handleSave}
            className="flex w-full items-center justify-center space-x-2 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 shadow-md shadow-primary/20"
          >
            <Check className="h-4 w-4" />
            <span>Apply Condition</span>
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex w-full items-center justify-center space-x-2 rounded-lg border border-destructive/30 bg-destructive/10 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Connection Wire</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
