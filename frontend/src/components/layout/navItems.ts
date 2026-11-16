import { Bell, Bookmark, Compass, Home, MessageCircle, Settings, UserCircle, type LucideIcon } from 'lucide-react';

export type NavKey = 'home' | 'explore' | 'notifications' | 'messages' | 'bookmarks' | 'profile' | 'settings';

export interface NavItem {
  key: NavKey;
  label: string;
  icon: LucideIcon;
  href: (username?: string) => string;
  /** Only useful when signed in; hidden from visitors. */
  auth?: boolean;
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
];
