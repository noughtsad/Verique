import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong. Try again.';
}

export function ErrorBanner({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200',
        className,
      )}
    >
      <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">{errorText(error)}</p>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-semibold text-rose-100 underline-offset-2 hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}
