'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileQuestion } from 'lucide-react';

import { ApiError, getPost } from '@/lib/api';
import { User } from '@/lib/types';
import { AppShell } from '@/components/layout/AppShell';
import { FactCheckPanel } from '@/components/post/FactCheckPanel';
import { PostCard } from '@/components/post/PostCard';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { PageSpinner } from '@/components/ui/Spinner';

function PostView({ postId, viewer }: { postId: number; viewer: User | null }) {
  const router = useRouter();
  const post = useQuery({
    queryKey: ['posts', 'one', postId],
    queryFn: () => getPost(postId),
    enabled: Number.isFinite(postId),
    retry: false,
  });
  const notFound = !Number.isFinite(postId) || (post.error instanceof ApiError && post.error.status === 404);

  return (
    <div className="space-y-6">
      <button
        onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
        className="flex items-center gap-2 text-sm font-semibold text-ink-3 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-5 w-5" /> Back
      </button>
      <h1 className="sr-only">Post</h1>
      {notFound ? (
        <Card>
          <EmptyState
            icon={FileQuestion}
            title="This post doesn't exist"
            body="It may have been deleted by its author."
            action={
              <Link href="/" className="text-sm font-semibold text-link hover:text-link">
                Go to your feed
              </Link>
            }
          />
        </Card>
      ) : post.isLoading ? (
        <PageSpinner />
      ) : post.isError ? (
        <ErrorBanner error={post.error} onRetry={() => post.refetch()} />
      ) : post.data ? (
        <>
          <PostCard post={post.data} viewer={viewer} expanded />
          <FactCheckPanel post={post.data} viewer={viewer} />
        </>
      ) : null}
    </div>
  );
}

export default function PostPage() {
  const params = useParams<{ id: string }>();
  const postId = Number(params.id);
  // Shared links work signed out: the post is readable, actions ask to log in.
  return <AppShell requireAuth={false}>{(user) => <PostView postId={postId} viewer={user} />}</AppShell>;
}
