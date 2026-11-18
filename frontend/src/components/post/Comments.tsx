'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { addComment, deleteComment, listComments } from '@/lib/api';
import { updatePost } from '@/lib/postCache';
import { timeAgo } from '@/lib/time';
import { Post, User } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Spinner } from '@/components/ui/Spinner';
import { inlineInputClass } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';

const MAX_COMMENT = 1000;

export function Comments({ post, viewer }: { post: Post; viewer: User | null }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const comments = useQuery({ queryKey: ['comments', post.id], queryFn: () => listComments(post.id) });
  const isModerator = viewer?.role === 'moderator' || viewer?.role === 'admin';

  const add = useMutation({
    mutationFn: (content: string) => addComment(post.id, content),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      updatePost(queryClient, post.id, (p) => ({ ...p, comments_count: p.comments_count + 1 }));
    },
  });
  const remove = useMutation({
    mutationFn: (commentId: number) => deleteComment(post.id, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      updatePost(queryClient, post.id, (p) => ({ ...p, comments_count: Math.max(0, p.comments_count - 1) }));
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (text) add.mutate(text);
  };

  return (
    <div className="space-y-4 border-t border-line bg-well px-5 py-4">
      {comments.isLoading && <Spinner label="Loading comments" />}
      {comments.isError && <ErrorBanner error={comments.error} onRetry={() => comments.refetch()} />}
      {comments.data?.length === 0 && <EmptyState compact icon={MessageSquare} title="No comments yet" />}
      {!!comments.data?.length && (
        <ul className="space-y-3">
          {comments.data.map((comment) => {
            const canDelete = !!viewer && (viewer.id === comment.author.id || viewer.id === post.author.id || isModerator);
            return (
              <li key={comment.id} className="group flex items-start gap-2.5">
                <Link href={`/profile/${comment.author.username}`}>
                  <Avatar user={comment.author} size="xs" />
                </Link>
                <div className="min-w-0 flex-1 rounded-xl bg-fill px-3 py-2 text-sm">
                  <p className="text-xs text-ink-muted">
                    <Link href={`/profile/${comment.author.username}`} className="font-semibold text-ink hover:underline">
                      {comment.author.full_name || comment.author.username}
                    </Link>{' '}
                    · {timeAgo(comment.created_at)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-ink">{comment.content}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => remove.mutate(comment.id)}
                    disabled={remove.isPending && remove.variables === comment.id}
                    aria-label="Delete comment"
                    className="mt-1 rounded-full p-1.5 text-ink-muted opacity-100 hover:bg-fill-strong hover:text-danger-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {remove.isError && <ErrorBanner error={remove.error} />}
      {viewer ? (
        <form onSubmit={submit} className="space-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor={`comment-${post.id}`} className="sr-only">
              Write a comment
            </label>
            <input
              id={`comment-${post.id}`}
              value={draft}
              maxLength={MAX_COMMENT}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a comment"
              className={inlineInputClass}
            />
            <button
              type="submit"
              disabled={!draft.trim() || add.isPending}
              aria-label="Post comment"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-ink hover:bg-accent-strong disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {add.isError && <ErrorBanner error={add.error} />}
        </form>
      ) : (
        <p className="text-sm text-ink-3">
          <Link href={`/login?next=/post/${post.id}`} className="font-semibold text-link hover:underline">
            Log in
          </Link>{' '}
          to comment.
        </p>
      )}
    </div>
  );
}
