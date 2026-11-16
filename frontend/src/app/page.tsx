'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Flame, Newspaper, Users } from 'lucide-react';

import { listPosts } from '@/lib/api';
import { Feed, User } from '@/lib/types';
import { AppShell } from '@/components/layout/AppShell';
import { Composer } from '@/components/post/Composer';
import { PostList } from '@/components/post/PostList';
import { Tabs } from '@/components/ui/Tabs';

const EMPTY: Record<Feed, { icon: typeof Users; title: string; body: string; action?: React.ReactNode }> = {
  all: { icon: Newspaper, title: 'No posts yet', body: 'Write the first one above.' },
  following: {
    icon: Users,
    title: 'Nothing from people you follow',
    body: 'Follow people to see their posts here.',
    action: (
      <Link href="/explore" className="text-sm font-semibold text-blue-400 hover:text-blue-300">
        Find people on Explore
      </Link>
    ),
  },
  popular: { icon: Flame, title: 'Nothing popular this month', body: 'Posts with the most likes and comments show up here.' },
};

function HomeFeed({ user }: { user: User }) {
  const [feed, setFeed] = useState<Feed>('all');
  return (
    <div className="space-y-6">
      <h1 className="sr-only">Home</h1>
      <Composer user={user} onPosted={() => setFeed('all')} />
      <Tabs
        label="Feed"
        value={feed}
        onChange={setFeed}
        items={[
          { value: 'all', label: 'Latest' },
          { value: 'following', label: 'Following' },
          { value: 'popular', label: 'Popular' },
        ]}
      />
      <PostList
        key={feed}
        queryKey={['feed', feed]}
        fetchPage={(limit, offset) => listPosts({ feed, limit, offset })}
        viewer={user}
        empty={EMPTY[feed]}
      />
    </div>
  );
}

export default function Home() {
  return <AppShell>{(user) => user && <HomeFeed user={user} />}</AppShell>;
}
