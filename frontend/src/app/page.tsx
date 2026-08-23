'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, Loader2, LogOut, ShieldCheck,
  Search, Home as HomeIcon, MessageCircle, Bell,
  MoreVertical, Heart, MessageSquare, Share2, Bookmark,
  Image as ImageIcon, Video, Globe, User as UserIcon, Settings,
  Plus, Upload, X, MapPin, Sparkles, Flame, Zap, ShieldAlert, CheckCircle2, XCircle, HelpCircle, Award, Compass, RefreshCw, Command
} from 'lucide-react';

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
import { cn, formatDate, getDomainFromUrl } from '@/lib/utils';

const CHALLENGE_REASONS = [
  ['missing_context', 'Missing Context'],
  ['wrong_sources', 'Wrong Sources'],
  ['outdated_conclusion', 'Outdated Conclusion'],
  ['incorrect_reasoning', 'Incorrect Reasoning'],
] as const;

export default function Home() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [isVerificationLocked, setIsVerificationLocked] = useState(false);
  const showVerificationPanel = selectedPostId !== null || isVerificationLocked;
  const [challengeReason, setChallengeReason] = useState<string>(CHALLENGE_REASONS[0][0]);
  const [challengeComment, setChallengeComment] = useState('');
  const [decision, setDecision] = useState<'uphold' | 'revise' | 'remove_verdict'>('uphold');
  const [note, setNote] = useState('');
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideSummary, setOverrideSummary] = useState('');
  const [showComposerModal, setShowComposerModal] = useState(false);
  const [feedFilter, setFeedFilter] = useState<'all' | 'verified' | 'suspicious'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
    getCurrentUser().then((u) => {
      setUser(u);
      setAuthChecked(true);
    }).catch(() => {
      clearAuthToken();
      setUser(null);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (authChecked && !user) {
      router.push('/login');
    }
  }, [authChecked, user, router]);

  const createPostMutation = useMutation({
    mutationFn: createPost,
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setSelectedPostId(post.id);
      setShowComposerModal(false);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: verifyPost,
    onSuccess: (verification) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.setQueryData(['verification', verification.post_id], verification);
      setSelectedPostId(verification.post_id);
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

  const filteredPosts = useMemo(() => {
    if (!postsQuery.data) return [];
    return postsQuery.data.filter((post) => {
      const matchSearch = searchQuery === '' || 
        post.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
        post.author.username.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchSearch) return false;

      if (feedFilter === 'verified') {
        const score = post.latest_verification_summary?.score;
        return score !== null && score !== undefined && score > 70;
      }
      if (feedFilter === 'suspicious') {
        const score = post.latest_verification_summary?.score;
        return score !== null && score !== undefined && score < 50;
      }
      return true;
    });
  }, [postsQuery.data, searchQuery, feedFilter]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400 font-mono text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Initializing Verique protocol...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex overflow-hidden font-sans selection:bg-zinc-700 selection:text-white">
      <div className="w-full flex overflow-hidden min-h-screen relative">

        {/* LEFT SIDEBAR */}
        <div className="w-[72px] sm:w-[220px] flex-shrink-0"></div>
        
        <aside className="fixed top-0 left-0 h-screen w-[72px] sm:w-[220px] z-40 bg-[#0c0c0e] flex flex-col py-5 px-3 border-r border-[#27272a]">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 px-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-semibold text-white text-sm tracking-tight">Verique</span>
              <span className="text-[10px] font-mono text-zinc-400">Trust Protocol</span>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex flex-col gap-1 text-zinc-400">
            <button className="flex items-center gap-3 px-3 py-2 text-white rounded-lg bg-zinc-800/80 border border-zinc-700/60 font-medium text-xs transition">
              <HomeIcon className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span className="hidden sm:inline">Timeline Feed</span>
            </button>
            
            <button 
              onClick={() => setIsVerificationLocked(!isVerificationLocked)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition",
                isVerificationLocked 
                  ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" 
                  : "hover:text-white hover:bg-zinc-800/40 text-zinc-400"
              )}
            >
              <ShieldCheck className={cn("w-4 h-4 flex-shrink-0", isVerificationLocked ? "text-emerald-400" : "")} />
              <span className="hidden sm:inline">Fact-Check Inspector</span>
            </button>

            <button onClick={() => router.push('/docs')} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:text-white hover:bg-zinc-800/40 text-xs font-medium transition text-zinc-400">
              <Compass className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">API Docs</span>
            </button>

            <button onClick={() => router.push('/about')} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:text-white hover:bg-zinc-800/40 text-xs font-medium transition text-zinc-400">
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">About</span>
            </button>
          </div>

          {/* New Claim CTA */}
          <div className="mt-6 px-1">
            <button 
              onClick={() => setShowComposerModal(true)}
              className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">New Claim</span>
            </button>
          </div>

          {/* User Profile / Logout */}
          <div className="mt-auto flex flex-col gap-1 border-t border-[#27272a] pt-4 px-1">
            {user && (
              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 mb-1">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="avatar" className="w-7 h-7 rounded-full bg-zinc-800 flex-shrink-0" />
                <div className="hidden sm:flex flex-col overflow-hidden">
                  <span className="text-xs font-semibold text-white truncate">{user.full_name || user.username}</span>
                  <span className="text-[10px] font-mono text-zinc-400 truncate">@{user.username}</span>
                </div>
              </div>
            )}

            {user && (
              <button 
                onClick={() => { clearAuthToken(); setUser(null); router.push('/login'); }} 
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition text-zinc-400" 
                title="Logout"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </aside>

        {/* MIDDLE MAIN CONTENT */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto px-4 sm:px-8 py-6 relative">

          {/* Header Stats Bar */}
          <div className="max-w-3xl mx-auto w-full mb-6">
            <div className="bg-[#121215] border border-[#27272a] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Fact-Check Protocol Active</span>
              </div>
              <div className="flex items-center gap-4 text-zinc-400">
                <span>Confidence Index: <strong className="text-zinc-100">99.4%</strong></span>
                <span>Claims: <strong className="text-zinc-100">{postsQuery.data?.length || 0}</strong></span>
              </div>
            </div>
          </div>

          {/* Search & New Post Trigger */}
          <div className="max-w-3xl mx-auto w-full mb-6 flex gap-3">
            <div className="relative flex-1">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full input-sleek rounded-xl py-2.5 px-4 pl-10 text-xs font-medium placeholder-zinc-500" 
                placeholder="Filter claims by keyword, source, or user..." 
              />
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-zinc-400" />
              </div>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-3.5 flex items-center text-zinc-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button 
              onClick={() => setShowComposerModal(true)}
              className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-medium text-xs transition flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Submit Claim</span>
            </button>
          </div>

          {/* Composer Modal */}
          {showComposerModal && user && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
              <div className="w-full max-w-lg bg-[#121215] border border-[#27272a] rounded-2xl p-5 shadow-2xl relative">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#27272a]">
                  <h3 className="font-semibold text-white text-sm">Submit Claim for Verification</h3>
                  <button 
                    onClick={() => setShowComposerModal(false)} 
                    className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <Composer
                  busy={createPostMutation.isPending}
                  error={createPostMutation.error instanceof Error ? createPostMutation.error.message : null}
                  onSubmit={(content, sourceUrl) => {
                    createPostMutation.mutate({ content, source_url: sourceUrl || undefined }, {
                      onSuccess: () => setShowComposerModal(false)
                    });
                  }}
                  user={user}
                />
              </div>
            </div>
          )}

          {/* Timeline Feed Controls */}
          <div className="max-w-3xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <h1 className="text-sm font-semibold text-zinc-200">Claims Timeline</h1>
            
            <div className="flex gap-1 p-1 bg-[#121215] rounded-lg border border-[#27272a] text-xs">
              <button 
                onClick={() => setFeedFilter('all')}
                className={cn("px-3 py-1 rounded-md font-medium transition", feedFilter === 'all' ? "bg-zinc-800 text-white font-semibold" : "text-zinc-400 hover:text-zinc-200")}
              >
                All
              </button>
              <button 
                onClick={() => setFeedFilter('verified')}
                className={cn("px-3 py-1 rounded-md font-medium transition", feedFilter === 'verified' ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-zinc-400 hover:text-zinc-200")}
              >
                Verified (70%+)
              </button>
              <button 
                onClick={() => setFeedFilter('suspicious')}
                className={cn("px-3 py-1 rounded-md font-medium transition", feedFilter === 'suspicious' ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "text-zinc-400 hover:text-zinc-200")}
              >
                Contradicted
              </button>
            </div>
          </div>

          {/* Timeline Posts */}
          <div className="flex flex-col gap-4 pb-16 max-w-3xl mx-auto w-full">
            {postsQuery.isLoading ? (
              <div className="flex items-center justify-center p-12 card-sleek rounded-xl text-zinc-400 gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                <span className="text-xs font-mono">Loading claims feed...</span>
              </div>
            ) : filteredPosts.length ? (
              filteredPosts.map((post) => (
                <TimelinePostCard
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
              <div className="p-12 text-center card-sleek rounded-xl text-zinc-400">
                <HelpCircle className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-zinc-300">No claims match the filter criteria.</p>
              </div>
            )}
          </div>
        </main>

        {/* FACT CHECK INSPECTOR SIDEBAR */}
        <aside className={cn(
            "bg-[#0c0c0e] flex-col flex-shrink-0 h-screen overflow-hidden relative z-30 transition-all duration-300 border-l border-[#27272a]",
            showVerificationPanel 
                ? "w-full lg:w-[380px] opacity-100" 
                : "w-0 border-transparent opacity-0 hidden lg:flex"
        )}>
            <div className="w-full lg:w-[380px] p-5 flex flex-col h-full overflow-y-auto">
                {!selectedPostId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto">
                        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                          <ShieldCheck className="w-6 h-6 text-zinc-400" />
                        </div>
                        <h4 className="font-semibold text-white text-sm mb-1">Fact-Check Inspector</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed max-w-xs">
                          Select any claim from the timeline to view evidential analysis and claim breakdown.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5 flex-1 flex flex-col animate-in fade-in duration-200">
                        
              <div className="flex justify-between items-center pb-3 border-b border-[#27272a]">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Verification Analysis
                </h3>
                <button 
                  onClick={() => setSelectedPostId(null)} 
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedPost && (
                <div className="text-xs font-mono text-zinc-400 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800">
                  Inspecting post by <span className="font-semibold text-zinc-200">@{selectedPost.author.username}</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto no-scrollbar pb-8 space-y-5">
                {verificationQuery.isLoading ? (
                  <Loading text="Executing verification protocol..." />
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
                  <div className="text-xs font-mono text-zinc-400 text-center py-8 card-sleek rounded-lg">
                    No verification analysis available for this claim. Click "Run Fact Check".
                  </div>
                )}

                {/* Moderation Queue inside the panel if applicable */}
                {(user?.role === 'moderator' || user?.role === 'admin') && moderationQuery.data?.length ? (
                  <div className="mt-6 pt-6 border-t border-[#27272a]">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2 text-sm">
                      <AlertCircle className="w-4 h-4 text-amber-400" /> Moderation Reviews
                    </h3>
                    <div className="space-y-3">
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
                  </div>
                ) : null}
              </div>
            
                    </div>
                )}
            </div>
        </aside>

        {/* DISCOVERY SIDEBAR */}
        <aside className={cn(
            "bg-[#09090b] border-l border-[#27272a] p-5 flex-col flex-shrink-0 h-screen overflow-y-auto relative z-10 transition-all duration-300",
            showVerificationPanel ? "hidden xl:flex w-[300px]" : "hidden lg:flex w-[300px]"
        )}>
            <div className="w-[260px]">
               <ActivitySidebarContent />
            </div>
        </aside>

      </div>
    </div>
  );
}

// --- Sub-Components ---

function ActivitySidebarContent() {
  return (
    <div className="space-y-6 text-xs">
      {/* Top Fact-Checkers */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-zinc-200">Top Fact-Checkers</h3>
        </div>
        <div className="space-y-2">
          {[
            { name: 'Khoulod Mohamed', handle: '@khmohamed', score: '98% Acc' },
            { name: 'Mostafa Mohamed', handle: '@mostafa2020', score: '94% Acc' },
            { name: 'Nada Ahmed', handle: '@nadaahmed', score: '91% Acc' }
          ].map((person, i) => (
            <div key={i} className="card-sleek p-2.5 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${person.name}`} alt="avatar" className="w-7 h-7 rounded-full bg-zinc-800" />
                <div>
                  <div className="font-medium text-white">{person.name}</div>
                  <div className="text-[10px] font-mono text-zinc-400">{person.handle}</div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                {person.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Saved Claims */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-zinc-200">Saved Claims</h3>
        </div>
        <div className="space-y-2">
          <div className="card-sleek p-2.5 rounded-lg flex flex-col gap-1 cursor-pointer hover:border-zinc-600 transition">
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Renewable Energy</span>
            <span className="text-xs font-medium text-zinc-200">Battery storage claim verified ✓</span>
          </div>
          <div className="card-sleek p-2.5 rounded-lg flex flex-col gap-1 cursor-pointer hover:border-zinc-600 transition">
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Clinical Trial</span>
            <span className="text-xs font-medium text-zinc-200">Vaccine efficacy study data</span>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-zinc-200">System Activity</h3>
        </div>
        <div className="space-y-2 font-mono text-[11px] text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="truncate">Claim #104 verified (92% conf)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span className="truncate">Challenge filed on Claim #102</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Composer({
  onSubmit,
  busy,
  error,
  user
}: {
  onSubmit: (content: string, sourceUrl?: string) => void;
  busy: boolean;
  error: string | null;
  user: User;
}) {
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [showSource, setShowSource] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim().length < 5) return;
    onSubmit(content, showSource ? sourceUrl : undefined);
    setContent('');
    setSourceUrl('');
    setShowSource(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Enter claim statement to fact-check..."
        className="w-full h-24 input-sleek rounded-xl p-3 text-xs font-medium resize-none"
      />

      {showSource && (
        <input 
          type="url"
          value={sourceUrl} 
          onChange={(event) => setSourceUrl(event.target.value)} 
          placeholder="Source URL (optional)" 
          className="w-full input-sleek rounded-xl px-3 py-2 text-xs font-mono"
        />
      )}

      <div className="flex items-center justify-between pt-1">
        <button 
          type="button" 
          onClick={() => setShowSource(!showSource)} 
          className={cn("px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition", showSource ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white")}
        >
          <Globe className="w-3.5 h-3.5" /> Source Link
        </button>

        <button 
          disabled={busy || content.trim().length < 5} 
          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 transition"
        >
          {busy ? 'Verifying...' : 'Run Fact Check'}
        </button>
      </div>
      {error && <ErrorBanner text={error} />}
    </form>
  );
}

function TimelinePostCard({
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
  const likes = ((post.id * 37) % 450) + 12;
  const comments = ((post.id * 19) % 45) + 3;

  return (
    <div 
      className={cn(
        "card-sleek rounded-xl p-4 cursor-pointer relative transition-all",
        selected ? "border-emerald-500/50 bg-[#16161a]" : ""
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author.username}`} alt="avatar" className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700" />
          <div>
            <div className="text-xs font-semibold text-white leading-none">{post.author.full_name || post.author.username}</div>
            <div className="text-[10px] font-mono text-zinc-400 mt-0.5">@{post.author.username} · {formatDate(post.created_at)}</div>
          </div>
        </div>

        {/* Score Badge */}
        <div>
          {verification ? (
            <div className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold flex items-center gap-1.5 border",
              verification.score && verification.score > 70 ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : 
              verification.score && verification.score < 40 ? "bg-rose-500/10 text-rose-300 border-rose-500/30" : 
              "bg-amber-500/10 text-amber-300 border-amber-500/30"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                verification.score && verification.score > 70 ? "bg-emerald-400" :
                verification.score && verification.score < 40 ? "bg-rose-400" : "bg-amber-400"
              )}></span>
              <span>{verification.score}/100</span>
            </div>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); onVerify(); }}
              disabled={!canVerify || busy}
              className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition flex items-center gap-1.5"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin text-emerald-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{busy ? 'Running...' : 'Verify Claim'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-normal mb-3 whitespace-pre-wrap">
        {post.content}
      </p>
      
      {post.source_url && (
        <div className="mb-3 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          <a 
            href={post.source_url} 
            target="_blank" 
            rel="noreferrer" 
            onClick={(e) => e.stopPropagation()} 
            className="text-xs font-mono text-emerald-400 hover:underline truncate"
          >
            {getDomainFromUrl(post.source_url)}
          </a>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-5 text-xs text-zinc-400 font-mono pt-1">
        <button className="flex items-center gap-1 hover:text-zinc-200 transition">
          <Heart className="w-3.5 h-3.5" />
          <span>{likes}</span>
        </button>
        <button className="flex items-center gap-1 hover:text-zinc-200 transition">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{comments}</span>
        </button>
        <button className="flex items-center gap-1 hover:text-zinc-200 transition">
          <Share2 className="w-3.5 h-3.5" />
          <span>Share</span>
        </button>
      </div>
    </div>
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
  const score = verification.score ?? 50;

  return (
    <div className="space-y-5">
      {/* Score Overview Card */}
      <div className="card-sleek rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase text-zinc-400">Verity Score</div>
            <div className="text-3xl font-bold text-white mt-0.5">{score} <span className="text-xs text-zinc-400 font-mono">/ 100</span></div>
          </div>
          <div className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono font-medium text-emerald-400">
            {verification.status}
          </div>
        </div>

        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${score}%` }}></div>
        </div>

        {verification.final_decision_note && (
          <p className="text-xs text-zinc-300 leading-relaxed pt-1 border-t border-zinc-800 font-medium">
            {verification.final_decision_note}
          </p>
        )}
      </div>

      {/* Extracted Claims */}
      <div className="space-y-3">
        <h4 className="text-xs font-mono uppercase text-zinc-400">Extracted Claims ({verification.claims.length})</h4>

        {verification.claims.map((claim) => {
          const config = VERDICT_CONFIG[claim.verdict] || { label: claim.verdict, bgColor: 'bg-zinc-800', color: 'text-zinc-300' };
          return (
            <div key={claim.id} className="card-sleek rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className={cn('rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase border', config.bgColor, config.color)}>
                  {config.label}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {Math.round(claim.confidence * 100)}% Confidence
                </span>
              </div>

              <p className="text-xs font-semibold text-white leading-relaxed">{claim.text}</p>
              <p className="text-xs text-zinc-300 leading-relaxed font-normal bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                {claim.reasoning}
              </p>

              {(claim.sources.supporting.length > 0 || claim.sources.contradicting.length > 0) && (
                <div className="pt-2 border-t border-zinc-800 space-y-2">
                  {claim.sources.supporting.length > 0 && <SourceBox title="Supporting Sources" sources={claim.sources.supporting} />}
                  {claim.sources.contradicting.length > 0 && <SourceBox title="Contradicting Sources" sources={claim.sources.contradicting} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dispute Section */}
      <div className="card-sleek rounded-xl p-4 space-y-3 border-amber-500/20">
        <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Dispute Verdict
        </div>
        <p className="text-xs text-zinc-400">Submit evidence to challenge this AI verification.</p>
        
        {canChallenge ? (
          <div className="space-y-2.5">
            <select 
              value={challengeReason} 
              onChange={(event) => setChallengeReason(event.target.value)} 
              className="w-full input-sleek rounded-lg px-3 py-2 text-xs font-mono"
            >
              {CHALLENGE_REASONS.map(([value, label]) => <option key={value} value={value} className="bg-zinc-900">{label}</option>)}
            </select>
            <textarea
              value={challengeComment}
              onChange={(event) => setChallengeComment(event.target.value)}
              placeholder="Provide evidence or context for your dispute..."
              className="h-16 w-full input-sleek rounded-lg p-2.5 text-xs resize-none"
            />
            {error && <ErrorBanner text={error} />}
            <button 
              onClick={onChallenge} 
              disabled={busy} 
              className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-40"
            >
              {busy ? 'Submitting...' : 'Submit Dispute'}
            </button>
          </div>
        ) : (
          <div className="text-xs font-mono text-zinc-400 text-center py-2">
            Sign in to challenge verdicts.
          </div>
        )}
      </div>
    </div>
  );
}

function SourceBox({ title, sources }: { title: string; sources: { url: string; snippet: string }[] }) {
  return (
    <div>
      <div className="text-[10px] font-mono text-zinc-400 uppercase mb-1.5">{title}</div>
      <div className="space-y-1.5">
        {sources.map((source) => (
          <a 
            key={source.url} 
            href={source.url} 
            target="_blank" 
            rel="noreferrer" 
            className="block rounded-lg bg-zinc-900 p-2 border border-zinc-800 hover:border-zinc-600 transition"
          >
            <div className="text-xs font-mono text-emerald-400 flex items-center gap-1 mb-0.5">
              <Globe className="w-3 h-3" /> {getDomainFromUrl(source.url)}
            </div>
            <div className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed">{source.snippet}</div>
          </a>
        ))}
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
    <div className="card-sleek rounded-xl p-3.5 space-y-2.5">
      <div className="font-medium text-white text-xs">@{review.post.author.username}'s claim</div>
      <p className="text-xs text-zinc-300 bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 line-clamp-2">{review.post.content}</p>
      <div className="text-[10px] font-mono text-amber-400 bg-amber-500/10 inline-block px-2 py-0.5 rounded border border-amber-500/20">
        Score {review.verification.score ?? '--'} · {review.verification.challenge_count} Challenges
      </div>
      <div className="space-y-2">
        <select 
          value={decision} 
          onChange={(event) => setDecision(event.target.value as 'uphold' | 'revise' | 'remove_verdict')} 
          className="w-full input-sleek rounded-lg px-2.5 py-1.5 text-xs font-mono"
        >
          <option value="uphold" className="bg-zinc-900">Uphold verdict</option>
          <option value="revise" className="bg-zinc-900">Revise verdict</option>
          <option value="remove_verdict" className="bg-zinc-900">Remove verdict</option>
        </select>
        <textarea 
          value={note} 
          onChange={(event) => setNote(event.target.value)} 
          placeholder="Moderator note (required)" 
          className="h-14 w-full input-sleek rounded-lg p-2 text-xs resize-none" 
        />
        <input 
          value={overrideScore} 
          onChange={(event) => setOverrideScore(event.target.value)} 
          placeholder="Override score (0-100)" 
          className="w-full input-sleek rounded-lg px-2.5 py-1.5 text-xs font-mono" 
        />
        <textarea 
          value={overrideSummary} 
          onChange={(event) => setOverrideSummary(event.target.value)} 
          placeholder="Public override summary" 
          className="h-14 w-full input-sleek rounded-lg p-2 text-xs resize-none" 
        />
        <button 
          onClick={onResolve} 
          disabled={busy || note.trim().length < 5} 
          className="w-full rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-40"
        >
          {busy ? 'Resolving...' : 'Resolve Review'}
        </button>
      </div>
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 text-xs font-mono text-zinc-400 py-8 card-sleek rounded-xl">
      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
      <span>{text}</span>
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 font-medium">
      {text}
    </div>
  );
}
