'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Globe,
  Loader2,
  Shield,
  ShieldCheck,
  User as UserIcon,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  FileText,
  AlertCircle,
  MessageCircle,
  TrendingUp,
  Award,
} from 'lucide-react';

import {
  followUser,
  getFollowers,
  getFollowing,
  getCurrentUser,
  getUserPosts,
  getUserProfile,
  unfollowUser,
} from '@/lib/api';
import {
  FollowerListItem,
  Post,
  User,
  UserProfile,
  VERDICT_CONFIG,
} from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { AnimatedCanvas } from '@/app/components/AnimatedCanvas';
import { Sidebar } from '@/app/components/Sidebar';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function getInitials(profile: UserProfile | null) {
  if (!profile) return '?';
  if (profile.full_name) {
    return profile.full_name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  return profile.username.slice(0, 2).toUpperCase();
}

function getGradient(username: string) {
  const gradients = [
    'from-violet-600 to-indigo-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-teal-600',
    'from-sky-500 to-blue-600',
    'from-fuchsia-500 to-purple-600',
    'from-lime-500 to-green-600',
    'from-red-500 to-rose-600',
  ];
  const idx =
    username.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    gradients.length;
  return gradients[idx];
}

function getScoreColor(score: number | null | undefined) {
  if (score === null || score === undefined) return 'text-slate-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreLabel(score: number | null | undefined) {
  if (score === null || score === undefined) return 'Unverified';
  if (score >= 80) return 'Trusted';
  if (score >= 60) return 'Mixed';
  if (score >= 40) return 'Weak';
  return 'Disputed';
}

// -----------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------

function StatPill({
  count,
  label,
  active,
  onClick,
}: {
  count: number;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-0.5 px-5 py-3 rounded-2xl transition-all duration-200 cursor-pointer',
        active
          ? 'bg-white/10 ring-1 ring-white/20'
          : 'hover:bg-white/5',
      )}
    >
      <span className="text-2xl font-bold text-white tabular-nums drop-shadow-sm">
        {count.toLocaleString()}
      </span>
      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">
        {label}
      </span>
    </button>
  );
}

function UserCard({
  user,
  currentUserId,
  onToggleFollow,
}: {
  user: FollowerListItem;
  currentUserId?: number;
  onToggleFollow: (username: string, isFollowing: boolean) => void;
}) {
  const gradient = getGradient(user.username);
  const initials = user.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user.username.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-[#18181b]/55 backdrop-blur-md border border-white/10 hover:shadow-sm transition-all duration-300 group">
      <Link href={`/profile/${user.username}`} className="flex-shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-white/5 border border-white/10 shadow-lg">
          <img 
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
            alt={user.username} 
            className="w-full h-full object-cover" 
          />
        </div>
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/profile/${user.username}`} className="block">
          <p className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
            {user.full_name || user.username}
          </p>
          <p className="text-xs font-medium text-slate-400 truncate mt-0.5">@{user.username}</p>
          {user.bio && (
            <p className="text-xs text-slate-300 mt-1 line-clamp-1">{user.bio}</p>
          )}
        </Link>
      </div>
      {currentUserId && currentUserId !== user.id && (
        <button
          onClick={() => onToggleFollow(user.username, user.is_followed_by_me)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex-shrink-0 shadow-sm',
            user.is_followed_by_me
              ? 'bg-white/10 text-slate-300 hover:bg-red-500/20 hover:text-red-400 border border-transparent'
              : 'bg-blue-600 text-white hover:bg-blue-700',
          )}
        >
          {user.is_followed_by_me ? (
            <>
              <UserMinus className="w-3 h-3" /> Unfollow
            </>
          ) : (
            <>
              <UserPlus className="w-3 h-3" /> Follow
            </>
          )}
        </button>
      )}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const score = post.latest_verification_summary?.score;
  const status = post.latest_verification_summary?.status;

  return (
    <div className="p-5 rounded-xl bg-[#18181b]/55 backdrop-blur-md border border-white/10 hover:shadow-sm transition-all duration-300">
      <p className="text-slate-200 text-[15px] font-medium leading-relaxed whitespace-pre-wrap">{post.content}</p>
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/10">
        <span className="text-xs font-medium text-slate-400">{formatDate(post.created_at)}</span>
        <div className="flex items-center gap-2">
          {status && status !== 'pending' ? (
            <div className="flex items-center gap-1.5">
              <ShieldCheck className={cn('w-4 h-4', getScoreColor(score))} />
              <span className={cn('text-xs font-semibold tabular-nums', getScoreColor(score))}>
                {score !== null && score !== undefined ? `${score}%` : '—'}
              </span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                score !== undefined && score !== null && score >= 80
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : score !== undefined && score !== null && score >= 60
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-red-500/15 text-red-400'
              )}>
                {getScoreLabel(score)}
              </span>
            </div>
          ) : (
            <span className="text-xs text-white/30 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Unverified
            </span>
          )}
          {post.source_url && (
            <a
              href={post.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/30 hover:text-violet-400 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------

type TabId = 'posts' | 'followers' | 'following';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params?.username as string;
  const queryClient = useQueryClient();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('posts');

  useEffect(() => {
    getCurrentUser()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, []);

  // Queries
  const profileQuery = useQuery({
    queryKey: ['profile', username],
    queryFn: () => getUserProfile(username),
    enabled: !!username,
  });

  const postsQuery = useQuery({
    queryKey: ['user-posts', username],
    queryFn: () => getUserPosts(username),
    enabled: !!username && activeTab === 'posts',
  });

  const followersQuery = useQuery({
    queryKey: ['followers', username],
    queryFn: () => getFollowers(username),
    enabled: !!username && activeTab === 'followers',
  });

  const followingQuery = useQuery({
    queryKey: ['following', username],
    queryFn: () => getFollowing(username),
    enabled: !!username && activeTab === 'following',
  });

  // Follow / Unfollow mutations
  const followMutation = useMutation({
    mutationFn: (uname: string) => followUser(uname),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      queryClient.invalidateQueries({ queryKey: ['followers', username] });
      queryClient.invalidateQueries({ queryKey: ['following', username] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (uname: string) => unfollowUser(uname),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      queryClient.invalidateQueries({ queryKey: ['followers', username] });
      queryClient.invalidateQueries({ queryKey: ['following', username] });
    },
  });

  const handleToggleFollow = (uname: string, isFollowing: boolean) => {
    if (isFollowing) unfollowMutation.mutate(uname);
    else followMutation.mutate(uname);
  };

  const profile = profileQuery.data;
  const isOwnProfile = currentUser?.username === username;
  const isFollowing = profile?.is_followed_by_me ?? false;
  const isMutating = followMutation.isPending || unfollowMutation.isPending;

  const tabs: { id: TabId; label: string; count?: number; icon: React.ElementType }[] = [
    { id: 'posts', label: 'Posts', count: profile?.posts_count, icon: FileText },
    { id: 'followers', label: 'Followers', count: profile?.followers_count, icon: Users },
    { id: 'following', label: 'Following', count: profile?.following_count, icon: UserCheck },
  ];

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-violet-600/20 animate-ping" />
            <div className="relative w-16 h-16 rounded-full bg-violet-600/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
          </div>
          <p className="text-white/40 text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-xs">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-white font-semibold text-lg">User not found</p>
          <p className="text-white/40 text-sm">@{username} doesn't exist or has been deactivated.</p>
          <button
            onClick={() => router.back()}
            className="mt-2 px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex overflow-hidden font-sans">
      <AnimatedCanvas className="fixed inset-0 z-0" interactive={false} />
      <div className="w-full bg-transparent flex overflow-hidden min-h-screen relative z-10">
        {/* Spacer for sidebar */}
        <div className="w-[100px] flex-shrink-0 hidden sm:block"></div>
        <Sidebar user={currentUser} onLogout={() => setCurrentUser(null)} />

        <main className="flex-1 flex flex-col h-screen overflow-y-auto px-8 py-10 relative">
          <div className="max-w-3xl mx-auto w-full">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 text-sm font-semibold transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Profile card */}
        <div className="rounded-xl overflow-hidden border border-white/10 bg-[#18181b]/55 backdrop-blur-md shadow-sm">
          {/* Header banner */}
          <div className="h-32 bg-gradient-to-r from-blue-900/40 to-slate-900/40 relative border-b border-white/5">
            <div className="absolute inset-0 bg-[#18181b]/50" />
            {/* Decorative circles */}
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-blue-500/10 blur-xl" />
            <div className="absolute -top-4 left-1/2 w-24 h-24 rounded-full bg-blue-500/10 blur-2xl" />
          </div>

          {/* Avatar + actions row */}
          <div className="px-6 -mt-12 flex items-end justify-between relative z-10">
            <div className="w-24 h-24 rounded-xl overflow-hidden shadow-xl border-4 border-[#18181b] bg-white/5">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`} 
                alt={profile.username} 
                className="w-full h-full object-cover bg-white/5" 
              />
            </div>

            <div className="pb-2 flex items-center gap-2">
              {!isOwnProfile && currentUser ? (
                <>
                  <Link
                    href={`/messages/${profile.username}`}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition-all duration-200 shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </Link>
                  <button
                    onClick={() => handleToggleFollow(profile.username, isFollowing)}
                    disabled={isMutating}
                    className={cn(
                      'flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-200 disabled:opacity-60 shadow-sm',
                      isFollowing
                        ? 'bg-white/10 text-slate-300 hover:bg-red-500/20 hover:text-red-400 border border-transparent'
                        : 'bg-blue-600 text-white hover:bg-blue-700',
                    )}
                  >
                    {isMutating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <UserMinus className="w-4 h-4" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Follow
                      </>
                    )}
                  </button>
                </>
              ) : isOwnProfile ? (
                <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs font-bold uppercase tracking-widest shadow-sm">
                  <UserIcon className="w-3.5 h-3.5" /> Your Profile
                </div>
              ) : null}
            </div>
          </div>

          {/* User info */}
          <div className="px-6 pt-4 pb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white">
                {profile.full_name || profile.username}
              </h1>
              {profile.role !== 'user' && (
                <span
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider',
                    profile.role === 'admin'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
                  )}
                >
                  <Award className="w-3 h-3" />
                  {profile.role}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs font-medium mt-1">@{profile.username}</p>
            {profile.bio && (
              <p className="text-slate-300 text-[15px] font-medium mt-4 leading-relaxed">{profile.bio}</p>
            )}
            <div className="flex items-center gap-3 mt-4 text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-1 mt-5 -mx-2 flex-wrap">
              <StatPill
                count={profile.posts_count}
                label="Posts"
                active={activeTab === 'posts'}
                onClick={() => setActiveTab('posts')}
              />
              <StatPill
                count={profile.followers_count}
                label="Followers"
                active={activeTab === 'followers'}
                onClick={() => setActiveTab('followers')}
              />
              <StatPill
                count={profile.following_count}
                label="Following"
                active={activeTab === 'following'}
                onClick={() => setActiveTab('following')}
              />
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="mt-8 flex rounded-xl bg-white/5 border border-white/10 p-1.5 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-bold uppercase tracking-wider transition-all duration-200',
                  activeTab === tab.id
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5',
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full',
                      activeTab === tab.id
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-white/10 text-slate-400',
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="mt-4 space-y-3">
          {/* Posts tab */}
          {activeTab === 'posts' && (
            <>
              {postsQuery.isLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                </div>
              )}
              {postsQuery.isSuccess && postsQuery.data.length === 0 && (
                <div className="text-center py-16">
                  <FileText className="w-12 h-12 text-white/15 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No posts yet</p>
                </div>
              )}
              {postsQuery.data?.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </>
          )}

          {/* Followers tab */}
          {activeTab === 'followers' && (
            <>
              {followersQuery.isLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                </div>
              )}
              {followersQuery.isSuccess && followersQuery.data.length === 0 && (
                <div className="text-center py-16">
                  <Users className="w-12 h-12 text-white/15 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No followers yet</p>
                </div>
              )}
              {followersQuery.data?.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  currentUserId={currentUser?.id}
                  onToggleFollow={handleToggleFollow}
                />
              ))}
            </>
          )}

          {/* Following tab */}
          {activeTab === 'following' && (
            <>
              {followingQuery.isLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                </div>
              )}
              {followingQuery.isSuccess && followingQuery.data.length === 0 && (
                <div className="text-center py-16">
                  <UserCheck className="w-12 h-12 text-white/15 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">
                    {isOwnProfile ? "You're not following anyone yet" : 'Not following anyone yet'}
                  </p>
                </div>
              )}
              {followingQuery.data?.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  currentUserId={currentUser?.id}
                  onToggleFollow={handleToggleFollow}
                />
              ))}
            </>
          )}
        </div>
      </div>
      </main>
      </div>
    </div>
  );
}
