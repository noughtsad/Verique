import { Notification } from '@/lib/types';

export function notificationText(n: Notification): string {
  if (n.type === 'like') return 'liked your post';
  if (n.type === 'comment') return 'commented on your post';
  return 'followed you';
}

export function notificationHref(n: Notification): string {
  return n.post_id ? `/post/${n.post_id}` : `/profile/${n.actor.username}`;
}
