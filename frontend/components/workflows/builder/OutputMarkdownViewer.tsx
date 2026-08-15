'use client';

import React, { useState } from 'react';
import { Copy, Check, Sparkles, AlertCircle } from 'lucide-react';

interface OutputMarkdownViewerProps {
  output: string | null;
  status: 'idle' | 'running' | 'completed' | 'error';
}

export function OutputMarkdownViewer({ output, status }: OutputMarkdownViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'running') {
    return (
      <div className="flex h-48 flex-col items-center justify-center space-y-2 text-muted-foreground">
        <Sparkles className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs font-mono">Synthesizing final workflow output from worker agents...</p>
      </div>
    );
  }

  if (status === 'error' && !output) {
    return (
      <div className="flex h-48 flex-col items-center justify-center space-y-2 text-destructive">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-xs font-mono">Execution failed. Check the Live Trace tab for error details.</p>
      </div>
    );
  }

  if (!output) {
    return (
      <div className="flex h-48 items-center justify-center text-xs font-mono text-muted-foreground">
        No output generated yet. Enter a task query and run the workflow to inspect results.
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Final Synthesized Output</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center space-x-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-agent-success" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="prose prose-invert max-w-none text-xs font-sans whitespace-pre-wrap leading-relaxed text-foreground">
        {output}
      </div>
    </div>
  );
}
