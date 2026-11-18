import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  /** Smaller version for inside a card or panel (comments, a thread). */
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 text-center', compact ? 'py-6' : 'py-14')}>
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-fill text-ink-3',
          compact ? 'mb-2 h-9 w-9' : 'mb-4 h-12 w-12',
        )}
      >
        <Icon aria-hidden className={compact ? 'h-4 w-4' : 'h-6 w-6'} />
      </span>
      <p className={cn('font-semibold text-ink', compact && 'text-sm')}>{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
