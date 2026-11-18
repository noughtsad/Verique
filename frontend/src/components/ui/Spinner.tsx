import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-ink-3">
      <Loader2 aria-hidden className={cn('h-5 w-5 animate-spin text-accent', className)} />
      <span className={label ? 'text-sm' : 'sr-only'}>{label ?? 'Loading'}</span>
    </span>
  );
}

export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex justify-center py-16">
      <Spinner label={label} />
    </div>
  );
}
