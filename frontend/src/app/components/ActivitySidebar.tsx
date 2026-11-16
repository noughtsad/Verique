'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getFollowSuggestions, listNotifications } from '@/lib/api';
import { notificationHref, notificationText } from '@/lib/notifications';
import { timeAgo } from '@/lib/time';
import { Avatar } from '@/components/ui/Avatar';
import { FollowButton } from '@/components/profile/FollowButton';
import { User } from '@/lib/types';

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-bold text-white">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-blue-400 hover:text-blue-300">
          Show more
        </Link>
      </div>
      {children}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>;
}

/** Right-hand rail (large screens): people to follow and your latest activity. */
export function ActivitySidebar({ user }: { user: User | null }) {
  const suggestions = useQuery({
    queryKey: ['follow-suggestions'],
    queryFn: () => getFollowSuggestions(4),
    enabled: !!user,
  });
  const activity = useQuery({
    queryKey: ['notifications', 'rail'],
    queryFn: () => listNotifications(5, 0),
    enabled: !!user,
  });

  if (!user) {
    return (
      <aside className="sticky top-0 hidden h-screen w-[320px] shrink-0 px-6 py-10 lg:block">
        <div className="rounded-xl border border-line bg-surface/55 p-5 backdrop-blur-md">
          <h2 className="font-bold text-white">New to Verique?</h2>
          <p className="mt-1 text-sm text-zinc-400">Sign up to post, follow people and check any claim you read.</p>
          <Link
            href="/login"
            className="mt-4 inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-strong"
          >
            Sign up
          </Link>
        </div>
      </aside>
    );
  }

  return (
    <aside className="no-scrollbar sticky top-0 hidden h-screen w-[320px] shrink-0 space-y-10 overflow-y-auto px-6 py-10 lg:block">
      <Section title="Who to follow" href="/explore">
        {suggestions.isLoading && <Muted>Loading suggestions…</Muted>}
        {suggestions.isError && <Muted>Suggestions aren&apos;t available right now.</Muted>}
        {suggestions.data?.length === 0 && <Muted>You follow everyone we&apos;d suggest. Find more on Explore.</Muted>}
        <ul className="space-y-4">
          {suggestions.data?.map((person) => (
            <li key={person.id} className="flex items-center gap-3">
              <Link href={`/profile/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar user={person} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white hover:underline">
                    {person.full_name || person.username}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">@{person.username}</span>
                </span>
              </Link>
              <FollowButton username={person.username} following={person.is_followed_by_me} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Recent activity" href="/notifications">
        {activity.isLoading && <Muted>Loading activity…</Muted>}
        {activity.isError && <Muted>Activity isn&apos;t available right now.</Muted>}
        {activity.data?.length === 0 && <Muted>Likes, comments and new followers will show up here.</Muted>}
        <ul className="space-y-4">
          {activity.data?.map((n) => (
            <li key={n.id}>
              <Link href={notificationHref(n)} className="flex items-start gap-3 rounded-lg hover:bg-white/5">
                <Avatar user={n.actor} size="xs" />
                <span className="min-w-0 text-sm text-zinc-300">
                  <span className="font-semibold text-white">{n.actor.full_name || n.actor.username}</span>{' '}
                  {notificationText(n)}
                  <span className="text-zinc-500"> · {timeAgo(n.created_at)}</span>
                  {n.preview && <span className="mt-0.5 block truncate text-zinc-500">“{n.preview}”</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </aside>
  );
}
