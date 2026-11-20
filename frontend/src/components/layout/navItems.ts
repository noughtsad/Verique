import { Bell, Bookmark, Compass, Home, MessageCircle, Settings, ShieldCheck, UserCircle, type LucideIcon } from 'lucide-react';
import { isStaff } from '@/lib/moderation';
import { User } from '@/lib/types';

export type NavKey = 'home' | 'explore' | 'notifications' | 'messages' | 'bookmarks' | 'profile' | 'settings' | 'admin';

export interface NavItem {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  href: (username?: string) => string;
  /** Only useful when signed in; hidden from visitors. */
  auth?: boolean;
  /** Only for moderators and admins. */
  staff?: boolean;
  match: (pathname: string, username?: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: Home, href: () => '/', match: (p) => p === '/' },
  { key: 'explore', label: 'Explore', icon: Compass, href: () => '/explore', match: (p) => p.startsWith('/explore') },
  {
    key: 'notifications',
    auth: true,
    label: 'Notifications',
    icon: Bell,
    href: () => '/notifications',
    match: (p) => p.startsWith('/notifications'),
  },
  { key: 'messages', auth: true, label: 'Messages', icon: MessageCircle, href: () => '/messages', match: (p) => p.startsWith('/messages') },
  { key: 'bookmarks', auth: true, label: 'Bookmarks', icon: Bookmark, href: () => '/bookmarks', match: (p) => p.startsWith('/bookmarks') },
  {
    key: 'profile',
    auth: true,
    label: 'Profile',
    icon: UserCircle,
    href: (u) => (u ? `/profile/${u}` : '/login'),
    match: (p, u) => !!u && p === `/profile/${u}`,
  },
  { key: 'settings', auth: true, label: 'Settings', icon: Settings, href: () => '/settings', match: (p) => p.startsWith('/settings') },
  { key: 'admin', auth: true, staff: true, label: 'Admin', icon: ShieldCheck, href: () => '/admin', match: (p) => p.startsWith('/admin') },
];

/** Whether `user` (null for visitors) should see this nav item. */
export function canSee(item: NavItem, user: User | null): boolean {
  if (item.staff) return isStaff(user);
  return !!user || !item.auth;
}
