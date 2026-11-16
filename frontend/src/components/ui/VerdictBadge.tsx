import { Verdict } from '@/lib/types';
import { cn } from '@/lib/utils';

export const VERDICT_LABEL: Record<Verdict, string> = {
  strongly_supported: 'Strongly supported',
  supported: 'Supported',
  mixed: 'Mixed evidence',
  weak: 'Weak evidence',
  contradicted: 'Contradicted',
  outdated: 'Outdated',
  not_verifiable: 'Not verifiable',
};

const VERDICT_CLASS: Record<Verdict, string> = {
  strongly_supported: 'bg-emerald-400/15 text-emerald-200 ring-emerald-400/30',
  supported: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25',
  mixed: 'bg-amber-400/10 text-amber-200 ring-amber-400/30',
  weak: 'bg-orange-400/10 text-orange-200 ring-orange-400/30',
  contradicted: 'bg-rose-400/10 text-rose-200 ring-rose-400/30',
  outdated: 'bg-violet-400/10 text-violet-200 ring-violet-400/30',
  not_verifiable: 'bg-white/5 text-zinc-300 ring-white/15',
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        VERDICT_CLASS[verdict],
        className,
      )}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  );
}
