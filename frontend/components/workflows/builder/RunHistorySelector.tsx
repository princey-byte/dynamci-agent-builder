'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ExecutionSession } from '../../../lib/types';
import { History, ChevronDown, CheckCircle2, AlertCircle, Clock, Plus, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface RunHistorySelectorProps {
  sessions: ExecutionSession[];
  selectedSessionId: string | null;
  isNewRunMode: boolean;
  isRunning: boolean;
  onSelectSession: (sessionId: string) => void;
  onNewRun: () => void;
}

export function RunHistorySelector({
  sessions,
  selectedSessionId,
  isNewRunMode,
  isRunning,
  onSelectSession,
  onNewRun,
}: RunHistorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalSessions = sessions.length;
  const currentSelectedSession = sessions.find((s) => s.id === selectedSessionId);
  const currentRunIndex = currentSelectedSession
    ? totalSessions - sessions.findIndex((s) => s.id === selectedSessionId)
    : totalSessions;

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative inline-flex items-center gap-1.5" ref={dropdownRef}>
      {/* Run Selector Trigger Button */}
      <button
        type="button"
        disabled={isRunning}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 rounded-lg border border-border bg-card/80 px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-muted disabled:opacity-50 shadow-sm cursor-pointer"
      >
        <History className="h-3.5 w-3.5 text-primary" />
        <span className="truncate max-w-[180px]">
          {isNewRunMode || !currentSelectedSession
            ? '➕ New Test Run (Ready)'
            : `Run #${currentRunIndex} • ${formatTimestamp(currentSelectedSession.started_at)}`}
        </span>
        {currentSelectedSession && !isNewRunMode && (
          <span
            className={`h-2 w-2 rounded-full ${
              currentSelectedSession.status === 'COMPLETED'
                ? 'bg-agent-success'
                : currentSelectedSession.status === 'ERROR'
                ? 'bg-destructive'
                : 'bg-primary animate-ping'
            }`}
          />
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {/* Quick New Run Button */}
      <button
        type="button"
        disabled={isRunning || isNewRunMode}
        onClick={onNewRun}
        className="flex items-center space-x-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground disabled:opacity-40 shadow-sm cursor-pointer"
        title="Reset to fresh clean test run"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>New Run</span>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-80 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-2xl backdrop-blur animate-fade-in text-card-foreground">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/50 text-[11px] font-bold text-muted-foreground uppercase">
            <span>Execution History ({totalSessions})</span>
            <Link
              href="/sessions"
              className="flex items-center space-x-1 text-primary hover:underline text-[11px]"
            >
              <span>All Sessions</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-1 space-y-1">
            {/* New Run Option */}
            <button
              type="button"
              onClick={() => {
                onNewRun();
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                isNewRunMode
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Plus className="h-3.5 w-3.5" />
                <span>+ New Test Run (Clean State)</span>
              </div>
            </button>

            {/* List of Past Runs */}
            {sessions.map((sess, idx) => {
              const runNumber = totalSessions - idx;
              const isSelected = !isNewRunMode && selectedSessionId === sess.id;

              return (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => {
                    onSelectSession(sess.id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full flex-col rounded-lg p-2 text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-primary/15 border border-primary/40 text-foreground font-semibold'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      {sess.status === 'COMPLETED' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-agent-success" />
                      ) : sess.status === 'ERROR' ? (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-primary animate-spin" />
                      )}
                      <span className="font-bold">Run #{runNumber}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTimestamp(sess.started_at)}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground font-normal">
                    {sess.input_query || 'No query input'}
                  </p>
                </button>
              );
            })}

            {sessions.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No past executions yet. Click "Run Test" below to start.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
