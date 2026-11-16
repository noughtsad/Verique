'use client';

import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Link2, X } from 'lucide-react';
import { createPost, uploadImage } from '@/lib/api';
import { prependPost } from '@/lib/postCache';
import { Post, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

// Same limits as the backend's PostCreate schema.
const MIN_LENGTH = 10;
const MAX_LENGTH = 5000;
const MAX_IMAGE_MB = 5;

export function Composer({ user, onPosted }: { user: User; onPosted?: (post: Post) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [showSource, setShowSource] = useState(false);
  const [image, setImage] = useState<{ url: string; preview: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => uploadImage(file, 'post'),
  });
  const publish = useMutation({
    mutationFn: () =>
      createPost({
        content: content.trim(),
        source_url: showSource && sourceUrl.trim() ? sourceUrl.trim() : undefined,
        image_url: image?.url,
      }),
    // The draft is cleared only once the post exists, so a failed publish keeps it.
    onSuccess: (post) => {
      setContent('');
      setSourceUrl('');
      setShowSource(false);
      setImage(null);
      prependPost(queryClient, [['posts', 'feed', 'all'], ['posts', 'user', user.username]], post);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast('Published');
      onPosted?.(post);
    },
  });

  const pickImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    upload.reset();
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setImageError(`Images must be ${MAX_IMAGE_MB} MB or smaller.`);
      return;
    }
    setImageError(null);
    const preview = URL.createObjectURL(file);
    upload.mutate(file, {
      onSuccess: (url) => setImage({ url, preview }),
      onError: () => URL.revokeObjectURL(preview),
    });
  };

  const length = content.trim().length;
  const tooShort = length > 0 && length < MIN_LENGTH;
  const canPublish = length >= MIN_LENGTH && length <= MAX_LENGTH && !upload.isPending && !publish.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canPublish) publish.mutate();
  };

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={submit} className="flex gap-3">
        <Avatar user={user} size="md" className="hidden sm:block" />
        <div className="min-w-0 flex-1 space-y-3">
          <label htmlFor="composer" className="sr-only">
            Write a post
          </label>
          <textarea
            id="composer"
            value={content}
            maxLength={MAX_LENGTH}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share something. Anyone can check its claims."
            rows={content ? 4 : 2}
            className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-white placeholder:text-zinc-500 focus:outline-none"
          />

          {upload.isPending && <Spinner label="Uploading image" />}
          {image && (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.preview} alt="Attached image" className="max-h-60 rounded-xl border border-line" />
              <button
                type="button"
                onClick={() => setImage(null)}
                aria-label="Remove image"
                className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {showSource && (
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://… link to your source (optional)"
              aria-label="Source link"
              className="h-10 w-full rounded-lg border border-line bg-white/5 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none"
            />
          )}

          {imageError && <ErrorBanner error={new Error(imageError)} />}
          {upload.isError && <ErrorBanner error={upload.error} />}
          {publish.isError && <ErrorBanner error={publish.error} />}

          <div className="flex items-center gap-1 border-t border-line pt-3">
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={pickImage} hidden />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={upload.isPending || !!image}
              title="Add an image"
              aria-label="Add an image"
              className="rounded-full p-2 text-blue-400 hover:bg-blue-500/10 disabled:opacity-40"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowSource((v) => !v)}
              aria-pressed={showSource}
              title="Add a source link"
              aria-label="Add a source link"
              className={cn('rounded-full p-2 hover:bg-blue-500/10', showSource ? 'bg-blue-500/10 text-blue-300' : 'text-blue-400')}
            >
              <Link2 className="h-5 w-5" />
            </button>
            <span
              className={cn('ml-auto mr-3 text-xs tabular-nums', tooShort ? 'text-amber-300' : 'text-zinc-500')}
              aria-live="polite"
            >
              {tooShort ? `${MIN_LENGTH - length} more characters` : length > 0 ? `${length}/${MAX_LENGTH}` : ''}
            </span>
            <Button type="submit" disabled={!canPublish} loading={publish.isPending}>
              Publish
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
