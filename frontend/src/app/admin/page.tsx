'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, ExternalLink, Flag, History, Inbox, PencilLine, ShieldOff, UserCheck } from 'lucide-react';

import { listModerationReviews, resolveModerationReview } from '@/lib/api';
import { challengeReasonLabel, DECISIONS, isStaff, MODERATION_KEY, useOpenReviews } from '@/lib/moderation';
import { updatePost } from '@/lib/postCache';
import { fullDate, timeAgo, timeAgoLong } from '@/lib/time';
import { Challenge, ModerationReview, ReviewDecision, ReviewStatus, User } from '@/lib/types';
import { cn, getDomainFromUrl } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { toSummary } from '@/components/post/VerifyStatus';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Choice } from '@/components/ui/Choice';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { inputClass } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScoreMeter } from '@/components/ui/ScoreMeter';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { VerdictBadge } from '@/components/ui/VerdictBadge';

const HISTORY_LIMIT = 50;

const DECISION_ICON: Record<ReviewDecision, typeof CheckCircle2> = {
  uphold: CheckCircle2,
  revise: PencilLine,
  remove_verdict: Ban,
};

function Time({ value, long = false }: { value: string; long?: boolean }) {
  return (
    <time dateTime={value} title={fullDate(value)}>
      {long ? timeAgoLong(value) : timeAgo(value)}
    </time>
  );
}

/** The post being challenged, with the verdict as it stands. */
function PostUnderReview({ review, verdictTitle }: { review: ModerationReview; verdictTitle: string }) {
  const { post, verification: v } = review;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Link href={`/profile/${post.author.username}`} className="shrink-0">
          <Avatar user={post.author} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-3">
            <Link href={`/profile/${post.author.username}`} className="font-semibold text-ink hover:underline">
              {post.author.full_name || post.author.username}
            </Link>{' '}
            @{post.author.username} · <Time value={post.created_at} />
          </p>
          <p className="mt-1 line-clamp-5 whitespace-pre-line text-[15px] text-ink">{post.content}</p>
          {post.source_url && (
            <a href={post.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-link hover:underline">
              {getDomainFromUrl(post.source_url)}
            </a>
          )}
        </div>
        <Link
          href={`/post/${post.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm text-link hover:bg-fill"
          title="Open the post with its full fact-check and sources"
        >
          <ExternalLink aria-hidden className="h-4 w-4" />
          <span className="hidden sm:inline">Open post</span>
        </Link>
      </div>

      <div className="rounded-lg border border-line bg-fill/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink-2">{verdictTitle}</h3>
          {v.score != null && <ScoreMeter score={v.score} />}
        </div>
        {v.claims.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {v.claims.map((claim) => (
              <li key={claim.id}>
                <details className="group rounded-md">
                  <summary className="flex cursor-pointer list-none items-start gap-2 text-sm text-ink [&::-webkit-details-marker]:hidden">
                    <VerdictBadge verdict={claim.verdict} className="shrink-0" />
                    <span className="min-w-0 flex-1">{claim.text}</span>
                  </summary>
                  <p className="mt-1.5 border-l-2 border-line pl-3 text-sm text-ink-3">{claim.reasoning}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-3">No claims were checked.</p>
        )}
      </div>
    </div>
  );
}

/** `markAnswered` flags challenges an earlier decision already covered (only meaningful in the open queue). */
function ChallengeList({ challenges, markAnswered = false }: { challenges: Challenge[]; markAnswered?: boolean }) {
  if (challenges.length === 0) return null;
  const pending = challenges.filter((c) => c.status === 'submitted').length;
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-2">
        <Flag aria-hidden className="h-4 w-4" />
        {challenges.length} {challenges.length === 1 ? 'challenge' : 'challenges'}
        {markAnswered && pending > 0 && pending < challenges.length && <span className="font-normal text-ink-3">· {pending} new</span>}
      </h3>
      <ul className="space-y-2">
        {challenges.map((c) => (
          <li key={c.id} className={cn('flex gap-3 rounded-lg border border-line p-3', markAnswered && c.status !== 'submitted' && 'opacity-70')}>
            <Avatar user={c.user} size="xs" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href={`/profile/${c.user.username}`} className="font-semibold text-ink hover:underline">
                  @{c.user.username}
                </Link>
                <span className="rounded-md bg-fill-strong px-2 py-0.5 text-xs font-medium text-ink-2">
                  {challengeReasonLabel(c.reason_code)}
                </span>
                {markAnswered && c.status !== 'submitted' && <span className="text-xs text-ink-muted">answered earlier</span>}
                <span className="ml-auto text-xs text-ink-muted">
                  <Time value={c.created_at} />
                </span>
              </p>
              {c.comment ? (
                <p className="mt-1.5 text-ink-2">“{c.comment}”</p>
              ) : (
                <p className="mt-1.5 text-ink-muted">No comment given.</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResolveForm({ review }: { review: ModerationReview }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [decision, setDecision] = useState<ReviewDecision>('uphold');
  const [note, setNote] = useState('');
  const [score, setScore] = useState('');
  const [summary, setSummary] = useState('');

  const resolve = useMutation({
    mutationFn: () =>
      resolveModerationReview(review.id, {
        decision,
        note: note.trim(),
        override_score: score.trim() === '' ? undefined : Number(score),
        override_summary: summary.trim() || undefined,
      }),
    onSuccess: (resolved) => {
      // Take it out of the queue straight away, then let the lists and the post catch up.
      queryClient.setQueryData<ModerationReview[]>([...MODERATION_KEY, 'open'], (old) => old?.filter((r) => r.id !== review.id));
      queryClient.invalidateQueries({ queryKey: MODERATION_KEY });
      queryClient.setQueryData(['verification', resolved.post.id], resolved.verification);
      updatePost(queryClient, resolved.post.id, (p) => ({ ...p, latest_verification_summary: toSummary(resolved.verification) }));
      toast(`${DECISIONS[decision].past} · @${review.post.author.username}'s post`);
    },
  });

  const noteOk = note.trim().length >= 5;
  const scoreOk = score.trim() === '' || (/^\d{1,3}$/.test(score.trim()) && Number(score) <= 100);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (noteOk && scoreOk) resolve.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-line pt-4">
      <h3 className="text-sm font-semibold text-ink-2">Your decision</h3>
      <Choice
        label="Decision"
        value={decision}
        onChange={setDecision}
        options={(Object.keys(DECISIONS) as ReviewDecision[]).map((d) => ({ value: d, label: DECISIONS[d].action, icon: DECISION_ICON[d] }))}
      />
      <p className="text-sm text-ink-3">{DECISIONS[decision].hint}</p>
      <label className="block text-sm text-ink-2">
        Note <span className="text-ink-muted">(shown with the verdict, at least 5 characters)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={2}
          className={cn(inputClass, 'mt-1.5 resize-y')}
          placeholder="What you checked and why you decided this"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
        <label className="block text-sm text-ink-2">
          New score <span className="text-ink-muted">(optional)</span>
          <input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            inputMode="numeric"
            placeholder={review.verification.score != null ? `now ${review.verification.score}` : '0–100'}
            aria-invalid={!scoreOk}
            className={cn(inputClass, 'mt-1.5', !scoreOk && 'border-danger-ink')}
          />
        </label>
        <label className="block text-sm text-ink-2">
          Summary for readers <span className="text-ink-muted">(optional)</span>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={1000}
            className={cn(inputClass, 'mt-1.5')}
            placeholder="Shown next to the automatic summary"
          />
        </label>
      </div>
      {!scoreOk && <p className="text-sm text-danger-ink">The score must be a whole number from 0 to 100.</p>}
      {resolve.isError && <ErrorBanner error={resolve.error} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={!noteOk || !scoreOk} loading={resolve.isPending}>
          {DECISIONS[decision].action} verdict
        </Button>
      </div>
    </form>
  );
}

function OpenReviewCard({ review }: { review: ModerationReview }) {
  return (
    <Card className="space-y-5 p-5">
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
        <span className="font-semibold uppercase tracking-wide text-amber-500">Open</span>
        <span>
          in the queue since <Time value={review.created_at} long />
        </span>
      </p>
      <PostUnderReview review={review} verdictTitle="Verdict being challenged" />
      {review.decision && (
        <p className="flex items-start gap-2 rounded-lg border border-line p-3 text-sm text-ink-2">
          <History aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
          <span>
            Reopened by a new challenge. Earlier decision: <strong className="text-ink">{DECISIONS[review.decision].past.toLowerCase()}</strong>
            {review.moderator && <> by @{review.moderator.username}</>}
            {review.note && <> — “{review.note}”</>}
          </span>
        </p>
      )}
      <ChallengeList challenges={review.challenges} markAnswered />
      <ResolveForm review={review} />
    </Card>
  );
}

function ResolvedReviewCard({ review }: { review: ModerationReview }) {
  const Icon = review.decision ? DECISION_ICON[review.decision] : UserCheck;
  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Icon aria-hidden className="h-4 w-4 text-link" />
        <span className="font-semibold text-ink">{review.decision ? DECISIONS[review.decision].past : 'Resolved'}</span>
        {review.moderator && <span className="text-ink-3">by @{review.moderator.username}</span>}
        {review.decided_at && (
          <span className="text-ink-muted">
            · <Time value={review.decided_at} long />
          </span>
        )}
        {review.override_score != null && (
          <span className="ml-auto rounded-md bg-fill-strong px-2 py-0.5 text-xs font-medium text-ink-2">Score set to {review.override_score}</span>
        )}
      </div>
      {review.note && <p className="-mt-2 text-sm text-ink-2">“{review.note}”</p>}
      {review.override_summary && <p className="-mt-2 text-sm text-ink-3">Reader summary: {review.override_summary}</p>}
      <PostUnderReview review={review} verdictTitle="Verdict after the decision" />
      <ChallengeList challenges={review.challenges} />
    </Card>
  );
}

function ReviewList({ status }: { status: ReviewStatus }) {
  const open = useOpenReviews(status === 'open');
  const history = useQuery({
    queryKey: [...MODERATION_KEY, 'resolved'],
    queryFn: () => listModerationReviews('resolved', HISTORY_LIMIT),
    enabled: status === 'resolved',
  });
  const query = status === 'open' ? open : history;

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-xl border border-line/50 bg-surface/40" />
        ))}
      </div>
    );
  }
  if (query.isError) return <ErrorBanner error={query.error} onRetry={() => query.refetch()} />;
  const reviews = query.data ?? [];
  if (reviews.length === 0) {
    return (
      <Card>
        {status === 'open' ? (
          <EmptyState icon={Inbox} title="No open challenges" body="When readers challenge a verdict, it shows up here for a decision." />
        ) : (
          <EmptyState icon={History} title="No decisions yet" body="Challenges you and other moderators resolve are listed here." />
        )}
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {reviews.map((review) =>
        status === 'open' ? <OpenReviewCard key={review.id} review={review} /> : <ResolvedReviewCard key={review.id} review={review} />,
      )}
      {status === 'resolved' && reviews.length === HISTORY_LIMIT && (
        <p className="text-center text-sm text-ink-muted">Showing the {HISTORY_LIMIT} most recent decisions.</p>
      )}
    </div>
  );
}

function AdminView({ user }: { user: User }) {
  const [tab, setTab] = useState<ReviewStatus>('open');
  const open = useOpenReviews();
  const openCount = open.data?.length;

  return (
    <>
      <PageHeader
        title="Admin"
        subtitle={
          openCount === undefined
            ? 'Challenged verdicts waiting for a decision.'
            : openCount === 0
              ? 'All challenges are resolved.'
              : `${openCount} ${openCount === 1 ? 'challenged verdict needs' : 'challenged verdicts need'} a decision.`
        }
      />
      <Tabs
        label="Challenges"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'open', label: 'Open', count: openCount },
          { value: 'resolved', label: 'Resolved' },
        ]}
      />
      <p className="mb-4 mt-3 text-xs text-ink-muted">Signed in as @{user.username} ({user.role}).</p>
      <ReviewList status={tab} />
    </>
  );
}

export default function AdminPage() {
  return (
    <AppShell width="lg" rightRail={false}>
      {(user) =>
        user && isStaff(user) ? (
          <AdminView user={user} />
        ) : (
          <Card>
            <EmptyState icon={ShieldOff} title="Moderators only" body="This page is for moderators and admins." />
          </Card>
        )
      }
    </AppShell>
  );
}
