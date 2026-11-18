'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { followUser, unfollowUser } from '@/lib/api';
import { Button } from '@/components/ui/Button';

/** Follow / Following toggle with optimistic state; refreshes counts and suggestions after. */
export function FollowButton({
  username,
  following,
  size = 'sm',
}: {
  username: string;
  following: boolean;
  size?: 'sm' | 'md';
}) {
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(following);
  const [hovered, setHovered] = useState(false);

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) await followUser(username);
      else await unfollowUser(username);
    },
    onMutate: (next) => setIsFollowing(next),
    onError: (_error, next) => setIsFollowing(!next),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['follow-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  return (
    <Button
      size={size}
      variant={isFollowing ? 'secondary' : 'primary'}
      onClick={() => mutation.mutate(!isFollowing)}
      disabled={mutation.isPending}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={isFollowing && hovered ? 'border-rose-500/40 text-danger-ink' : undefined}
      aria-pressed={isFollowing}
    >
      {isFollowing ? (hovered ? 'Unfollow' : 'Following') : 'Follow'}
    </Button>
  );
}
