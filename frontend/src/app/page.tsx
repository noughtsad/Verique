'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, Loader2, LogOut, ShieldCheck,
  Search, Home as HomeIcon, MessageCircle, Bell, Compass,
  MoreVertical, Heart, MessageSquare, Share2, Bookmark,
  Image as ImageIcon, Video, Globe, User as UserIcon, Settings,
  Plus, Upload, X, MapPin, UserCircle, Send, Check
} from 'lucide-react';

import {
  addComment,
  challengeVerification,
  clearAuthToken,
  createPost,
  followUser,
  getCurrentUser,
  getFollowSuggestions,
  getLatestPostVerification,
  likePost,
  listComments,
  listModerationReviews,
  listPosts,
  login,
  register,
  resolveModerationReview,
  searchUsers,
  unfollowUser,
  unlikePost,
  verifyPost,
} from '@/lib/api';
import { FollowerListItem, FollowResponse, ModerationReview, Post, PostVerification, User, VERDICT_CONFIG } from '@/lib/types';
import { cn, formatDate, getDomainFromUrl } from '@/lib/utils';
import { AnimatedCanvas } from '@/app/components/AnimatedCanvas';
import { Sidebar } from '@/app/components/Sidebar';

const CHALLENGE_REASONS = [
  ['missing_context', 'Missing context'],
  ['wrong_sources', 'Wrong sources'],
  ['outdated_conclusion', 'Outdated conclusion'],
  ['incorrect_reasoning', 'Incorrect reasoning'],
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
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const postsQuery = useQuery({ queryKey: ['posts'], queryFn: listPosts });

  const userSearchQuery = useQuery({
    queryKey: ['user-search', debouncedSearch],
    queryFn: () => searchUsers(debouncedSearch, 5),
    enabled: debouncedSearch.length > 0,
  });

  const searchFollowMutation = useMutation<
    void | FollowResponse,
    Error,
    { username: string; isFollowing: boolean },
    { previous?: FollowerListItem[] }
  >({
    mutationFn: ({ username, isFollowing }) =>
      isFollowing ? unfollowUser(username) : followUser(username),
    onMutate: async ({ username, isFollowing }) => {
      const key = ['user-search', debouncedSearch];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FollowerListItem[]>(key);
      queryClient.setQueryData<FollowerListItem[]>(key, (old) =>
        old?.map((person) =>
          person.username === username ? { ...person, is_followed_by_me: !isFollowing } : person,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['user-search', debouncedSearch], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['user-search', debouncedSearch] }),
  });

  const filteredPosts = useMemo(() => {
    const posts = postsQuery.data ?? [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return posts;
    return posts.filter((post) =>
      post.content.toLowerCase().includes(query) ||
      post.author.username.toLowerCase().includes(query) ||
      (post.author.full_name?.toLowerCase().includes(query) ?? false),
    );
  }, [postsQuery.data, searchQuery]);
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
    }).catch(async () => {
      await clearAuthToken();
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



  return (
    <div className="min-h-screen bg-transparent flex overflow-hidden font-sans">
      <AnimatedCanvas className="fixed inset-0 z-0" interactive={false} />
      <div className="w-full bg-transparent flex overflow-hidden min-h-screen relative z-10">

        {/* EXPANDING LEFT SIDEBAR (Dark) */}
        {/* Spacer for flex layout to account for fixed sidebar width */}
        <div className="w-[100px] flex-shrink-0 hidden sm:block"></div>
        
        <Sidebar user={user} onLogout={() => setUser(null)} />

        {/* MIDDLE COLUMN (Feed) */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto px-8 py-10 relative">




          {/* Top Search Bar */}
          <div className="max-w-2xl mx-auto w-full mb-8">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-6 pr-12 text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white/10 transition"
                placeholder="Search posts, people…"
              />
              <div className="absolute inset-y-0 right-4 flex items-center">
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="pointer-events-auto text-slate-400 hover:text-white transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <Search className="h-4 w-4 text-slate-400 pointer-events-none" />
                )}
              </div>
            </div>
          </div>

          {/* Post Creation Card */}
          <div className="max-w-2xl mx-auto w-full mb-10">
            <h2 className="font-semibold text-white mb-4 text-[14px] uppercase tracking-wide">Post Something</h2>
            {showComposerModal && user ? (
              <div className="bg-[#18181b]/55 backdrop-blur-md border border-blue-500/30 rounded-xl p-6 shadow-[0_0_30px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20 animate-in fade-in duration-300 relative">
                <button onClick={() => setShowComposerModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition z-10"><X className="w-4 h-4" /></button>
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
            ) : (
              <div 
                onClick={() => setShowComposerModal(true)}
                className="bg-[#18181b]/55 backdrop-blur-md border border-white/10 rounded-xl p-5 flex items-center gap-4 cursor-text shadow-sm hover:shadow transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-white/5 overflow-hidden flex-shrink-0 border border-white/10">
                  {user ? (
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/5 text-slate-400"><UserIcon className="w-5 h-5" /></div>
                  )}
                </div>
                <div className="flex-1 text-slate-300 font-medium text-[15px]">
                  What's on your mind?
                </div>
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 group-hover:text-blue-400 transition-colors cursor-pointer">
                  <ImageIcon className="w-5 h-5" />
                </div>
              </div>
            )}
          </div>

          {/* Matching Profiles */}
          {debouncedSearch && userSearchQuery.data?.length ? (
            <div className="max-w-2xl mx-auto w-full mb-8">
              <h2 className="font-semibold text-white mb-4 text-[14px] uppercase tracking-wide">People</h2>
              <div className="flex flex-col gap-2">
                {userSearchQuery.data.map((person) => (
                  <div
                    key={person.id}
                    className="bg-[#18181b]/55 backdrop-blur-md border border-white/10 rounded-xl p-3 flex items-center justify-between"
                  >
                    <Link href={`/profile/${person.username}`} className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${person.username}&backgroundColor=18181b`} alt="avatar" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{person.full_name || person.username}</div>
                        <div className="text-[11px] font-medium text-slate-400 truncate">@{person.username}</div>
                      </div>
                    </Link>
                    {user && (
                      <button
                        onClick={() => searchFollowMutation.mutate({ username: person.username, isFollowing: person.is_followed_by_me })}
                        disabled={searchFollowMutation.isPending}
                        className={cn(
                          "px-4 py-1.5 rounded-md text-xs font-semibold transition flex-shrink-0",
                          person.is_followed_by_me
                            ? "bg-white/10 text-slate-400 border border-transparent"
                            : "bg-white/5 text-slate-200 border border-white/10 backdrop-blur-sm hover:bg-white/10",
                        )}
                      >
                        {person.is_followed_by_me ? 'Followed' : 'Follow'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Timeline Header */}
          <div className="max-w-2xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <h1 className="text-lg font-semibold text-white tracking-tight">
              {debouncedSearch ? 'Matching Posts' : 'Timeline'}
            </h1>
            <div className="flex gap-4 sm:gap-6 text-sm font-medium text-slate-400">
                <button className="text-white border-b-2 border-white pb-1 font-semibold">All</button>
                <button className="hover:text-white pb-1">Following</button>
                <button className="hover:text-white pb-1">Newest</button>
                <button className="hover:text-white pb-1">Popular</button>
            </div>
          </div>

          {/* Timeline Feed (Standard Single Column) */}
          <div className="flex flex-col gap-6 pb-20 max-w-2xl mx-auto w-full">
            {postsQuery.isLoading ? (
              <div className="flex justify-center p-8 w-full"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
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
            ) : searchQuery ? (
              <div className="p-8 text-center text-slate-500 w-full col-span-2">
                No posts match "<span className="text-slate-300 font-medium">{searchQuery}</span>".
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 w-full col-span-2">No posts yet.</div>
            )}
          </div>
        </main>

        {/* RIGHT SIDEBAR AREA */}
        
        {/* FACT CHECK SIDEBAR */}
        <aside className={cn(
            "bg-[#18181b]/55 backdrop-blur-xl flex-col flex-shrink-0 h-screen overflow-hidden relative z-10 shadow-xl transition-all duration-500 ease-in-out",
            showVerificationPanel 
                ? "w-full lg:w-[360px] border-l border-white/10 opacity-100" 
                : "w-0 border-transparent opacity-0 hidden lg:flex"
        )}>
            <div className="w-full lg:w-[360px] p-6 flex flex-col h-full overflow-y-auto">
                {!selectedPostId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60 mt-20">
                        <ShieldCheck className="w-16 h-16 text-slate-400 mb-4" />
                        <p className="text-sm font-semibold text-slate-400">Select a post to view<br/>fact-check details.</p>
                    </div>
                ) : (
                    <div className="space-y-6 flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                        
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-white text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /> Fact-Check Details</h3>
                <button onClick={() => setSelectedPostId(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition text-slate-400"><X className="w-4 h-4" /></button>
              </div>

              {selectedPost && (
                <div className="text-sm font-medium text-slate-300 bg-white/5 p-4 rounded-2xl border border-white/10 shadow-sm">
                  Inspecting <span className="font-bold text-white">@{selectedPost.author.username}'s</span> claim.
                </div>
              )}

              <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                {verificationQuery.isLoading ? (
                  <Loading text="Analyzing claims..." />
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
                  <div className="text-sm text-slate-500 text-center py-10">
                    This post has not been analyzed by AI yet.
                  </div>
                )}

                {/* Moderation Queue inside the panel if applicable */}
                {(user?.role === 'moderator' || user?.role === 'admin') && moderationQuery.data?.length ? (
                  <div className="mt-8 pt-8 border-t border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg">
                      <AlertCircle className="w-5 h-5 text-amber-500" /> Moderation Queue
                    </h3>
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
                  </div>
                ) : null}
              </div>
            
                    </div>
                )}
            </div>
        </aside>

        {/* SUGGESTIONS & ACTIVITY SIDEBAR */}
        <aside className={cn(
            "bg-[#18181b]/55 backdrop-blur-xl border-l border-white/10 p-6 flex-col flex-shrink-0 h-screen overflow-y-auto relative z-10 shadow-xl transition-all duration-500",
            showVerificationPanel ? "hidden xl:flex w-[340px]" : "hidden lg:flex w-[340px]"
        )}>
            <div className="animate-in fade-in duration-300 w-[292px]">
               <ActivitySidebarContent />
            </div>
        </aside>

      </div>

    </div>
  );
}

// --- Components ---

function ActivitySidebarContent() {
  const queryClient = useQueryClient();
  const suggestionsQuery = useQuery({
    queryKey: ['follow-suggestions'],
    queryFn: () => getFollowSuggestions(5),
  });

  const followMutation = useMutation<
    void | FollowResponse,
    Error,
    { username: string; isFollowing: boolean },
    { previous?: FollowerListItem[] }
  >({
    mutationFn: ({ username, isFollowing }) =>
      isFollowing ? unfollowUser(username) : followUser(username),
    onMutate: async ({ username, isFollowing }) => {
      await queryClient.cancelQueries({ queryKey: ['follow-suggestions'] });
      const previous = queryClient.getQueryData<FollowerListItem[]>(['follow-suggestions']);
      queryClient.setQueryData<FollowerListItem[]>(['follow-suggestions'], (old) =>
        old?.map((person) =>
          person.username === username ? { ...person, is_followed_by_me: !isFollowing } : person,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['follow-suggestions'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['follow-suggestions'] }),
  });

  return (
    <div className="space-y-10">
      {/* People to Follow */}
      <div>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-white">People to follow</h3>
          <button className="text-xs font-bold text-blue-400 hover:text-blue-300">See all</button>
        </div>
        <div className="space-y-5">
          {suggestionsQuery.isLoading && (
            <div className="text-xs text-slate-500">Loading…</div>
          )}
          {!suggestionsQuery.isLoading && suggestionsQuery.data?.length === 0 && (
            <div className="text-xs text-slate-500">No suggestions right now.</div>
          )}
          {suggestionsQuery.data?.map((person) => (
            <div key={person.id} className="flex items-center justify-between">
              <Link href={`/profile/${person.username}`} className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${person.username}&backgroundColor=18181b`} alt="avatar" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{person.full_name || person.username}</div>
                  <div className="text-[11px] font-medium text-slate-400 truncate">@{person.username}</div>
                </div>
              </Link>
              <button
                onClick={() => followMutation.mutate({ username: person.username, isFollowing: person.is_followed_by_me })}
                disabled={followMutation.isPending}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${person.is_followed_by_me ? "bg-white/10 text-slate-400 border border-transparent" : "bg-white/5 text-slate-200 border border-white/10 backdrop-blur-sm hover:bg-white/10"}`}
              >
                {person.is_followed_by_me ? 'Followed' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* You Saved Grid */}
      <div>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-white">You Saved</h3>
          <button className="text-xs font-bold text-blue-400 hover:text-blue-300">See all</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-lg bg-gradient-to-tr from-slate-800 to-slate-900 overflow-hidden relative border border-white/10 backdrop-blur-md">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute bottom-2 left-2 w-3 h-3 rounded bg-white/20 shadow-sm"></div>
          </div>
          <div className="h-24 rounded-lg bg-gradient-to-br from-indigo-900/50 to-slate-800/50 backdrop-blur-md overflow-hidden border border-white/10"></div>
          <div className="h-24 rounded-lg bg-gradient-to-br from-slate-700/50 to-slate-800/50 backdrop-blur-md overflow-hidden border border-white/10"></div>
          <div className="h-24 rounded-lg bg-white/5 backdrop-blur-md overflow-hidden flex items-center justify-center relative border border-white/10">
            <div className="absolute w-8 h-16 bg-white/10 rounded shadow-sm rotate-12"></div>
            <div className="absolute w-4 h-12 bg-white/5 rounded left-4 -rotate-12"></div>
          </div>
        </div>
      </div>

      {/* Last Activity */}
      <div>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-white">Last Activity</h3>
          <button className="text-xs font-bold text-blue-400 hover:text-blue-300">See all</button>
        </div>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5"><MessageCircle className="w-4 h-4 text-blue-500 fill-blue-500" /></div>
            <div className="text-[13px] text-slate-400">You've Commented on Ahmed Mohamed <span className="font-bold text-white">Shot</span></div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5"><Heart className="w-4 h-4 text-red-500 fill-red-500" /></div>
            <div className="text-[13px] text-slate-400">You've Liked Noha Mohamed <span className="font-bold text-white">Shot</span></div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5"><Bookmark className="w-4 h-4 text-slate-500" /></div>
            <div className="text-[13px] text-slate-400">You've Saved Menna <span className="font-bold text-white">Shot</span> to your collection</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-white/20 focus:bg-white/10 transition" />;
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
    onSubmit(content, showSource ? sourceUrl : undefined);
    setContent('');
    setSourceUrl('');
    setShowSource(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-full bg-white/5 flex-shrink-0 overflow-hidden">
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="avatar" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="What's on your mind?"
            className="w-full h-32 bg-white/5 rounded-lg p-4 text-sm text-white outline-none border border-white/10 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/20 focus:shadow-[0_0_20px_rgba(59,130,246,0.2)] focus:bg-white/10 transition-all duration-300 font-medium resize-none placeholder-slate-500"
          />
        </div>
      </div>

      {showSource && (
        <div className="pl-16">
          <TextInput value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Attach a source URL (optional) for fact-checking" />
        </div>
      )}

      <div className="flex items-center justify-between pl-16 pt-2">
        <div className="flex gap-1 border border-white/10 rounded-lg p-1 bg-white/5 shadow-sm">
          <button type="button" className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-white/5 rounded transition" title="Image">
            <ImageIcon className="w-4 h-4" />
          </button>
          <button type="button" className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-white/5 rounded transition" title="Video">
            <Video className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setShowSource(!showSource)} className={cn("w-8 h-8 flex items-center justify-center rounded transition", showSource ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5")} title="Source URL">
            <Globe className="w-4 h-4" />
          </button>
          <button type="button" className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-white/5 rounded transition" title="Location">
            <MapPin className="w-4 h-4" />
          </button>
        </div>

        <button disabled={busy || content.trim().length < 5} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-blue-700 transition shadow-sm">
          {busy ? 'Publishing...' : 'Publish'}
        </button>
      </div>
      {error && <div className="mt-2 pl-16"><ErrorBanner text={error} /></div>}
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
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [justShared, setJustShared] = useState(false);

  const likeMutation = useMutation({
    mutationFn: () => (post.is_liked_by_me ? unlikePost(post.id) : likePost(post.id)),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      const previous = queryClient.getQueryData<Post[]>(['posts']);
      queryClient.setQueryData<Post[]>(['posts'], (old) =>
        old?.map((p) =>
          p.id === post.id
            ? { ...p, is_liked_by_me: !p.is_liked_by_me, likes_count: p.likes_count + (p.is_liked_by_me ? -1 : 1) }
            : p,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['posts'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
  });

  const commentsQuery = useQuery({
    queryKey: ['comments', post.id],
    queryFn: () => listComments(post.id),
    enabled: showComments,
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) => addComment(post.id, content),
    onSuccess: () => {
      setCommentDraft('');
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      queryClient.setQueryData<Post[]>(['posts'], (old) =>
        old?.map((p) => (p.id === post.id ? { ...p, comments_count: p.comments_count + 1 } : p)),
      );
    },
  });

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?post=${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Verique', text: post.content.slice(0, 100), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setJustShared(true);
      setTimeout(() => setJustShared(false), 1500);
    } catch {
      // user cancelled the share sheet — no-op
    }
  };

  return (
    <div 
      className={cn(
        "bg-[#18181b]/55 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow transition-all duration-300",
        selected ? "border-blue-500 ring-2 ring-blue-500/20" : ""
      )}
      onClick={onSelect}
    >
      {/* Header (Author) */}
      <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
          <Link href={`/profile/${post.author.username}`} className="w-10 h-10 rounded-full bg-white/5 overflow-hidden shadow-sm hover:ring-2 hover:ring-violet-500/50 transition-all flex-shrink-0">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author.username}`} alt="avatar" className="w-full h-full object-cover" />
          </Link>
          <div>
            <Link href={`/profile/${post.author.username}`} className="text-[15px] font-bold text-white leading-tight hover:text-violet-300 transition-colors">{post.author.full_name || post.author.username}</Link>
            <div className="text-xs text-slate-400 font-medium">@{post.author.username}</div>
          </div>
        </div>
        {/* Badges */}
        <div className="flex items-center gap-2">
         {verification ? (
            <div className={cn("px-2.5 py-1 rounded text-[10px] font-semibold tracking-widest uppercase border flex items-center gap-1.5 shadow-sm", 
               verification.score && verification.score > 70 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
               verification.score && verification.score < 40 ? "bg-red-500/10 text-red-400 border-red-500/20" : 
               "bg-amber-500/10 text-amber-400 border-amber-500/20")}
            >
               <ShieldCheck className="w-3.5 h-3.5"/> Fact-Checked: {verification.score}
            </div>
         ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); onVerify(); }}
              disabled={!canVerify || busy}
              className="px-3 py-1.5 rounded bg-white/5 text-slate-300 text-[10px] font-semibold uppercase tracking-widest border border-white/10 hover:bg-white/10 transition shadow-sm"
            >
               {busy ? 'Running AI...' : 'Verify Claim'}
            </button>
         )}
        </div>
      </div>

      {/* Body (Content) */}
      <div className="p-5">
        <p className="text-slate-200 text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
          {post.content}
        </p>
        
        {post.source_url && (
          <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 group/link hover:bg-white/10 transition">
            <Globe className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <a href={post.source_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[13px] font-semibold text-blue-400 hover:text-blue-300 line-clamp-1">
              {getDomainFromUrl(post.source_url)}
            </a>
          </div>
        )}
      </div>

      {/* Footer (Actions) */}
      <div className="px-5 py-3 bg-white/5 border-t border-white/10 flex items-center gap-6 text-slate-400">
        <button
          onClick={(e) => { e.stopPropagation(); likeMutation.mutate(); }}
          disabled={likeMutation.isPending}
          className="flex items-center gap-1.5 group/icon cursor-pointer"
        >
          <Heart className={cn("w-4 h-4 transition", post.is_liked_by_me ? "text-red-500 fill-red-500" : "group-hover/icon:text-red-500")} />
          <span className="text-[13px] font-bold">{post.likes_count}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowComments((v) => !v); }}
          className="flex items-center gap-1.5 group/icon cursor-pointer"
        >
          <MessageSquare className={cn("w-4 h-4 transition", showComments ? "text-blue-400" : "group-hover/icon:text-blue-400")} />
          <span className="text-[13px] font-bold">{post.comments_count}</span>
        </button>
        <button onClick={handleShare} className="flex items-center gap-1.5 group/icon cursor-pointer">
          {justShared ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Share2 className="w-4 h-4 transition group-hover/icon:text-emerald-400" />
          )}
          <span className="text-[13px] font-bold">{justShared ? 'Copied!' : 'Share'}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="px-5 py-4 bg-black/20 border-t border-white/10 space-y-4"
        >
          {commentsQuery.isLoading ? (
            <div className="text-xs text-slate-500">Loading comments…</div>
          ) : commentsQuery.data?.length ? (
            <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
              {commentsQuery.data.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.author.username}`} alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-[13px] text-slate-300 bg-white/5 rounded-lg px-3 py-2 flex-1">
                    <span className="font-bold text-white mr-1.5">@{comment.author.username}</span>
                    {comment.content}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">No comments yet. Be the first to reply.</div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (commentDraft.trim()) addCommentMutation.mutate(commentDraft.trim());
            }}
            className="flex items-center gap-2"
          >
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Write a comment…"
              className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-[13px] text-white placeholder-slate-500 outline-none focus:border-blue-500/50 transition"
            />
            <button
              type="submit"
              disabled={!commentDraft.trim() || addCommentMutation.isPending}
              className="w-9 h-9 flex-shrink-0 rounded-lg bg-blue-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-blue-700 transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
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
  const score = verification.score ?? 0;
  const hasScore = verification.score !== null && verification.score !== undefined;
  
  let containerColor = "border-slate-500/20 bg-slate-500/10";
  let labelColor = "text-slate-500";
  let scoreColor = "text-slate-400";
  let badgeColor = "text-slate-300 bg-slate-500/20 border-slate-500/20";
  let iconColor = "text-slate-400";

  if (hasScore) {
    if (score >= 70) {
      containerColor = "border-emerald-500/20 bg-emerald-500/10";
      labelColor = "text-emerald-500";
      scoreColor = "text-emerald-400";
      badgeColor = "text-emerald-300 bg-emerald-500/20 border-emerald-500/20";
      iconColor = "text-emerald-400";
    } else if (score >= 40) {
      containerColor = "border-amber-500/20 bg-amber-500/10";
      labelColor = "text-amber-500";
      scoreColor = "text-amber-400";
      badgeColor = "text-amber-300 bg-amber-500/20 border-amber-500/20";
      iconColor = "text-amber-400";
    } else {
      containerColor = "border-red-500/20 bg-red-500/10";
      labelColor = "text-red-500";
      scoreColor = "text-red-400";
      badgeColor = "text-red-300 bg-red-500/20 border-red-500/20";
      iconColor = "text-red-400";
    }
  }

  return (
    <div className="space-y-4">
      <div className={cn("rounded-xl border p-6 relative overflow-hidden", containerColor)}>
        <div className="absolute -right-4 -bottom-4 opacity-10">
          <ShieldCheck className={cn("w-32 h-32", iconColor)} />
        </div>
        <div className="flex items-end justify-between relative z-10">
          <div>
            <div className={cn("text-[10px] uppercase font-semibold tracking-widest", labelColor)}>Verity Score</div>
            <div className={cn("text-4xl font-bold mt-1", scoreColor)}>{verification.score ?? '--'}</div>
          </div>
          <div className={cn("text-right text-xs font-semibold backdrop-blur px-3 py-1.5 rounded border shadow-sm", badgeColor)}>
            <div>{verification.status}</div>
          </div>
        </div>
        {verification.final_decision_note && <p className={cn("mt-4 rounded-lg bg-black/20 px-4 py-3 text-sm text-slate-200 shadow-sm border font-medium leading-relaxed", containerColor.split(' ')[0])}>{verification.final_decision_note}</p>}
      </div>

      <div className="space-y-4">
        {verification.claims.map((claim) => {
          const config = VERDICT_CONFIG[claim.verdict];
          return (
            <div key={claim.id} className="rounded-xl border border-white/10 shadow-sm p-5 bg-white/5 transition hover:bg-white/10">
              <div className="flex items-center justify-between mb-4">
                <span className={cn('rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest border', config.bgColor.replace('50', '500/10'), config.color.replace('700', '400'), config.color.replace('text-', 'border-').replace('700', '500/20'))}>{config.label}</span>
                <span className="text-xs font-semibold text-slate-400 bg-white/5 px-2 py-1 rounded-md border border-white/10">{Math.round(claim.confidence * 100)}% conf</span>
              </div>
              <p className="text-sm font-semibold text-white mb-2 leading-relaxed">{claim.text}</p>
              <p className="text-[13px] leading-relaxed text-slate-300 font-medium">{claim.reasoning}</p>

              {(claim.sources.supporting.length > 0 || claim.sources.contradicting.length > 0) && (
                <div className="mt-5 pt-4 border-t border-white/10 grid gap-4">
                  {claim.sources.supporting.length > 0 && <SourceBox title="Supporting Evidence" sources={claim.sources.supporting} />}
                  {claim.sources.contradicting.length > 0 && <SourceBox title="Contradicting Evidence" sources={claim.sources.contradicting} />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-amber-400">
          <AlertCircle className="h-5 w-5" />
          Dispute this verdict
        </div>
        {canChallenge ? (
          <div className="space-y-3">
            <select value={challengeReason} onChange={(event) => setChallengeReason(event.target.value)} className="w-full rounded-lg border border-amber-500/20 bg-black/20 text-slate-200 px-4 py-2.5 text-sm font-medium outline-none focus:border-amber-500/50 focus:ring-1 ring-amber-500/20 transition shadow-sm">
              {CHALLENGE_REASONS.map(([value, label]) => <option key={value} value={value} className="bg-slate-900 text-white">{label}</option>)}
            </select>
            <textarea
              value={challengeComment}
              onChange={(event) => setChallengeComment(event.target.value)}
              placeholder="Why is this verdict wrong?"
              className="h-24 w-full rounded-lg border border-amber-500/20 bg-black/20 text-slate-200 px-4 py-3 text-sm font-medium outline-none focus:border-amber-500/50 focus:ring-1 ring-amber-500/20 transition resize-none shadow-sm placeholder-slate-500"
            />
            {error && <ErrorBanner text={error} />}
            <button onClick={onChallenge} disabled={busy} className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition disabled:opacity-50 shadow-sm">
              {busy ? 'Submitting...' : 'Submit Challenge'}
            </button>
          </div>
        ) : (
          <div className="text-xs font-semibold text-amber-400 bg-amber-500/10 p-4 rounded-lg text-center border border-amber-500/20">Sign in to challenge verdicts.</div>
        )}
      </div>
    </div>
  );
}

function SourceBox({ title, sources }: { title: string; sources: { url: string; snippet: string }[] }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">{title}</div>
      <div className="space-y-2">
        {sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block rounded-lg bg-white/5 border border-white/10 p-3 hover:bg-white/10 hover:border-white/20 hover:shadow-sm transition group">
            <div className="text-[13px] font-semibold text-blue-400 flex items-center gap-1.5 mb-1.5 group-hover:text-blue-300"><Globe className="w-3.5 h-3.5" /> {getDomainFromUrl(source.url)}</div>
            <div className="text-[12px] text-slate-300 line-clamp-2 leading-relaxed font-medium">{source.snippet}</div>
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
    <div className="rounded-xl border border-white/10 bg-white/5 shadow-sm p-5 hover:bg-white/10 transition-all duration-300">
      <div className="font-semibold text-white text-sm mb-2">@{review.post.author.username}'s post</div>
      <p className="text-sm text-slate-300 line-clamp-2 mb-4 bg-black/20 p-3 rounded-lg border border-white/10 font-medium">{review.post.content}</p>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 inline-block px-2.5 py-1.5 rounded mb-4 border border-amber-500/20">
        Score {review.verification.score ?? '--'} · {review.verification.challenge_count} challenges
      </div>
      <div className="space-y-3">
        <select value={decision} onChange={(event) => setDecision(event.target.value as 'uphold' | 'revise' | 'remove_verdict')} className="w-full rounded-lg border border-white/10 bg-black/20 text-white px-4 py-2.5 text-sm font-medium outline-none focus:border-white/20">
          <option value="uphold" className="bg-slate-900">Uphold verdict</option>
          <option value="revise" className="bg-slate-900">Revise verdict</option>
          <option value="remove_verdict" className="bg-slate-900">Remove verdict</option>
        </select>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Moderator note (required)" className="h-20 w-full rounded-lg border border-white/10 bg-black/20 text-white px-4 py-3 text-sm font-medium outline-none resize-none focus:border-white/20 placeholder-slate-500" />
        <input value={overrideScore} onChange={(event) => setOverrideScore(event.target.value)} placeholder="Override score (optional)" className="w-full rounded-lg border border-white/10 bg-black/20 text-white px-4 py-2.5 text-sm font-medium outline-none focus:border-white/20 placeholder-slate-500" />
        <textarea value={overrideSummary} onChange={(event) => setOverrideSummary(event.target.value)} placeholder="Public override summary (optional)" className="h-20 w-full rounded-lg border border-white/10 bg-black/20 text-white px-4 py-3 text-sm font-medium outline-none resize-none focus:border-white/20 placeholder-slate-500" />
        <button onClick={onResolve} disabled={busy || note.trim().length < 5} className="w-full rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition disabled:opacity-50">
          {busy ? 'Resolving...' : 'Resolve Review'}
        </button>
      </div>
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return <div className="flex flex-col items-center justify-center gap-3 text-sm font-semibold text-slate-400 py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" />{text}</div>;
}

function ErrorBanner({ text }: { text: string }) {
  return <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 font-semibold shadow-sm">{text}</div>;
}

function tab(active: boolean) {
  return cn('flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-all', active ? 'bg-white/10 text-white shadow-sm border border-white/10' : 'text-slate-400 hover:text-slate-200');
}
