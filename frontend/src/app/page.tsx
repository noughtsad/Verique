'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, LogOut, ShieldCheck } from 'lucide-react';

import {
  challengeVerification,
  clearAuthToken,
  createPost,
  getCurrentUser,
  getLatestPostVerification,
  listModerationReviews,
  listPosts,
  login,
  register,
  resolveModerationReview,
  verifyPost,
} from '@/lib/api';
import { ModerationReview, Post, PostVerification, User, VERDICT_CONFIG } from '@/lib/types';
import { cn, formatDate, getDomainFromUrl, truncate } from '@/lib/utils';

const CHALLENGE_REASONS = [
  ['missing_context', 'Missing context'],
  ['wrong_sources', 'Wrong sources'],
  ['outdated_conclusion', 'Outdated conclusion'],
  ['incorrect_reasoning', 'Incorrect reasoning'],
] as const;

export default function Home() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [challengeReason, setChallengeReason] = useState<string>(CHALLENGE_REASONS[0][0]);
  const [challengeComment, setChallengeComment] = useState('');
  const [decision, setDecision] = useState<'uphold' | 'revise' | 'remove_verdict'>('uphold');
  const [note, setNote] = useState('');
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideSummary, setOverrideSummary] = useState('');

  const postsQuery = useQuery({ queryKey: ['posts'], queryFn: listPosts });
  const moderationQuery = useQuery({
    queryKey: ['moderation-reviews'],
    queryFn: listModerationReviews,
    enabled: user?.role === 'moderator' || user?.role === 'admin',
  });
  const verificationQuery = useQuery({
    queryKey: ['verification', selectedPostId],
    queryFn: () => getLatestPostVerification(selectedPostId as number),
    enabled: selectedPostId !== null,
  });

  const selectedPost = useMemo(
    () => postsQuery.data?.find((post) => post.id === selectedPostId) ?? null,
    [postsQuery.data, selectedPostId],
  );

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => {
      clearAuthToken();
      setUser(null);
    });
  }, []);

  useEffect(() => {
    if (!selectedPostId && postsQuery.data?.length) {
      setSelectedPostId(postsQuery.data[0].id);
    }
  }, [postsQuery.data, selectedPostId]);

  const authMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const email = String(formData.get('email') || '');
      const password = String(formData.get('password') || '');
      if (authMode === 'register') {
        return register({
          email,
          password,
          username: String(formData.get('username') || ''),
          full_name: String(formData.get('full_name') || ''),
        });
      }
      return login({ email, password });
    },
    onSuccess: (data) => {
      setUser(data.user);
      setAuthError(null);
    },
    onError: (error) => setAuthError(error instanceof Error ? error.message : 'Authentication failed'),
  });

  const createPostMutation = useMutation({
    mutationFn: createPost,
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setSelectedPostId(post.id);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: verifyPost,
    onSuccess: (verification) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.setQueryData(['verification', verification.post_id], verification);
    },
  });

  const challengeMutation = useMutation({
    mutationFn: (verificationId: number) =>
      challengeVerification(verificationId, {
        reason_code: challengeReason,
        comment: challengeComment,
      }),
    onSuccess: async () => {
      setChallengeComment('');
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.invalidateQueries({ queryKey: ['verification', selectedPostId] });
      await queryClient.invalidateQueries({ queryKey: ['moderation-reviews'] });
    },
  });

  const moderationMutation = useMutation({
    mutationFn: (reviewId: number) =>
      resolveModerationReview(reviewId, {
        decision,
        note,
        override_score: overrideScore ? Number(overrideScore) : undefined,
        override_summary: overrideSummary || undefined,
      }),
    onSuccess: async () => {
      setNote('');
      setOverrideScore('');
      setOverrideSummary('');
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      await queryClient.invalidateQueries({ queryKey: ['moderation-reviews'] });
      await queryClient.invalidateQueries({ queryKey: ['verification', selectedPostId] });
    },
  });

  const submitAuth = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    authMutation.mutate(new FormData(event.currentTarget));
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#d9fbe3,_#f8fafc_45%,_#e2e8f0)] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                Social fact-checking with moderator escalation
              </div>
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
                Every post gets evidence. Every dispute gets a path to review.
              </h1>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Publish claims, attach AI verdicts with sources, challenge weak conclusions, and send disputed items to a human moderator.
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-slate-950 px-6 py-5 text-white">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Seed moderator</div>
              <div className="mt-2 font-semibold">moderator@verique.local</div>
              <div className="text-sm text-slate-300">Password: Moderator123!</div>
            </div>
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <aside className="space-y-6">
            <Card title={user ? 'Session' : 'Authentication'}>
              {!user ? (
                <form className="space-y-3" onSubmit={submitAuth}>
                  <div className="flex rounded-xl bg-slate-100 p-1">
                    <button type="button" onClick={() => setAuthMode('login')} className={tab(authMode === 'login')}>Login</button>
                    <button type="button" onClick={() => setAuthMode('register')} className={tab(authMode === 'register')}>Register</button>
                  </div>
                  {authMode === 'register' && (
                    <>
                      <TextInput name="username" placeholder="Username" required />
                      <TextInput name="full_name" placeholder="Full name" />
                    </>
                  )}
                  <TextInput name="email" type="email" placeholder="Email" required />
                  <TextInput name="password" type="password" placeholder="Password" required />
                  {authError && <ErrorBanner text={authError} />}
                  <button className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
                    {authMutation.isPending ? 'Working...' : authMode === 'login' ? 'Sign in' : 'Create account'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="text-lg font-semibold">{user.full_name || user.username}</div>
                  <div className="text-sm text-slate-500">{user.email}</div>
                  <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {user.role}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearAuthToken();
                      setUser(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </Card>

            <Card title="Create post">
              {user ? (
                <Composer
                  busy={createPostMutation.isPending}
                  error={createPostMutation.error instanceof Error ? createPostMutation.error.message : null}
                  onSubmit={(content, sourceUrl) => createPostMutation.mutate({ content, source_url: sourceUrl || undefined })}
                />
              ) : (
                <Muted text="Sign in to post, verify, and challenge." />
              )}
            </Card>

            {(user?.role === 'moderator' || user?.role === 'admin') && (
              <Card title="Moderation queue">
                {moderationQuery.isLoading ? (
                  <Loading text="Loading review queue..." />
                ) : moderationQuery.data?.length ? (
                  <div className="space-y-4">
                    {moderationQuery.data.map((review) => (
                      <ModerationCard
                        key={review.id}
                        review={review}
                        decision={decision}
                        note={note}
                        overrideScore={overrideScore}
                        overrideSummary={overrideSummary}
                        setDecision={setDecision}
                        setNote={setNote}
                        setOverrideScore={setOverrideScore}
                        setOverrideSummary={setOverrideSummary}
                        busy={moderationMutation.isPending}
                        onResolve={() => moderationMutation.mutate(review.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <Muted text="No escalated reviews yet." />
                )}
              </Card>
            )}
          </aside>

          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Community feed</h2>
              <p className="text-sm text-slate-500">Select a post to inspect its attached fact-check.</p>
            </div>
            {postsQuery.isLoading ? (
              <Card><Loading text="Loading posts..." /></Card>
            ) : postsQuery.data?.length ? (
              postsQuery.data.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  selected={post.id === selectedPostId}
                  canVerify={Boolean(user)}
                  busy={verifyMutation.isPending && verifyMutation.variables === post.id}
                  onSelect={() => setSelectedPostId(post.id)}
                  onVerify={() => verifyMutation.mutate(post.id)}
                />
              ))
            ) : (
              <Card><Muted text="No posts yet. Publish the first one to start the workflow." /></Card>
            )}
          </section>

          <aside className="space-y-6">
            <Card title="Post detail">
              {!selectedPost ? (
                <Muted text="Select a post to inspect its fact-check." />
              ) : (
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-slate-500">@{selectedPost.author.username}</div>
                  <p className="whitespace-pre-wrap text-base leading-7 text-slate-800">{selectedPost.content}</p>
                  {selectedPost.source_url && (
                    <a href={selectedPost.source_url} target="_blank" rel="noreferrer" className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                      Source: {getDomainFromUrl(selectedPost.source_url)}
                    </a>
                  )}
                  {verificationQuery.isLoading ? (
                    <Loading text="Loading verification..." />
                  ) : verificationQuery.data ? (
                    <VerificationPanel
                      verification={verificationQuery.data}
                      canChallenge={Boolean(user)}
                      challengeReason={challengeReason}
                      challengeComment={challengeComment}
                      setChallengeReason={setChallengeReason}
                      setChallengeComment={setChallengeComment}
                      onChallenge={() => challengeMutation.mutate(verificationQuery.data!.id)}
                      busy={challengeMutation.isPending}
                      error={challengeMutation.error instanceof Error ? challengeMutation.error.message : null}
                    />
                  ) : (
                    <Muted text="This post has not been fact-checked yet." />
                  )}
                </div>
              )}
            </Card>

            <Card title="Workflow">
              <State name="Unverified" detail="Post exists without an attached verification." />
              <State name="Verified" detail="AI score, claims, sources, and reasoning are public." />
              <State name="Under review" detail="Unique challenges crossed threshold and a moderator queue item was created." />
              <State name="Moderated" detail="Human review becomes the final public decision." />
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_25px_60px_-35px_rgba(15,23,42,0.4)]">
      {title && <div className="mb-4 text-lg font-semibold text-slate-950">{title}</div>}
      {children}
    </section>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white" />;
}

function Composer({
  onSubmit,
  busy,
  error,
}: {
  onSubmit: (content: string, sourceUrl: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(content, sourceUrl);
    setContent('');
    setSourceUrl('');
  };

  return (
    <form className="space-y-3" onSubmit={submit}>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Share a post for fact-checking..."
        className="h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
      />
      <TextInput value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Optional source URL" />
      {error && <ErrorBanner text={error} />}
      <button disabled={busy || content.trim().length < 10} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300">
        {busy ? 'Publishing...' : 'Publish post'}
      </button>
    </form>
  );
}

function PostCard({
  post,
  selected,
  canVerify,
  busy,
  onSelect,
  onVerify,
}: {
  post: Post;
  selected: boolean;
  canVerify: boolean;
  busy: boolean;
  onSelect: () => void;
  onVerify: () => void;
}) {
  const verification = post.latest_verification_summary;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn('w-full rounded-[1.75rem] border bg-white/90 p-5 text-left shadow-[0_25px_60px_-35px_rgba(15,23,42,0.45)]', selected ? 'border-emerald-300 ring-2 ring-emerald-200' : 'border-white/70')}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-slate-900">@{post.author.username}</div>
          <div className="text-xs text-slate-500">{formatDate(post.created_at)}</div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{verification?.status || 'unverified'}</span>
      </div>
      <p className="mt-4 text-base leading-7 text-slate-700">{truncate(post.content, 240)}</p>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Fact score</div>
            <div className="text-3xl font-semibold text-slate-950">{verification?.score ?? '--'}</div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>{verification?.challenge_count ?? 0} challenges</div>
            <div>{verification?.review_status || 'none'}</div>
          </div>
        </div>
        {verification?.final_decision_note && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-600">{verification.final_decision_note}</p>}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onVerify();
          }}
          disabled={!canVerify || busy}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
        >
          {busy ? 'Fact-checking...' : 'Fact-check'}
        </button>
        {!canVerify && <span className="text-sm text-slate-500">Sign in to verify</span>}
      </div>
    </button>
  );
}

function VerificationPanel({
  verification,
  canChallenge,
  challengeReason,
  challengeComment,
  setChallengeReason,
  setChallengeComment,
  onChallenge,
  busy,
  error,
}: {
  verification: PostVerification;
  canChallenge: boolean;
  challengeReason: string;
  challengeComment: string;
  setChallengeReason: (value: string) => void;
  setChallengeComment: (value: string) => void;
  onChallenge: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-700">Verification</div>
            <div className="text-3xl font-semibold text-slate-950">{verification.score ?? '--'}</div>
          </div>
          <div className="text-right text-sm text-slate-600">
            <div>{verification.status}</div>
            <div>{verification.challenge_count} challenges</div>
          </div>
        </div>
        {verification.final_decision_note && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-700">{verification.final_decision_note}</p>}
      </div>

      {verification.claims.map((claim) => {
        const config = VERDICT_CONFIG[claim.verdict];
        return (
          <div key={claim.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', config.bgColor, config.color)}>{config.label}</span>
              <span className="text-sm text-slate-500">{Math.round(claim.confidence * 100)}%</span>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-900">{claim.text}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{claim.reasoning}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <SourceBox title="Supporting" sources={claim.sources.supporting} />
              <SourceBox title="Contradicting" sources={claim.sources.contradicting} />
            </div>
          </div>
        );
      })}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
          <AlertCircle className="h-4 w-4" />
          Challenge this conclusion
        </div>
        {canChallenge ? (
          <div className="space-y-3">
            <select value={challengeReason} onChange={(event) => setChallengeReason(event.target.value)} className="w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm">
              {CHALLENGE_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <textarea
              value={challengeComment}
              onChange={(event) => setChallengeComment(event.target.value)}
              placeholder="Explain what seems wrong or incomplete..."
              className="h-24 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm"
            />
            {error && <ErrorBanner text={error} />}
            <button onClick={onChallenge} disabled={busy} className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:bg-slate-300">
              {busy ? 'Submitting challenge...' : 'Challenge verdict'}
            </button>
          </div>
        ) : (
          <Muted text="Sign in to challenge this verdict." />
        )}
      </div>
    </div>
  );
}

function SourceBox({ title, sources }: { title: string; sources: { url: string; snippet: string }[] }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 space-y-2">
        {sources.length ? sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
            <div className="font-medium text-slate-900">{getDomainFromUrl(source.url)}</div>
            <div className="mt-1 line-clamp-2 text-xs text-slate-500">{source.snippet}</div>
          </a>
        )) : <div className="text-sm text-slate-500">No sources listed.</div>}
      </div>
    </div>
  );
}

function ModerationCard({
  review,
  decision,
  note,
  overrideScore,
  overrideSummary,
  setDecision,
  setNote,
  setOverrideScore,
  setOverrideSummary,
  busy,
  onResolve,
}: {
  review: ModerationReview;
  decision: 'uphold' | 'revise' | 'remove_verdict';
  note: string;
  overrideScore: string;
  overrideSummary: string;
  setDecision: (value: 'uphold' | 'revise' | 'remove_verdict') => void;
  setNote: (value: string) => void;
  setOverrideScore: (value: string) => void;
  setOverrideSummary: (value: string) => void;
  busy: boolean;
  onResolve: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="font-semibold text-slate-900">@{review.post.author.username}</div>
      <p className="mt-2 text-sm leading-6 text-slate-700">{truncate(review.post.content, 180)}</p>
      <div className="mt-2 text-xs text-slate-500">Score {review.verification.score ?? '--'} | {review.verification.challenge_count} challenges</div>
      <div className="mt-4 space-y-3">
        <select value={decision} onChange={(event) => setDecision(event.target.value as 'uphold' | 'revise' | 'remove_verdict')} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="uphold">Uphold verdict</option>
          <option value="revise">Revise verdict</option>
          <option value="remove_verdict">Remove verdict</option>
        </select>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Final moderator note" className="h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        <TextInput value={overrideScore} onChange={(event) => setOverrideScore(event.target.value)} placeholder="Optional override score" />
        <textarea value={overrideSummary} onChange={(event) => setOverrideSummary(event.target.value)} placeholder="Optional public override summary" className="h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        <button onClick={onResolve} disabled={busy || note.trim().length < 5} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300">
          {busy ? 'Resolving...' : 'Resolve review'}
        </button>
      </div>
    </div>
  );
}

function State({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 last:mb-0">
      <div className="font-semibold text-slate-900">{name}</div>
      <div className="mt-1 text-sm text-slate-500">{detail}</div>
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return <div className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{text}</div>;
}

function Muted({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">{text}</div>;
}

function ErrorBanner({ text }: { text: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{text}</div>;
}

function tab(active: boolean) {
  return cn('flex-1 rounded-lg px-4 py-2 text-sm font-semibold', active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500');
}
