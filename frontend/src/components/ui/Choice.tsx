'use client';

import { KeyboardEvent, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A small set of mutually exclusive options shown as tiles (a radio group). */
export function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon: LucideIcon }[];
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move the selection, as in a native radio group.
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-3">
      {options.map((option, index) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-md border px-3 py-4 text-sm font-medium transition-colors',
              selected ? 'border-accent bg-accent/10 text-ink ring-1 ring-accent' : 'border-line bg-surface text-ink-3 hover:bg-fill hover:text-ink',
            )}
          >
            <Icon aria-hidden className="h-5 w-5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
