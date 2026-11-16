import { cn } from '@/lib/utils';

type AvatarUser = { username: string; avatar_url?: string | null; full_name?: string | null };

const SIZES = { xs: 'h-7 w-7', sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-20 w-20', xl: 'h-28 w-28' } as const;

export function avatarSrc(user: AvatarUser): string {
  return (
    user.avatar_url ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=18181b`
  );
}

export function Avatar({
  user,
  size = 'md',
  className,
}: {
  user: AvatarUser;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarSrc(user)}
      alt={user.full_name || user.username}
      className={cn('shrink-0 rounded-full border border-line bg-surface-strong object-cover', SIZES[size], className)}
    />
  );
}
