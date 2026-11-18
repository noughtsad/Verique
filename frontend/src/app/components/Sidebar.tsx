'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { NAV_ITEMS } from '@/components/layout/navItems';
import { useLogout } from '@/hooks/useCurrentUser';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';

export function Logo({ withName = false }: { withName?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-xl font-bold text-accent-ink">
        V
      </span>
      {withName && <span className="text-lg font-bold tracking-tight text-ink">Verique</span>}
    </span>
  );
}

function Badge({ count, tone = 'accent' }: { count: number; tone?: 'accent' | 'rose' }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-accent-ink',
        tone === 'rose' ? 'bg-rose-500' : 'bg-accent',
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * Desktop navigation: an icon rail from `sm`, with labels from `xl`.
 * Phones use MobileNav instead.
 */
export function Sidebar({ user }: { user: User | null }) {
  const pathname = usePathname() || '/';
  const logout = useLogout();
  const unread = useUnreadCounts(user?.id);

  const linkClass = (active: boolean) =>
    cn(
      'relative flex items-center gap-4 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors',
      active ? 'bg-fill-strong text-ink' : 'text-ink-3 hover:bg-fill hover:text-ink',
    );

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col border-r border-line bg-surface/55 px-3 py-6 backdrop-blur-xl sm:flex xl:w-[240px]">
      <Link href="/" className="mb-8 px-1" aria-label="Verique home">
        <span className="xl:hidden">
          <Logo />
        </span>
        <span className="hidden xl:block">
          <Logo withName />
        </span>
      </Link>

      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV_ITEMS.filter((item) => user || !item.auth).map((item) => {
          const active = item.match(pathname, user?.username);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href(user?.username)}
              aria-current={active ? 'page' : undefined}
              title={item.label}
              className={linkClass(active)}
            >
              <span className="relative shrink-0">
                <Icon aria-hidden className="h-6 w-6" />
                {item.key === 'notifications' && <Badge count={unread.notifications} />}
                {item.key === 'messages' && <Badge count={unread.messages} tone="rose" />}
              </span>
              <span className="hidden xl:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        {user ? (
          <>
            <Link
              href={`/profile/${user.username}`}
              className="flex items-center gap-3 rounded-xl px-1.5 py-2 hover:bg-fill"
              title={user.full_name || user.username}
            >
              <Avatar user={user} size="sm" />
              <span className="hidden min-w-0 xl:block">
                <span className="block truncate text-sm font-semibold text-ink">{user.full_name || user.username}</span>
                <span className="block truncate text-xs text-ink-3">@{user.username}</span>
              </span>
            </Link>
            <button onClick={logout} title="Log out" className={cn(linkClass(false), 'hover:text-danger-ink')}>
              <LogOut aria-hidden className="h-6 w-6 shrink-0" />
              <span className="hidden xl:inline">Log out</span>
            </button>
          </>
        ) : (
          <Link href="/login" className={linkClass(false)}>
            <LogOut aria-hidden className="h-6 w-6 shrink-0 rotate-180" />
            <span className="hidden xl:inline">Log in</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
