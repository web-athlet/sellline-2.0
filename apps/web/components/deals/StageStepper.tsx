'use client';

import { cn } from '@nextgen/utils';
import type { Stage } from '@/lib/deals-api';

interface Props {
  stages: Stage[];
  currentStageId: string;
  onChange: (stageId: string) => void;
  disabled?: boolean;
}

export function StageStepper({ stages, currentStageId, onChange, disabled }: Props) {
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const currentIndex = ordered.findIndex((s) => s.id === currentStageId);

  return (
    <ol data-testid="stage-stepper" className="flex flex-wrap items-center gap-1.5">
      {ordered.map((stage, idx) => {
        const isCurrent = stage.id === currentStageId;
        const isPast = idx < currentIndex;
        return (
          <li key={stage.id} className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(stage.id)}
              className={cn(
                'rounded-button px-2.5 py-1 text-xs font-medium transition-colors',
                isCurrent && 'bg-indigo-600 text-white',
                !isCurrent && isPast && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
                !isCurrent && !isPast && 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                disabled && 'cursor-not-allowed opacity-60',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {stage.name}
            </button>
            {idx < ordered.length - 1 && (
              <span aria-hidden="true" className="text-slate-300">
                ›
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
