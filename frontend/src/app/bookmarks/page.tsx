'use client';

import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { listBookmarks } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { PostList } from '@/components/post/PostList';
import { PageHeader } from '@/components/ui/PageHeader';

export default function BookmarksPage() {
  return (
    <AppShell>
      {(user) => (
        <>
          <PageHeader title="Bookmarks" subtitle="Posts you saved. Only you can see this list." />
          <PostList
            queryKey={['bookmarks']}
            fetchPage={listBookmarks}
            viewer={user}
            empty={{
              icon: Bookmark,
              title: 'No bookmarks yet',
              body: 'Tap the bookmark on any post to save it here.',
              action: (
                <Link href="/explore" className="text-sm font-semibold text-blue-400 hover:text-blue-300">
                  Find posts on Explore
                </Link>
              ),
            }}
          />
        </>
      )}
    </AppShell>
  );
}
