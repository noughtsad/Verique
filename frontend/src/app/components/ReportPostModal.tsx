'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, Flag, Loader2, X } from 'lucide-react';

import { reportPost } from '@/lib/api';
import { REPORT_REASONS, ReportReasonCode } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Instagram-style report dialog: pick a reason, optionally add details, submit.
 * Rendered in a portal so it isn't clipped by the post card or triggers its click handler.
 */
export function ReportPostModal({
  postId,
  authorUsername,
  onClose,
}: {
  postId: number;
  authorUsername: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReasonCode | null>(null);
  const [details, setDetails] = useState('');

  const mutation = useMutation({
    mutationFn: () => reportPost(postId, { reason_code: reason!, details: details.trim() || undefined }),
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        // Portal events still bubble through the React tree to the post card's onClick.
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Report post"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-white/10 bg-[#18181b] shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="relative flex items-center justify-center border-b border-white/10 px-5 py-4">
          <h2 className="text-[15px] font-bold text-white">Report</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {mutation.isSuccess ? (
          <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Thanks for letting us know</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              We&apos;ll review your report on @{authorUsername}&apos;s post and take action if it breaks the rules.
              They won&apos;t be told who reported it.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col">
            <div className="overflow-y-auto">
              <p className="px-5 pb-2 pt-4 text-[15px] font-bold text-white">Why are you reporting this post?</p>
              <p className="px-5 pb-3 text-xs text-slate-400">The author won&apos;t be told who reported their post.</p>
              <ul role="radiogroup" aria-label="Reason for report">
                {REPORT_REASONS.map((r) => {
                  const selected = reason === r.code;
                  return (
                    <li key={r.code}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setReason(r.code)}
                        className={cn(
                          'flex w-full items-center gap-3 border-t border-white/10 px-5 py-3.5 text-left transition hover:bg-white/5',
                          selected && 'bg-white/5',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-100">{r.label}</span>
                          {selected && <span className="mt-0.5 block text-xs text-slate-400">{r.hint}</span>}
                        </span>
                        <span
                          className={cn(
                            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition',
                            selected ? 'border-blue-500 bg-blue-500' : 'border-white/20',
                          )}
                        >
                          {selected ? (
                            <span className="h-2 w-2 rounded-full bg-white" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {reason && (
                <div className="border-t border-white/10 px-5 py-4">
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    maxLength={500}
                    placeholder="Add more details (optional)"
                    className="h-20 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500/50"
                  />
                </div>
              )}
            </div>

            <div className="border-t border-white/10 px-5 py-4">
              {mutation.error instanceof Error && (
                <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">
                  {mutation.error.message}
                </div>
              )}
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={!reason || mutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                {mutation.isPending ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
