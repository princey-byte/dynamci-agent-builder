'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, ChevronUp, ChevronDown, Terminal, Clock, FileText, Trash2, Loader2 } from 'lucide-react';
import { SSELogEvent } from '../../../lib/types';
import { EventRenderer } from '../../console/EventRenderer';
import { SSEStatusPill } from '../../console/SSEStatusPill';
import { OutputMarkdownViewer } from './OutputMarkdownViewer';
import { SessionReplayScrubber } from '../../sessions/SessionReplayScrubber';

interface CanvasExecutionDrawerProps {
  logs: SSELogEvent[];
  status: 'idle' | 'running' | 'completed' | 'error';
  finalOutput: string | null;
  query: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  onQueryChange: (q: string) => void;
  onRun: (e: React.FormEvent) => void;
  onClearLogs: () => void;
}

export function CanvasExecutionDrawer({
  logs,
  status,
  finalOutput,
  query,
  isOpen,
  onToggleOpen,
  onQueryChange,
  onRun,
  onClearLogs,
}: CanvasExecutionDrawerProps) {
  const [activeTab, setActiveTab] = useState<'stream' | 'timeline' | 'output'>('stream');
  const [scrubbedStep, setScrubbedStep] = useState<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-switch to output tab upon completion if output exists
  useEffect(() => {
    if (status === 'completed' && finalOutput) {
      setActiveTab('output');
    }
  }, [status, finalOutput]);

  // Scroll down when new logs arrive in stream tab
  useEffect(() => {
    if (activeTab === 'stream' && isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab, isOpen]);

  // Update scrubber step count
  useEffect(() => {
    if (logs.length > 0) {
      setScrubbedStep(logs.length - 1);
    }
  }, [logs.length]);

  return (
    <div
      className={`absolute inset-x-6 bottom-4 z-40 flex flex-col rounded-2xl border border-border bg-card/98 shadow-2xl backdrop-blur transition-all duration-300 ${
        isOpen ? 'h-[440px]' : 'h-14'
      }`}
    >
      {/* Header Dock Bar */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-border/80">
        <form onSubmit={onRun} className="flex flex-1 items-center space-x-3 mr-4">
          <input
            type="text"
            required
            placeholder="Type task query to test run workflow (e.g. Audit security compliance for PR #104)..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            disabled={status === 'running'}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none shadow-sm"
          />
          <button
            type="submit"
            disabled={status === 'running' || !query.trim()}
            className="flex items-center space-x-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            {status === 'running' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span>{status === 'running' ? 'Executing...' : 'Run Test'}</span>
          </button>
        </form>

        <div className="flex items-center space-x-2 border-l border-border pl-4">
          <SSEStatusPill status={status} />
          <button
            type="button"
            onClick={onToggleOpen}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title={isOpen ? 'Minimize Console' : 'Expand Console'}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Console Body */}
      {isOpen && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-border px-4 py-1.5 bg-secondary/30">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('stream')}
                className={`flex items-center space-x-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  activeTab === 'stream'
                    ? 'bg-card text-primary shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Live Trace ({logs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center space-x-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  activeTab === 'timeline'
                    ? 'bg-card text-primary shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Step Scrubber</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('output')}
                className={`flex items-center space-x-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  activeTab === 'output'
                    ? 'bg-card text-primary shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Final Output</span>
              </button>
            </div>

            {logs.length > 0 && (
              <button
                type="button"
                onClick={onClearLogs}
                className="flex items-center space-x-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear Logs</span>
              </button>
            )}
          </div>

          {/* Tab Views */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-foreground">
            {activeTab === 'stream' && (
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
                    <Terminal className="h-6 w-6 mb-2 opacity-40" />
                    <p>Ready to execute. Enter a query above and click "Run Test".</p>
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <EventRenderer key={`${log.session_id}-${log.step}-${index}`} log={log} />
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <SessionReplayScrubber
                  currentStepIndex={scrubbedStep}
                  totalSteps={logs.length}
                  onStepChange={setScrubbedStep}
                />
                <div className="space-y-2">
                  {logs.slice(0, scrubbedStep + 1).map((log, index) => (
                    <EventRenderer key={`scrubbed-${index}`} log={log} />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'output' && (
              <OutputMarkdownViewer output={finalOutput} status={status} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
