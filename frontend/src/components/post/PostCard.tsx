'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Flag, Globe, Heart, MessageSquare, MoreHorizontal, Share2, Trash2 } from 'lucide-react';

import { bookmarkPost, deletePost, likePost, unbookmarkPost, unlikePost } from '@/lib/api';
import { POSTS_KEY, removePost, restorePosts, snapshotPosts, updatePost } from '@/lib/postCache';
import { fullDate, timeAgo } from '@/lib/time';
import { Post, User } from '@/lib/types';
import { cn, getDomainFromUrl } from '@/lib/utils';
import { ReportPostModal } from '@/app/components/ReportPostModal';
import { Comments } from '@/components/post/Comments';
import { VerifyStatus } from '@/components/post/VerifyStatus';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

function useOptimisticToggle(post: Post, field: 'like' | 'bookmark') {
  const queryClient = useQueryClient();
  const on = field === 'like' ? post.is_liked_by_me : post.is_bookmarked_by_me;
  return useMutation({
    mutationFn: () =>
      field === 'like'
        ? on ? unlikePost(post.id) : likePost(post.id)
        : on ? unbookmarkPost(post.id) : bookmarkPost(post.id),
    onMutate: async () => {
      // A refetch already in flight (e.g. right after publishing) would overwrite the optimistic value.
      await queryClient.cancelQueries({ queryKey: POSTS_KEY });
      const snapshot = snapshotPosts(queryClient);
      updatePost(queryClient, post.id, (p) =>
        field === 'like'
          ? { ...p, is_liked_by_me: !on, likes_count: p.likes_count + (on ? -1 : 1) }
          : { ...p, is_bookmarked_by_me: !on },
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => context && restorePosts(queryClient, context.snapshot),
    onSettled: () => {
      if (field === 'bookmark') queryClient.invalidateQueries({ queryKey: ['posts', 'bookmarks'] });
    },
  });
}

function PostMenu({ post, viewer, onDelete, onReport }: { post: Post; viewer: User; onDelete: () => void; onReport: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAuthor = viewer.id === post.author.id;
  const isModerator = viewer.role === 'moderator' || viewer.role === 'admin';

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = 'flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold hover:bg-fill';
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-fill-strong hover:text-ink"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-xl border border-line bg-surface shadow-xl animate-scale-in">
          {(isAuthor || isModerator) && (
            <button role="menuitem" onClick={() => { setOpen(false); onDelete(); }} className={cn(item, 'text-danger-ink')}>
              <Trash2 className="h-4 w-4" /> Delete post
            </button>
          )}
          {!isAuthor && (
            <button role="menuitem" onClick={() => { setOpen(false); onReport(); }} className={cn(item, 'text-ink')}>
              <Flag className="h-4 w-4" /> Report post
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A post everywhere it appears (feed, profile, explore, bookmarks, post page).
 * `expanded` is the post page: comments open, no link to itself.
 */
export function PostCard({ post, viewer, expanded = false }: { post: Post; viewer: User | null; expanded?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showComments, setShowComments] = useState(expanded);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const like = useOptimisticToggle(post, 'like');
  const bookmark = useOptimisticToggle(post, 'bookmark');

  const remove = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      setConfirmDelete(false);
      removePost(queryClient, post.id);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast('Post deleted');
      if (expanded) router.replace('/');
    },
  });

  const requireLogin = (action: () => void) => () =>
    viewer ? action() : router.push(`/login?next=${encodeURIComponent(`/post/${post.id}`)}`);

  const share = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Verique', text: post.content.slice(0, 100), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      // Share sheet dismissed.
    }
  };

  const author = post.author;
  const action = 'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors';

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 px-5 pt-4">
        <Link href={`/profile/${author.username}`} className="shrink-0">
          <Avatar user={author} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight">
            <Link href={`/profile/${author.username}`} className="font-bold text-ink hover:underline">
              {author.full_name || author.username}
            </Link>
          </p>
          <p className="truncate text-sm text-ink-muted">
            @{author.username} ·{' '}
            <Link href={`/post/${post.id}`} title={fullDate(post.created_at)} className="hover:underline">
              {timeAgo(post.created_at)}
            </Link>
          </p>
        </div>
        {viewer && (
          <PostMenu post={post} viewer={viewer} onDelete={() => setConfirmDelete(true)} onReport={() => setShowReport(true)} />
        )}
      </div>

      <div className="space-y-4 px-5 pb-4 pt-3">
        <p className={cn('whitespace-pre-wrap break-words leading-relaxed text-ink', expanded ? 'text-lg' : 'text-[15px]')}>
          {post.content}
        </p>
        {post.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt="Image attached to the post"
            loading="lazy"
            className="max-h-[480px] w-full rounded-xl border border-line object-cover"
          />
        )}
        {post.source_url && (
          <a
            href={post.source_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-line bg-fill px-3 py-2.5 text-sm font-semibold text-link hover:bg-fill-strong"
          >
            <Globe aria-hidden className="h-4 w-4 shrink-0" />
            <span className="truncate">{getDomainFromUrl(post.source_url)}</span>
          </a>
        )}
        <VerifyStatus post={post} signedIn={!!viewer} showDetailsLink={!expanded} />
      </div>

      <div className="flex items-center gap-2 border-t border-line px-3 py-1.5 text-ink-3">
        <button
          onClick={requireLogin(() => like.mutate())}
          disabled={like.isPending}
          aria-pressed={post.is_liked_by_me}
          aria-label={post.is_liked_by_me ? 'Unlike' : 'Like'}
          className={cn(action, post.is_liked_by_me ? 'text-danger-ink' : 'hover:bg-rose-500/10 hover:text-danger-ink')}
        >
          <Heart className={cn('h-[18px] w-[18px]', post.is_liked_by_me && 'fill-current')} />
          {post.likes_count}
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          aria-label="Comments"
          className={cn(action, showComments ? 'text-link' : 'hover:bg-accent/10 hover:text-link')}
        >
          <MessageSquare className="h-[18px] w-[18px]" />
          {post.comments_count}
        </button>
        <button
          onClick={requireLogin(() => bookmark.mutate())}
          disabled={bookmark.isPending}
          aria-pressed={post.is_bookmarked_by_me}
          aria-label={post.is_bookmarked_by_me ? 'Remove bookmark' : 'Bookmark'}
          className={cn(action, post.is_bookmarked_by_me ? 'text-link' : 'hover:bg-accent/10 hover:text-link')}
        >
          <Bookmark className={cn('h-[18px] w-[18px]', post.is_bookmarked_by_me && 'fill-current')} />
        </button>
        <button onClick={share} aria-label="Share" className={cn(action, 'ml-auto hover:bg-fill-strong hover:text-ink')}>
          <Share2 className="h-[18px] w-[18px]" />
        </button>
      </div>

      {showComments && <Comments post={post} viewer={viewer} />}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this post?">
        <p className="text-sm text-ink-3">
          The post, its comments and its fact-check are removed for everyone. This can&apos;t be undone.
        </p>
        {remove.isError && <ErrorBanner error={remove.error} className="mt-3" />}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => remove.mutate()} loading={remove.isPending}>
            Delete post
          </Button>
        </div>
      </Modal>

      {showReport && <ReportPostModal postId={post.id} authorUsername={author.username} onClose={() => setShowReport(false)} />}
    </Card>
  );
}
