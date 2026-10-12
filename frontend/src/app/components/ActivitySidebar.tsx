'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Heart, Bookmark } from 'lucide-react';
import { getFollowSuggestions, followUser, unfollowUser } from '@/lib/api';
import { FollowerListItem, FollowResponse } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ActivitySidebarContent() {
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
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${person.username}&backgroundColor=18181b`}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{person.full_name || person.username}</div>
                  <div className="text-[11px] font-medium text-slate-400 truncate">@{person.username}</div>
                </div>
              </Link>
              <button
                onClick={() =>
                  followMutation.mutate({
                    username: person.username,
                    isFollowing: person.is_followed_by_me,
                  })
                }
                disabled={followMutation.isPending}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${
                  person.is_followed_by_me
                    ? 'bg-white/10 text-slate-400 border border-transparent'
                    : 'bg-white/5 text-slate-200 border border-white/10 backdrop-blur-sm hover:bg-white/10'
                }`}
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
            <div className="mt-0.5">
              <MessageCircle className="w-4 h-4 text-blue-500 fill-blue-500" />
            </div>
            <div className="text-[13px] text-slate-400">
              You&apos;ve Commented on Ahmed Mohamed <span className="font-bold text-white">Shot</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            </div>
            <div className="text-[13px] text-slate-400">
              You&apos;ve Liked Noha Mohamed <span className="font-bold text-white">Shot</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Bookmark className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-[13px] text-slate-400">
              You&apos;ve Saved Menna <span className="font-bold text-white">Shot</span> to your collection
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActivitySidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        'bg-[#18181b]/55 backdrop-blur-xl border-l border-white/10 p-6 flex-col flex-shrink-0 h-screen overflow-y-auto relative z-10 shadow-xl transition-all duration-500 hidden lg:flex w-[340px]',
        className,
      )}
    >
      <div className="animate-in fade-in duration-300 w-[292px]">
        <ActivitySidebarContent />
      </div>
    </aside>
  );
}
