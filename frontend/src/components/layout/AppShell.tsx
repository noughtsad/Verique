'use client';

import { ReactNode } from 'react';
import { AnimatedCanvas } from '@/app/components/AnimatedCanvas';
import { ActivitySidebar } from '@/app/components/ActivitySidebar';
import { Sidebar } from '@/app/components/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { PageSpinner } from '@/components/ui/Spinner';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';

const WIDTHS = { md: 'max-w-2xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const;

/**
 * Every in-app page: background, navigation (sidebar from `sm`, bottom bar on phones),
 * the main column and, on large screens, the right rail.
 *
 * `requireAuth` sends signed-out visitors to /login. Pages that work signed out
 * (a shared post, a public profile) leave it off and get `user = null`.
 */
export function AppShell({
  children,
  requireAuth = true,
  rightRail = true,
  width = 'md',
  fullHeight = false,
}: {
  children: ReactNode | ((user: User | null) => ReactNode);
  requireAuth?: boolean;
  rightRail?: boolean;
  width?: keyof typeof WIDTHS;
  fullHeight?: boolean;
}) {
  const { user, isLoading, error, refetch } = useCurrentUser({ required: requireAuth });

  return (
    <div className="relative min-h-screen">
      <AnimatedCanvas className="fixed inset-0 z-0" interactive={false} />
      <Sidebar user={user} />
      <div className="relative z-10 flex min-h-screen sm:pl-[76px] xl:pl-[240px]">
        <main
          className={cn(
            'mx-auto w-full min-w-0 flex-1 px-4 pb-24 sm:px-8 sm:pb-12',
            fullHeight ? 'flex h-screen flex-col pt-4 sm:pt-6' : 'pt-6 sm:pt-10',
            WIDTHS[width],
          )}
        >
          {isLoading ? (
            <PageSpinner />
          ) : error && !user && requireAuth ? (
            <ErrorBanner error={error} onRetry={() => refetch()} />
          ) : typeof children === 'function' ? (
            children(user)
          ) : (
            children
          )}
        </main>
        {rightRail && <ActivitySidebar user={user} />}
      </div>
      <MobileNav user={user} />
    </div>
  );
}
