'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Trash2 } from 'lucide-react';
import { addComment, deleteComment, listComments } from '@/lib/api';
import { updatePost } from '@/lib/postCache';
import { timeAgo } from '@/lib/time';
import { Post, User } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Spinner } from '@/components/ui/Spinner';

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
    <div className="space-y-4 border-t border-line bg-black/20 px-5 py-4">
      {comments.isLoading && <Spinner label="Loading comments" />}
      {comments.isError && <ErrorBanner error={comments.error} onRetry={() => comments.refetch()} />}
      {comments.data?.length === 0 && <p className="text-sm text-zinc-500">No comments yet.</p>}
      {!!comments.data?.length && (
        <ul className="space-y-3">
          {comments.data.map((comment) => {
            const canDelete = !!viewer && (viewer.id === comment.author.id || viewer.id === post.author.id || isModerator);
            return (
              <li key={comment.id} className="group flex items-start gap-2.5">
                <Link href={`/profile/${comment.author.username}`}>
                  <Avatar user={comment.author} size="xs" />
                </Link>
                <div className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm">
                  <p className="text-xs text-zinc-500">
                    <Link href={`/profile/${comment.author.username}`} className="font-semibold text-white hover:underline">
                      {comment.author.full_name || comment.author.username}
                    </Link>{' '}
                    · {timeAgo(comment.created_at)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-zinc-200">{comment.content}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => remove.mutate(comment.id)}
                    disabled={remove.isPending && remove.variables === comment.id}
                    aria-label="Delete comment"
                    className="mt-1 rounded-full p-1.5 text-zinc-500 opacity-100 hover:bg-white/10 hover:text-rose-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
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
              className="h-10 flex-1 rounded-full border border-line bg-white/5 px-4 text-sm text-white placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || add.isPending}
              aria-label="Post comment"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-strong disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {add.isError && <ErrorBanner error={add.error} />}
        </form>
      ) : (
        <p className="text-sm text-zinc-400">
          <Link href={`/login?next=/post/${post.id}`} className="font-semibold text-blue-400 hover:underline">
            Log in
          </Link>{' '}
          to comment.
        </p>
      )}
    </div>
  );
}
