'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Heart,
  MessageCircle,
  UserPlus,
  Bell,
  CheckCheck,
  ArrowRight,
  Sparkles,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

import {
  clearAuthToken,
  getCurrentUser,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api';
import { Notification, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AnimatedCanvas } from '@/app/components/AnimatedCanvas';
import { Sidebar } from '@/app/components/Sidebar';
import { ActivitySidebar } from '@/app/components/ActivitySidebar';

// ─── Visual configuration per notification type ──────────────────────────────

const TYPE_CONFIG: Record<
  Notification['type'],
  { icon: React.ReactNode; badgeBg: string; badgeText: string; accentBorder: string; glow: string }
> = {
  like: {
    icon: <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />,
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-400',
    accentBorder: 'border-rose-500/30',
    glow: 'from-rose-500/10',
  },
  comment: {
    icon: <MessageCircle className="w-3.5 h-3.5 fill-blue-500 text-blue-500" />,
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-400',
    accentBorder: 'border-blue-500/30',
    glow: 'from-blue-500/10',
  },
  follow: {
    icon: <UserPlus className="w-3.5 h-3.5 text-emerald-400" />,
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-400',
    accentBorder: 'border-emerald-500/30',
    glow: 'from-emerald-500/10',
  },
};

function notifActionText(n: Notification): string {
  switch (n.type) {
    case 'like':
      return 'liked your post';
    case 'comment':
      return 'commented on your post';
    case 'follow':
      return 'started following you';
    default:
      return 'interacted with you';
  }
}

// ─── Single Notification Item ─────────────────────────────────────────────────

function NotificationRow({
  notif,
  onRead,
}: {
  notif: Notification;
  onRead: (id: number) => void;
}) {
  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.like;
  
  // Format relative timestamp with safety fallback
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(notif.created_at), { addSuffix: true });
    } catch {
      return 'recently';
    }
  }, [notif.created_at]);

  const fullDate = useMemo(() => {
    try {
      return format(new Date(notif.created_at), 'PPP · p');
    } catch {
      return '';
    }
  }, [notif.created_at]);

  const handleClick = () => {
    if (!notif.is_read) {
      onRead(notif.id);
    }
  };

  const cardContent = (
    <div
      onClick={handleClick}
      className={cn(
        'group relative flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 border',
        notif.is_read
          ? 'bg-[#18181b]/55 backdrop-blur-md border-white/5 hover:border-white/15 hover:bg-white/[0.04]'
          : `bg-gradient-to-r ${cfg.glow} to-[#18181b]/70 backdrop-blur-md border-white/10 hover:border-white/20 shadow-lg shadow-black/20`,
      )}
    >
      {/* Unread indicator dot */}
      {!notif.is_read && (
        <span
          className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-400 ring-4 ring-blue-400/20 animate-pulse"
          title="Unread"
        />
      )}

      {/* Actor avatar + type badge */}
      <div className="relative flex-shrink-0 mt-0.5">
        <Link
          href={`/profile/${notif.actor.username}`}
          onClick={(e) => e.stopPropagation()}
          className="block w-11 h-11 rounded-full overflow-hidden bg-white/5 border border-white/10 hover:ring-2 hover:ring-blue-500/50 transition-all"
        >
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${notif.actor.username}`}
            alt={notif.actor.username}
            className="w-full h-full object-cover"
          />
        </Link>
        <div
          className={cn(
            'absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border border-[#18181b] shadow-sm',
            cfg.badgeBg,
            cfg.badgeText,
          )}
        >
          {cfg.icon}
        </div>
      </div>

      {/* Main notification body */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="text-sm leading-relaxed">
          <Link
            href={`/profile/${notif.actor.username}`}
            onClick={(e) => e.stopPropagation()}
            className="font-bold text-white hover:text-blue-400 transition-colors inline"
          >
            {notif.actor.full_name || `@${notif.actor.username}`}
          </Link>{' '}
          <span className="text-slate-400 text-xs font-normal">
            @{notif.actor.username}
          </span>{' '}
          <span className={cn('text-sm font-medium', notif.is_read ? 'text-slate-300' : 'text-white/95')}>
            {notifActionText(notif)}
          </span>
        </div>

        {/* Comment preview if present */}
        {notif.preview && (
          <div className="mt-2 text-xs text-slate-300 bg-white/5 border border-white/10 rounded-lg p-2.5 italic line-clamp-2">
            &ldquo;{notif.preview}&rdquo;
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-2 flex items-center gap-2">
          <span
            className="text-[11px] font-medium text-slate-400 hover:text-slate-300 transition-colors"
            title={fullDate}
          >
            {timeAgo}
          </span>
          {notif.type === 'follow' && (
            <Link
              href={`/profile/${notif.actor.username}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 ml-2"
            >
              View Profile
            </Link>
          )}
        </div>
      </div>

      {/* Arrow for posts */}
      {notif.post_id && (
        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors flex-shrink-0 mt-3 self-center" />
      )}
    </div>
  );

  if (notif.post_id) {
    return (
      <Link href={`/?post=${notif.post_id}`} className="block">
        {cardContent}
      </Link>
    );
  }

  if (notif.type === 'follow') {
    return (
      <Link href={`/profile/${notif.actor.username}`} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 shadow-inner">
        <Bell className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-white font-bold text-lg mb-1">
        {filter === 'all' ? "You're all caught up!" : `No ${filter} notifications`}
      </h3>
      <p className="text-sm text-slate-400 max-w-sm">
        {filter === 'all'
          ? 'When someone likes your posts, leaves a comment, or follows you, you will see it here.'
          : `You don't have any ${filter} notifications yet.`}
      </p>
    </div>
  );
}

// ─── Main Notifications Page ──────────────────────────────────────────────────

type FilterType = 'all' | 'unread' | 'like' | 'comment' | 'follow';

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  // Authenticate user
  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        setCurrentUser(u);
        setAuthChecked(true);
      })
      .catch(async () => {
        await clearAuthToken();
        setCurrentUser(null);
        setAuthChecked(true);
      });
  }, []);

  useEffect(() => {
    if (authChecked && !currentUser) {
      router.push('/login');
    }
  }, [authChecked, currentUser, router]);

  // Fetch notifications list
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications(50),
    enabled: !!currentUser,
    refetchInterval: 15_000,
  });

  // Mark all read mutation
  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  // Mark single read mutation
  const markOneMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((n) => !n.is_read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  // Group into date buckets: Today, Yesterday, Earlier
  const buckets = useMemo(() => {
    const todayStr = new Date().toDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();

    const todayItems: Notification[] = [];
    const yesterdayItems: Notification[] = [];
    const earlierItems: Notification[] = [];

    for (const item of filteredNotifications) {
      const d = new Date(item.created_at).toDateString();
      if (d === todayStr) {
        todayItems.push(item);
      } else if (d === yesterdayStr) {
        yesterdayItems.push(item);
      } else {
        earlierItems.push(item);
      }
    }

    const res: { label: string; items: Notification[] }[] = [];
    if (todayItems.length) res.push({ label: 'Today', items: todayItems });
    if (yesterdayItems.length) res.push({ label: 'Yesterday', items: yesterdayItems });
    if (earlierItems.length) res.push({ label: 'Earlier', items: earlierItems });
    return res;
  }, [filteredNotifications]);

  return (
    <div className="min-h-screen bg-transparent flex overflow-hidden font-sans">
      <AnimatedCanvas className="fixed inset-0 z-0" interactive={false} />
      <div className="w-full bg-transparent flex overflow-hidden min-h-screen relative z-10">
        {/* Spacer for fixed left sidebar */}
        <div className="w-[100px] flex-shrink-0 hidden sm:block" />

        {/* Expanding Left Navigation Bar */}
        <Sidebar user={currentUser} onLogout={() => setCurrentUser(null)} />

        {/* Middle Column (Notifications Feed) */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto px-6 sm:px-8 py-10 relative">
          <div className="max-w-2xl mx-auto w-full">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2">
                    <Bell className="w-6 h-6 text-blue-500" /> Notifications
                  </h1>
                  {unreadCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Stay updated on likes, comments, and new followers
                </p>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={() => markAllMutation.mutate()}
                  disabled={markAllMutation.isPending}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition disabled:opacity-50 self-start sm:self-auto"
                >
                  <CheckCheck className="w-4 h-4 text-blue-400" />
                  Mark all as read
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar py-1">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap border',
                  filter === 'all'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10',
                )}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap border',
                  filter === 'unread'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10',
                )}
              >
                Unread ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('like')}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 border',
                  filter === 'like'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10',
                )}
              >
                <Heart className="w-3 h-3" /> Likes
              </button>
              <button
                onClick={() => setFilter('comment')}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 border',
                  filter === 'comment'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10',
                )}
              >
                <MessageCircle className="w-3 h-3" /> Comments
              </button>
              <button
                onClick={() => setFilter('follow')}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 border',
                  filter === 'follow'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10',
                )}
              >
                <UserPlus className="w-3 h-3" /> Follows
              </button>
            </div>

            {/* Notifications Content */}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl bg-[#18181b]/55 backdrop-blur-md border border-white/5 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <EmptyState filter={filter} />
            ) : (
              <div className="space-y-6 pb-12">
                {buckets.map((bucket) => (
                  <div key={bucket.label} className="space-y-2.5">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                      {bucket.label}
                    </h2>
                    <div className="space-y-2">
                      {bucket.items.map((notif) => (
                        <NotificationRow
                          key={notif.id}
                          notif={notif}
                          onRead={(id) => markOneMutation.mutate(id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar (People to follow, Saved, Activity) */}
        <ActivitySidebar />
      </div>
    </div>
  );
}
