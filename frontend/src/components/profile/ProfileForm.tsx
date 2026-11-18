'use client';

import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import { updateMe, uploadImage } from '@/lib/api';
import { User } from '@/lib/types';
import { ME_KEY } from '@/hooks/useCurrentUser';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { useToast } from '@/components/ui/Toast';
import { inputClass } from '@/components/ui/Input';

const MAX_BIO = 300;
const MAX_NAME = 120;
const MAX_IMAGE_MB = 5;

const field = `mt-1.5 ${inputClass}`;

/** Name, bio and photo. Used in the profile's Edit dialog and on Settings. */
export function ProfileForm({ user, onSaved }: { user: User; onSaved?: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(user.full_name ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? '');
  const [photoError, setPhotoError] = useState<string | null>(null);

  const upload = useMutation({ mutationFn: (file: File) => uploadImage(file, 'avatar'), onSuccess: setAvatarUrl });
  const save = useMutation({
    mutationFn: () => updateMe({ full_name: fullName, bio, avatar_url: avatarUrl }),
    onSuccess: (updated) => {
      queryClient.setQueryData(ME_KEY, updated);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast('Profile saved');
      onSaved?.();
    },
  });

  const pickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    upload.reset();
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setPhotoError(`Photos must be ${MAX_IMAGE_MB} MB or smaller.`);
      return;
    }
    setPhotoError(null);
    upload.mutate(file);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar user={{ username: user.username, avatar_url: avatarUrl || null }} size="lg" />
        <div className="space-y-2">
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={pickPhoto} hidden />
          <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} loading={upload.isPending}>
            {!upload.isPending && <Camera aria-hidden className="h-4 w-4" />} Change photo
          </Button>
          {avatarUrl && (
            <button type="button" onClick={() => setAvatarUrl('')} className="block text-sm text-ink-3 hover:text-danger-ink">
              Remove photo
            </button>
          )}
        </div>
      </div>
      {photoError && <ErrorBanner error={new Error(photoError)} />}
      {upload.isError && <ErrorBanner error={upload.error} />}

      <label className="block text-sm font-medium text-ink-2">
        Name
        <input value={fullName} maxLength={MAX_NAME} onChange={(e) => setFullName(e.target.value)} placeholder={user.username} className={field} />
      </label>
      <label className="block text-sm font-medium text-ink-2">
        Bio
        <textarea value={bio} maxLength={MAX_BIO} rows={3} onChange={(e) => setBio(e.target.value)} placeholder="A line about you" className={`${field} resize-none`} />
        <span className="mt-1 block text-right text-xs text-ink-muted">
          {bio.length}/{MAX_BIO}
        </span>
      </label>

      {save.isError && <ErrorBanner error={save.error} />}
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending} disabled={upload.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
