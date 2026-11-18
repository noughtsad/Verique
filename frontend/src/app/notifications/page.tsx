'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Heart, MessageCircle, UserPlus } from 'lucide-react';

import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api';
import { notificationHref, notificationText } from '@/lib/notifications';
import { fullDate, timeAgoLong } from '@/lib/time';
import { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';

const PAGE_SIZE = 30;

const TYPE_ICON: Record<Notification['type'], { icon: typeof Heart; className: string }> = {
  like: { icon: Heart, className: 'bg-rose-500/20 text-danger-ink' },
  comment: { icon: MessageCircle, className: 'bg-accent/15 text-link' },
  follow: { icon: UserPlus, className: 'bg-emerald-500/20 text-success-ink' },
};

type FilterType = 'all' | 'unread' | Notification['type'];

const EMPTY_TEXT: Record<FilterType, string> = {
  all: 'Likes, comments and new followers will show up here.',
  unread: "You've read everything.",
  like: 'No one has liked your posts yet.',
  comment: 'No one has commented on your posts yet.',
  follow: 'No new followers yet.',
};

function NotificationRow({ notif, onOpen }: { notif: Notification; onOpen: (n: Notification) => void }) {
  const { icon: Icon, className } = TYPE_ICON[notif.type];
  return (
    // The row holds nested links (avatar, name), so it can't itself be an <a>.
    <div
      role="link"
      tabIndex={0}
      onClick={() => onOpen(notif)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(notif)}
      className={cn(
        'relative flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors',
        notif.is_read
          ? 'border-line/50 bg-surface/40 hover:bg-fill'
          : 'border-line bg-surface/70 hover:bg-fill-strong',
      )}
    >
      {!notif.is_read && <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-accent" title="Unread" />}
      <div className="relative shrink-0">
        <Link href={`/profile/${notif.actor.username}`} onClick={(e) => e.stopPropagation()}>
          <Avatar user={notif.actor} size="md" />
        </Link>
        <span
          className={cn(
            'absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-surface',
            className,
          )}
        >
          <Icon aria-hidden className="h-3 w-3" />
        </span>
      </div>
      <div className="min-w-0 flex-1 pr-4 text-sm">
        <p className="leading-relaxed text-ink-2">
          <Link
            href={`/profile/${notif.actor.username}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-ink hover:underline"
          >
            {notif.actor.full_name || notif.actor.username}
          </Link>{' '}
          {notificationText(notif)}
        </p>
        {notif.preview && (
          <p className="mt-2 line-clamp-2 rounded-lg border border-line bg-fill px-3 py-2 text-ink-2">
            “{notif.preview}”
          </p>
        )}
        <p className="mt-2 text-xs text-ink-muted" title={fullDate(notif.created_at)}>
          {timeAgoLong(notif.created_at)}
        </p>
      </div>
    </div>
  );
}

function NotificationsView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>('all');

  const query = useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    queryFn: ({ pageParam }) => listNotifications(PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined),
    refetchInterval: 30_000,
  });
  const notifications = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
  };
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });
  const markOne = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh });

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const visible = notifications.filter((n) =>
    filter === 'all' ? true : filter === 'unread' ? !n.is_read : n.type === filter,
  );

  const open = (n: Notification) => {
    if (!n.is_read) markOne.mutate(n.id);
    router.push(notificationHref(n));
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        actions={
          unreadCount > 0 && (
            <Button variant="secondary" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>
              <CheckCheck aria-hidden className="h-4 w-4" /> Mark all as read
            </Button>
          )
        }
      />
      <Tabs
        label="Filter notifications"
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread', count: unreadCount },
          { value: 'like', label: 'Likes' },
          { value: 'comment', label: 'Comments' },
          { value: 'follow', label: 'Follows' },
        ]}
      />
      <div className="mt-5 space-y-2">
        {query.isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-line/50 bg-surface/40" />
          ))}
        {query.isError && <ErrorBanner error={query.error} onRetry={() => query.refetch()} />}
        {query.isSuccess && visible.length === 0 && (
          <Card>
            <EmptyState icon={Bell} title="Nothing here yet" body={EMPTY_TEXT[filter]} />
          </Card>
        )}
        {visible.map((n) => (
          <NotificationRow key={n.id} notif={n} onOpen={open} />
        ))}
        {query.hasNextPage && (
          <div className="flex justify-center pt-4">
            <Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

export default function NotificationsPage() {
  return (
    <AppShell>
      <NotificationsView />
    </AppShell>
  );
}
