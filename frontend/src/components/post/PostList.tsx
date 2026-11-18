'use client';

import { ReactNode, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import { usePostList, useSentinel } from '@/hooks/usePostList';
import { Post, User } from '@/lib/types';
import { PostCard } from '@/components/post/PostCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Spinner } from '@/components/ui/Spinner';

function Skeleton() {
  return <div className="h-44 animate-pulse rounded-xl border border-line/50 bg-surface/40" />;
}

/** A paged list of posts with loading, error, empty and infinite-scroll states. */
export function PostList({
  queryKey,
  fetchPage,
  viewer,
  empty,
  enabled = true,
}: {
  queryKey: readonly unknown[];
  fetchPage: (limit: number, offset: number) => Promise<Post[]>;
  viewer: User | null;
  empty: { icon: LucideIcon; title: string; body?: string; action?: ReactNode };
  enabled?: boolean;
}) {
  const list = usePostList(queryKey, fetchPage, enabled);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const sentinel = useSentinel(loadMore, !!hasNextPage);

  if (list.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  }
  if (list.isError) return <ErrorBanner error={list.error} onRetry={() => list.refetch()} />;
  if (list.posts.length === 0) {
    return (
      <Card>
        <EmptyState {...empty} />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {list.posts.map((post) => (
        <PostCard key={post.id} post={post} viewer={viewer} />
      ))}
      <div ref={sentinel} className="flex justify-center py-4">
        {isFetchingNextPage && <Spinner label="Loading more posts" />}
        {list.isFetchNextPageError && (
          <Button variant="secondary" onClick={() => fetchNextPage()}>
            Couldn&apos;t load more. Try again.
          </Button>
        )}
        {!hasNextPage && list.posts.length > 5 && <p className="text-sm text-ink-muted">You&apos;re all caught up.</p>}
      </div>
    </div>
  );
}
