import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-zinc-400">
        <Icon aria-hidden className="h-6 w-6" />
      </span>
      <p className="font-semibold text-zinc-100">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-zinc-400">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
