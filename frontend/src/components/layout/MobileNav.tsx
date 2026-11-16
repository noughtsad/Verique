'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/components/layout/navItems';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';

const MOBILE_KEYS = ['home', 'explore', 'notifications', 'messages', 'profile'] as const;

/** Bottom tab bar below `sm`. Bookmarks and Settings are reached from the profile page. */
export function MobileNav({ user }: { user: User | null }) {
  const pathname = usePathname() || '/';
  const unread = useUnreadCounts(user?.id);
  const items = NAV_ITEMS.filter((item) => (MOBILE_KEYS as readonly string[]).includes(item.key) && (user || !item.auth));

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
    >
      {items.map((item) => {
        const active = item.match(pathname, user?.username);
        const Icon = item.icon;
        const count = item.key === 'notifications' ? unread.notifications : item.key === 'messages' ? unread.messages : 0;
        return (
          <Link
            key={item.key}
            href={item.href(user?.username)}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            className={cn('flex flex-1 justify-center py-3', active ? 'text-white' : 'text-zinc-500')}
          >
            <span className="relative">
              <Icon aria-hidden className="h-6 w-6" />
              {count > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface" />}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
