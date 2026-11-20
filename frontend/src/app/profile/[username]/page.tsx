'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, CalendarDays, FileText, MessageCircle, Settings, ShieldCheck, UserX, Users } from 'lucide-react';
import { format } from 'date-fns';

import { ApiError, getFollowers, getFollowing, getUserPosts, getUserProfile } from '@/lib/api';
import { isStaff } from '@/lib/moderation';
import { User } from '@/lib/types';
import { AppShell } from '@/components/layout/AppShell';
import { PostList } from '@/components/post/PostList';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { FollowButton } from '@/components/profile/FollowButton';
import { UserRow } from '@/components/profile/UserRow';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { PageSpinner } from '@/components/ui/Spinner';
import { Tabs } from '@/components/ui/Tabs';

type TabId = 'posts' | 'followers' | 'following';

function PeopleList({ username, tab, viewer }: { username: string; tab: 'followers' | 'following'; viewer: User | null }) {
  const people = useQuery({
    queryKey: [tab, username],
    queryFn: () => (tab === 'followers' ? getFollowers(username) : getFollowing(username)),
  });
  if (people.isLoading) return <PageSpinner />;
  if (people.isError) return <ErrorBanner error={people.error} onRetry={() => people.refetch()} />;
  if (!people.data?.length) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title={tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
        />
      </Card>
    );
  }
  return (
    <Card>
      <ul className="divide-y divide-line">
        {people.data.map((person) => (
          <UserRow key={person.id} person={person} viewerUsername={viewer?.username} />
        ))}
      </ul>
    </Card>
  );
}

function ProfileView({ username, viewer }: { username: string; viewer: User | null }) {
  const [tab, setTab] = useState<TabId>('posts');
  const [editing, setEditing] = useState(false);
  const profile = useQuery({ queryKey: ['profile', username], queryFn: () => getUserProfile(username), retry: false });
  const isOwn = viewer?.username === username;

  if (profile.isLoading) return <PageSpinner />;
  if (profile.error instanceof ApiError && profile.error.status === 404) {
    return (
      <Card>
        <EmptyState icon={UserX} title="This account doesn't exist" body={`No one is called @${username}.`} />
      </Card>
    );
  }
  if (profile.isError || !profile.data) return <ErrorBanner error={profile.error} onRetry={() => profile.refetch()} />;
  const p = profile.data;

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <Avatar user={p} size="xl" className="h-20 w-20 sm:h-28 sm:w-28" />
          <div className="flex flex-wrap justify-end gap-2">
            {isOwn ? (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit profile
              </Button>
            ) : viewer ? (
              <>
                <Link
                  href={`/messages/${p.username}`}
                  aria-label={`Message ${p.username}`}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-fill px-4 text-sm font-semibold text-ink hover:bg-fill-strong"
                >
                  <MessageCircle aria-hidden className="h-4 w-4" />
                  <span className="hidden sm:inline">Message</span>
                </Link>
                <FollowButton username={p.username} following={p.is_followed_by_me} size="md" />
              </>
            ) : (
              <Link href={`/login?next=/profile/${p.username}`} className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-strong">
                Log in to follow
              </Link>
            )}
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">{p.full_name || p.username}</h1>
        <p className="text-ink-muted">
          @{p.username}
          {p.role !== 'user' && <span className="ml-2 rounded-md bg-accent/10 px-2 py-0.5 text-xs font-semibold capitalize text-link">{p.role}</span>}
        </p>
        {p.bio && <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink">{p.bio}</p>}
        <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-muted">
          <CalendarDays aria-hidden className="h-4 w-4" /> Joined {format(new Date(p.created_at), 'MMMM yyyy')}
        </p>
        <p className="mt-3 flex gap-5 text-sm">
          <button onClick={() => setTab('following')} className="text-ink-3 hover:underline">
            <span className="font-bold text-ink">{p.following_count}</span> following
          </button>
          <button onClick={() => setTab('followers')} className="text-ink-3 hover:underline">
            <span className="font-bold text-ink">{p.followers_count}</span> {p.followers_count === 1 ? 'follower' : 'followers'}
          </button>
        </p>
        {isOwn && (
          // Phones have no sidebar, so these live here.
          <div className="mt-4 flex flex-wrap gap-2 sm:hidden">
            <Link href="/bookmarks" className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm text-ink">
              <Bookmark aria-hidden className="h-4 w-4" /> Bookmarks
            </Link>
            <Link href="/settings" className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm text-ink">
              <Settings aria-hidden className="h-4 w-4" /> Settings
            </Link>
            {isStaff(viewer) && (
              <Link href="/admin" className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm text-ink">
                <ShieldCheck aria-hidden className="h-4 w-4" /> Admin
              </Link>
            )}
          </div>
        )}
      </Card>

      <Tabs
        label="Profile sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'posts', label: 'Posts', count: p.posts_count },
          { value: 'followers', label: 'Followers', count: p.followers_count },
          { value: 'following', label: 'Following', count: p.following_count },
        ]}
      />
      {tab === 'posts' ? (
        <PostList
          queryKey={['user', username]}
          fetchPage={(limit, offset) => getUserPosts(username, limit, offset)}
          viewer={viewer}
          empty={{ icon: FileText, title: isOwn ? "You haven't posted yet" : 'No posts yet' }}
        />
      ) : (
        <PeopleList username={username} tab={tab} viewer={viewer} />
      )}

      {isOwn && viewer && <EditProfileModal user={viewer} open={editing} onClose={() => setEditing(false)} />}
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);
  return (
    <AppShell requireAuth={false}>
      {(user) => <ProfileView key={username} username={username} viewer={user} />}
    </AppShell>
  );
}
