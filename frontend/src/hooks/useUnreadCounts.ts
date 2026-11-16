'use client';

import { useQuery } from '@tanstack/react-query';
import { getUnreadNotificationCount, listConversations } from '@/lib/api';
import { useChatSocket } from '@/hooks/useChatSocket';

/** Unread notifications and messages for the nav badges. */
export function useUnreadCounts(userId?: number) {
  // The socket keeps ['conversations'] current; the poll covers the gap before it connects.
  useChatSocket(userId);
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: listConversations,
    enabled: !!userId,
    refetchInterval: 30_000,
  });
  const notifications = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: getUnreadNotificationCount,
    enabled: !!userId,
    refetchInterval: 30_000,
  });
  return {
    notifications: notifications.data?.unread_count ?? 0,
    messages: conversations.data?.reduce((sum, c) => sum + c.unread_count, 0) ?? 0,
  };
}
