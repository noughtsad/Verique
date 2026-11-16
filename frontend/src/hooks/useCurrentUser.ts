'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clearAuthToken, getCurrentUser, isUnauthorized } from '@/lib/api';
import { User } from '@/lib/types';

export const ME_KEY = ['me'] as const;

/**
 * The signed-in user. With `required`, a signed-out visitor is sent to /login and
 * brought back afterwards; without it, `user` is simply null for visitors.
 */
export function useCurrentUser({ required = false }: { required?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useQuery<User, Error>({
    queryKey: ME_KEY,
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const signedOut = isUnauthorized(query.error);

  useEffect(() => {
    if (required && signedOut) {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`);
    }
  }, [required, signedOut, router, pathname]);

  return {
    user: query.data ?? null,
    isLoading: query.isLoading || (required && signedOut),
    // Anything but "signed out" (server down, 5xx): the page shows it with a retry.
    error: signedOut ? null : query.error,
    refetch: query.refetch,
  };
}

/** Sign out: drop every cached query so the next user never sees this user's data. */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return async () => {
    await clearAuthToken();
    queryClient.clear();
    router.replace('/login');
  };
}
