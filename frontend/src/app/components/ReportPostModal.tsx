'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Flag } from 'lucide-react';

import { reportPost } from '@/lib/api';
import { REPORT_REASONS, ReportReasonCode } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { inputClass } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

/** Report a post: pick a reason, optionally add details, submit. */
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

  if (mutation.isSuccess) {
    return (
      <Modal open onClose={onClose} title="Report sent">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 aria-hidden className="h-10 w-10 text-success-ink" />
          <p className="text-sm leading-relaxed text-ink-3">
            We&apos;ll review your report on @{authorUsername}&apos;s post and act on it if it breaks the rules. They
            won&apos;t be told who reported it.
          </p>
          <Button className="mt-2 w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Report post">
      <p className="text-sm text-ink-3">Why are you reporting this post? The author won&apos;t be told who reported it.</p>
      <ul role="radiogroup" aria-label="Reason for report" className="mt-4 overflow-hidden rounded-lg border border-line">
        {REPORT_REASONS.map((r) => {
          const selected = reason === r.code;
          return (
            <li key={r.code} className="border-t border-line first:border-t-0">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setReason(r.code)}
                className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-fill', selected && 'bg-fill')}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    selected ? 'border-accent bg-accent' : 'border-ink-muted',
                  )}
                >
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-accent-ink" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{r.label}</span>
                  {selected && <span className="mt-0.5 block text-xs text-ink-3">{r.hint}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {reason && (
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Add more details (optional)"
          aria-label="Details"
          className={`${inputClass} mt-4 resize-none`}
        />
      )}

      {mutation.isError && <ErrorBanner error={mutation.error} className="mt-4" />}
      <Button
        variant="danger"
        className="mt-5 w-full"
        onClick={() => mutation.mutate()}
        disabled={!reason}
        loading={mutation.isPending}
      >
        {!mutation.isPending && <Flag aria-hidden className="h-4 w-4" />}
        {mutation.isPending ? 'Sending report…' : 'Send report'}
      </Button>
    </Modal>
  );
}
