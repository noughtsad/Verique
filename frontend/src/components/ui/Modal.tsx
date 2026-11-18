'use client';

import { ReactNode, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;
  // Rendered into <body>: inside a card, `backdrop-blur` and `overflow-hidden` would pin a
  // fixed dialog to the card and clip it. React still bubbles events through the component
  // tree, so clicks are stopped here before they reach whatever opened the dialog.
  return createPortal(
    <div
      onClick={(event) => event.stopPropagation()}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-overlay p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-6 shadow-2xl animate-scale-in sm:max-w-md sm:rounded-2xl',
          className,
        )}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold text-ink">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-ink-3 hover:bg-fill-strong hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
