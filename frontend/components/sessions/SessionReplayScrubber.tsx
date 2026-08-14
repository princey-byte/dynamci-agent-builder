'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';

interface SessionReplayScrubberProps {
  currentStepIndex: number;
  totalSteps: number;
  onStepChange: (index: number) => void;
}

export function SessionReplayScrubber({
  currentStepIndex,
  totalSteps,
  onStepChange,
}: SessionReplayScrubberProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1000); // ms per step

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        onStepChange((currentStepIndex + 1) % (totalSteps || 1));
      }, speed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentStepIndex, totalSteps, speed, onStepChange]);

  if (totalSteps <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-subtle bg-background-surface p-3.5 shadow-lg">
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={() => onStepChange(0)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title="Jump to Start"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => onStepChange(Math.max(0, currentStepIndex - 1))}
          disabled={currentStepIndex === 0}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 transition-colors"
          title="Previous Step"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105"
          title={isPlaying ? 'Pause Replay' : 'Play Replay'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={() => onStepChange(Math.min(totalSteps - 1, currentStepIndex + 1))}
          disabled={currentStepIndex >= totalSteps - 1}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 transition-colors"
          title="Next Step"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Timeline Slider */}
      <div className="flex flex-1 items-center space-x-3 min-w-[200px]">
        <input
          type="range"
          min={0}
          max={totalSteps - 1}
          value={currentStepIndex}
          onChange={(e) => onStepChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
        />
        <span className="font-mono text-xs font-semibold text-foreground whitespace-nowrap">
          Step {currentStepIndex + 1} / {totalSteps}
        </span>
      </div>

      {/* Speed Controls */}
      <div className="flex items-center space-x-1.5 text-[11px] font-mono">
        <span className="text-muted-foreground mr-1">Speed:</span>
        {[
          { label: '1x', ms: 1000 },
          { label: '2x', ms: 500 },
          { label: '4x', ms: 250 },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => setSpeed(opt.ms)}
            className={`rounded px-2 py-0.5 font-medium transition-colors ${
              speed === opt.ms
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
