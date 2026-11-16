'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, RefreshCw, ShieldCheck, TriangleAlert, UserCheck } from 'lucide-react';
import { verifyPost } from '@/lib/api';
import { updatePost } from '@/lib/postCache';
import { Post, PostVerification, PostVerificationSummary } from '@/lib/types';
import { isFailedVerification, isUnverifiableVerification } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { ScoreMeter } from '@/components/ui/ScoreMeter';
import { errorText } from '@/components/ui/ErrorBanner';

export function toSummary(v: PostVerification): PostVerificationSummary {
  return {
    id: v.id,
    status: v.status,
    score: v.score,
    summary: v.summary,
    challenge_count: v.challenge_count,
    review_status: v.review_status,
    final_decision: v.final_decision,
    final_decision_note: v.final_decision_note,
    is_human_final: v.is_human_final,
    created_at: v.created_at,
  };
}

/** Runs a verification and writes the result into every cached copy of the post. */
export function useVerifyPost(postId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => verifyPost(postId),
    onSuccess: (verification) => {
      queryClient.setQueryData(['verification', postId], verification);
      updatePost(queryClient, postId, (p) => ({
        ...p,
        latest_verification_summary: toSummary(verification),
        challenge_state: verification.review_status,
      }));
    },
  });
}

const chip = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold';

/** The verification row on a post card: Verify button, score, or why there's no score. */
export function VerifyStatus({ post, signedIn, showDetailsLink = true }: { post: Post; signedIn: boolean; showDetailsLink?: boolean }) {
  const verify = useVerifyPost(post.id);
  const v = post.latest_verification_summary;
  const detailsLink = showDetailsLink && (
    <Link href={`/post/${post.id}`} className="text-sm font-semibold text-blue-400 hover:text-blue-300">
      See the fact-check
    </Link>
  );

  let body: React.ReactNode;
  if (verify.isPending) {
    body = (
      <span className={`${chip} bg-accent/10 text-blue-300`}>
        <RefreshCw aria-hidden className="h-3.5 w-3.5 animate-spin" /> Checking claims — this takes about a minute
      </span>
    );
  } else if (!v) {
    body = signedIn ? (
      <Button size="sm" variant="secondary" onClick={() => verify.mutate()}>
        <ShieldCheck aria-hidden className="h-4 w-4 text-blue-400" /> Verify
      </Button>
    ) : (
      <span className="text-sm text-zinc-500">Not fact-checked yet</span>
    );
  } else if (isFailedVerification(v)) {
    body = (
      <>
        <span className={`${chip} bg-rose-500/10 text-rose-300`}>
          <TriangleAlert aria-hidden className="h-3.5 w-3.5" /> Verification failed
        </span>
        {signedIn && (
          <Button size="sm" variant="ghost" onClick={() => verify.mutate()}>
            Try again
          </Button>
        )}
      </>
    );
  } else if (isUnverifiableVerification(v)) {
    body = (
      <>
        <span className={`${chip} bg-white/5 text-zinc-300`}>
          <HelpCircle aria-hidden className="h-3.5 w-3.5" /> Opinion — no factual claims
        </span>
        {detailsLink}
      </>
    );
  } else {
    body = (
      <>
        {v.score !== null && v.score !== undefined && <ScoreMeter score={v.score} />}
        {v.is_human_final && (
          <span className={`${chip} bg-blue-500/10 text-blue-300`}>
            <UserCheck aria-hidden className="h-3.5 w-3.5" /> Reviewed by a moderator
          </span>
        )}
        {v.review_status === 'open' && <span className={`${chip} bg-amber-400/10 text-amber-300`}>Under review</span>}
        {detailsLink}
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">{body}</div>
      {verify.isError && <p className="text-sm text-rose-300">{errorText(verify.error)}</p>}
    </div>
  );
}
