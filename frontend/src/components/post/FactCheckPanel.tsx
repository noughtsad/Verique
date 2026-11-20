'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Globe, HelpCircle, ShieldCheck, TriangleAlert, UserCheck } from 'lucide-react';

import { challengeVerification, getLatestPostVerification, resolveModerationReview } from '@/lib/api';
import { CHALLENGE_REASONS, isStaff, MODERATION_KEY, useOpenReviews } from '@/lib/moderation';
import { updatePost } from '@/lib/postCache';
import { ClaimResult, ModerationReview, Post, PostVerification, ReviewDecision, SourceInfo, User } from '@/lib/types';
import { getDomainFromUrl, isFailedVerification, isUnverifiableVerification } from '@/lib/utils';
import { toSummary, useVerifyPost } from '@/components/post/VerifyStatus';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScoreMeter } from '@/components/ui/ScoreMeter';
import { Spinner } from '@/components/ui/Spinner';
import { VerdictBadge } from '@/components/ui/VerdictBadge';
import { inputClass } from '@/components/ui/Input';

const DECISION_LABEL: Record<string, string> = {
  uphold: 'A moderator upheld this verdict',
  revise: 'A moderator revised this verdict',
  remove_verdict: 'A moderator removed this verdict',
};

const field = inputClass;

function Sources({ title, sources }: { title: string; sources: SourceInfo[] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-ink-3">{title}</h4>
      <ul className="space-y-2">
        {sources.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-line bg-fill p-3 hover:bg-fill-strong"
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-link">
                <Globe aria-hidden className="h-3.5 w-3.5" /> {getDomainFromUrl(source.url)}
              </span>
              <span className="mt-1 line-clamp-2 block text-sm text-ink-2">{source.snippet}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClaimCard({ claim }: { claim: ClaimResult }) {
  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <VerdictBadge verdict={claim.verdict} />
        <span className="text-xs text-ink-muted">{Math.round(claim.confidence * 100)}% confidence</span>
      </div>
      <p className="font-semibold leading-relaxed text-ink">{claim.text}</p>
      <p className="text-sm leading-relaxed text-ink-2">{claim.reasoning}</p>
      {!!claim.caveats?.length && (
        <ul className="list-disc space-y-1 rounded-lg border border-amber-400/20 bg-amber-400/5 py-2.5 pl-8 pr-3 text-sm text-warning-ink">
          {claim.caveats.map((caveat, i) => (
            <li key={i}>{caveat}</li>
          ))}
        </ul>
      )}
      {claim.sources.supporting.length > 0 && <Sources title="Supporting sources" sources={claim.sources.supporting} />}
      {claim.sources.contradicting.length > 0 && <Sources title="Contradicting sources" sources={claim.sources.contradicting} />}
    </Card>
  );
}

function Summary({ v, onRetry, retrying, signedIn }: { v: PostVerification; onRetry: () => void; retrying: boolean; signedIn: boolean }) {
  if (isFailedVerification(v)) {
    return (
      <Card className="space-y-3 border-rose-500/30 p-5">
        <p className="flex items-center gap-2 font-semibold text-danger-ink">
          <TriangleAlert aria-hidden className="h-5 w-5" /> This post couldn&apos;t be checked
        </p>
        <p className="text-sm text-ink-2">{v.final_decision_note || 'Something went wrong while checking. Try again.'}</p>
        {signedIn && (
          <Button variant="secondary" onClick={onRetry} loading={retrying}>
            Try again
          </Button>
        )}
      </Card>
    );
  }
  if (isUnverifiableVerification(v)) {
    return (
      <Card className="space-y-2 p-5">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <HelpCircle aria-hidden className="h-5 w-5 text-ink-3" /> No factual claims to check
        </p>
        <p className="text-sm text-ink-3">
          {v.final_decision_note ||
            'Verique scores only claims that can be checked against evidence. Opinions and personal feelings get no score.'}
        </p>
      </Card>
    );
  }
  return (
    <Card className="space-y-4 p-5">
      {v.score !== null && v.score !== undefined && <ScoreMeter score={v.score} size="hero" />}
      <p className="text-sm text-ink-3">
        Verique score, from {v.claims.length} checked {v.claims.length === 1 ? 'claim' : 'claims'}
      </p>
      {v.is_human_final && v.final_decision && (
        <p className="flex items-center gap-1.5 text-sm text-link">
          <UserCheck aria-hidden className="h-4 w-4" /> {DECISION_LABEL[v.final_decision] ?? 'Reviewed by a moderator'}
        </p>
      )}
      {v.is_human_final && v.final_decision_note && <p className="text-sm text-ink-2">“{v.final_decision_note}”</p>}
      {v.human_summary && <p className="text-sm text-ink-2">{v.human_summary}</p>}
    </Card>
  );
}

function ChallengeForm({ v, postId }: { v: PostVerification; postId: number }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<string>(CHALLENGE_REASONS[0][0]);
  const [comment, setComment] = useState('');
  const challenge = useMutation({
    mutationFn: () => challengeVerification(v.id, { reason_code: reason, comment: comment.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: MODERATION_KEY });
    },
  });

  if (challenge.isSuccess || v.review_status === 'open') {
    return (
      <Card className="flex items-start gap-3 p-5 text-sm text-ink-2">
        <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-success-ink" />
        <p>
          {challenge.isSuccess ? 'Challenge sent. ' : ''}A moderator is reviewing this verdict. The result shows here once
          they decide.
        </p>
      </Card>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    challenge.mutate();
  };
  return (
    <Card className="p-5">
      <h3 className="font-bold text-ink">Think this verdict is wrong?</h3>
      <p className="mt-1 text-sm text-ink-3">Challenge it and a moderator will review the evidence.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-sm text-ink-2">
          Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} mt-1.5`}>
            {CHALLENGE_REASONS.map(([value, label]) => (
              <option key={value} value={value} className="bg-surface">
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-ink-2">
          What&apos;s wrong with it? <span className="text-ink-muted">(optional)</span>
          <textarea value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} rows={3} className={`${field} mt-1.5 resize-none`} />
        </label>
        {challenge.isError && <ErrorBanner error={challenge.error} />}
        <Button type="submit" loading={challenge.isPending}>
          Send challenge
        </Button>
      </form>
    </Card>
  );
}

function ResolveForm({ review, postId }: { review: ModerationReview; postId: number }) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<ReviewDecision>('uphold');
  const [note, setNote] = useState('');
  const [score, setScore] = useState('');
  const resolve = useMutation({
    mutationFn: () =>
      resolveModerationReview(review.id, { decision, note: note.trim(), override_score: score === '' ? undefined : Number(score) }),
    onSuccess: (resolved) => {
      queryClient.setQueryData(['verification', postId], resolved.verification);
      updatePost(queryClient, postId, (p) => ({ ...p, latest_verification_summary: toSummary(resolved.verification) }));
      queryClient.invalidateQueries({ queryKey: MODERATION_KEY });
    },
  });
  const scoreValid = score === '' || (Number(score) >= 0 && Number(score) <= 100);

  return (
    <Card className="space-y-3 border-amber-400/30 p-5">
      <h3 className="font-bold text-ink">Resolve this challenge</h3>
      <p className="text-sm text-ink-3">
        Challenged {review.verification.challenge_count} {review.verification.challenge_count === 1 ? 'time' : 'times'}.
      </p>
      <select value={decision} onChange={(e) => setDecision(e.target.value as ReviewDecision)} className={field} aria-label="Decision">
        <option value="uphold" className="bg-surface">Uphold the verdict</option>
        <option value="revise" className="bg-surface">Revise the verdict</option>
        <option value="remove_verdict" className="bg-surface">Remove the verdict</option>
      </select>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Note shown with the verdict (at least 5 characters)" className={`${field} resize-none`} aria-label="Moderator note" />
      <input value={score} onChange={(e) => setScore(e.target.value)} inputMode="numeric" placeholder="New score 0–100 (optional)" className={field} aria-label="Override score" />
      {resolve.isError && <ErrorBanner error={resolve.error} />}
      <Button onClick={() => resolve.mutate()} disabled={note.trim().length < 5 || !scoreValid} loading={resolve.isPending}>
        Resolve
      </Button>
    </Card>
  );
}

function ModeratorTools({ v, postId }: { v: PostVerification | null | undefined; postId: number }) {
  const reviews = useOpenReviews();
  const forThis = reviews.data?.find((r) => r.verification_id === v?.id);
  const others = reviews.data?.filter((r) => r.post.id !== postId) ?? [];
  return (
    <div className="space-y-4">
      {forThis && <ResolveForm review={forThis} postId={postId} />}
      {others.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold text-ink">Other open reviews ({others.length})</h3>
          <ul className="mt-3 space-y-2">
            {others.map((r) => (
              <li key={r.id}>
                <Link href={`/post/${r.post.id}`} className="block rounded-lg px-2 py-1.5 text-sm text-ink-2 hover:bg-fill">
                  <span className="font-semibold text-ink">@{r.post.author.username}</span> · {r.post.content.slice(0, 80)}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Full fact-check for one post: score, each claim with its sources, challenge and moderation. */
export function FactCheckPanel({ post, viewer }: { post: Post; viewer: User | null }) {
  const verification = useQuery({
    queryKey: ['verification', post.id],
    queryFn: () => getLatestPostVerification(post.id),
  });
  const v = verification.data;
  const retry = useVerifyPost(post.id, !!v && !isFailedVerification(v));
  const isModerator = isStaff(viewer);
  const canChallenge = !!viewer && !!v && !isFailedVerification(v) && !isUnverifiableVerification(v) && !v.is_human_final;

  return (
    <section aria-labelledby="fact-check-title" className="space-y-4">
      <h2 id="fact-check-title" className="flex items-center gap-2 text-lg font-bold text-ink">
        <ShieldCheck aria-hidden className="h-5 w-5 text-link" /> Fact-check
      </h2>
      {verification.isLoading && <Spinner label="Loading the fact-check" />}
      {verification.isError && <ErrorBanner error={verification.error} onRetry={() => verification.refetch()} />}
      {verification.isSuccess && !v && (
        <Card className="p-5 text-sm text-ink-3">
          This post hasn&apos;t been checked yet.{viewer ? ' Use Verify on the post above.' : ' Log in to verify it.'}
        </Card>
      )}
      {v && (
        <>
          <Summary v={v} onRetry={() => retry.mutate()} retrying={retry.isPending} signedIn={!!viewer} />
          {retry.isError && <ErrorBanner error={retry.error} />}
          {v.claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
          {canChallenge && <ChallengeForm v={v} postId={post.id} />}
        </>
      )}
      {isModerator && <ModeratorTools v={v} postId={post.id} />}
    </section>
  );
}
