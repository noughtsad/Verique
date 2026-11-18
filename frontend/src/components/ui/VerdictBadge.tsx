import { Verdict } from '@/lib/types';
import { cn } from '@/lib/utils';

export const VERDICT_LABEL: Record<Verdict, string> = {
  strongly_supported: 'Strongly supported',
  supported: 'Supported',
  mixed: 'Mixed',
  weak: 'Weak evidence',
  contradicted: 'Contradicted',
  outdated: 'Outdated',
  not_verifiable: 'Not verifiable',
};

// Colours live in globals.css (.verdict-*): a tint of the verdict's colour with a
// per-theme ink that clears 4.5:1 on both the dark and the light surface.
const VERDICT_CLASS: Record<Verdict, string> = {
  strongly_supported: 'verdict-good',
  supported: 'verdict-good',
  mixed: 'verdict-mixed',
  weak: 'verdict-weak',
  contradicted: 'verdict-bad',
  outdated: 'verdict-outdated',
  not_verifiable: 'verdict-none',
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  return <span className={cn('verdict', VERDICT_CLASS[verdict], className)}>{VERDICT_LABEL[verdict]}</span>;
}
