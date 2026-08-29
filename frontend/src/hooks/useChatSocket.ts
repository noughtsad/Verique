'use client';

/**
 * Chat WebSocket lifecycle, shared across every component that needs it.
 *
 * This is the one deliberate exception to the app's "no hooks folder"
 * convention: Sidebar is mounted independently on every page (there's no
 * shared layout), and its unread badge needs live updates even on pages
 * that never mount the messages view. A single module-level singleton
 * connection with a ref count — rather than each page owning its own
 * WebSocket — means Sidebar and the messages page share one connection
 * and one reconnect/backoff state machine instead of duplicating it or
 * opening two sockets per tab.
 */
import { useEffect } from 'react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';

import { getChatWebSocketUrl } from '@/lib/api';
import { useChatStore, type ChatSocketStatus } from '@/lib/chatStore';
import { ChatWsEnvelope, Conversation, Message } from '@/lib/types';

let socket: WebSocket | null = null;
let refCount = 0;
let backoffMs = 1000;
const MAX_BACKOFF_MS = 30_000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// Updated on every render of every useChatSocket caller, so the bridge below
// always sees the latest values regardless of which component happened to
// establish the connection first.
let activeQueryClient: QueryClient | null = null;
let activeUserId: number | undefined;

function setStatus(status: ChatSocketStatus) {
  useChatStore.getState().setStatus(status);
}

function bridgeIncomingMessage(message: Message) {
  if (!activeQueryClient) return;
  const queryClient = activeQueryClient;

  queryClient.setQueryData<Message[]>(['messages', message.conversation_id], (old) => {
    if (!old) return [message];
    if (old.some((m) => m.id === message.id)) return old;
    return [...old, message];
  });

  const isMine = activeUserId !== undefined && message.sender.id === activeUserId;
  queryClient.setQueryData<Conversation[]>(['conversations'], (old) =>
    old?.map((c) =>
      c.id === message.conversation_id
        ? {
            ...c,
            last_message: message,
            last_message_at: message.created_at,
            unread_count: isMine ? c.unread_count : c.unread_count + 1,
          }
        : c,
    ) ?? old,
  );
}

function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  setStatus('connecting');
  const ws = new WebSocket(getChatWebSocketUrl());
  socket = ws;

  ws.onopen = () => {
    backoffMs = 1000;
    setStatus('open');
  };

  ws.onmessage = (event) => {
    let envelope: ChatWsEnvelope;
    try {
      envelope = JSON.parse(event.data);
    } catch {
      return;
    }
    if (envelope.type === 'message') {
      bridgeIncomingMessage(envelope.data);
    }
  };

  ws.onclose = () => {
    if (socket === ws) socket = null;
    setStatus('closed');
    if (refCount > 0 && !reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, backoffMs);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    }
  };

  ws.onerror = () => {
    ws.close();
  };
}

export function useChatSocket(currentUserId?: number) {
  const queryClient = useQueryClient();
  const status = useChatStore((s) => s.status);

  useEffect(() => {
    activeQueryClient = queryClient;
    activeUserId = currentUserId;
  }, [queryClient, currentUserId]);

  useEffect(() => {
    refCount += 1;
    connect();
    return () => {
      refCount -= 1;
      if (refCount <= 0) {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        socket?.close();
        socket = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    sendMessage(conversationId: number, content: string): boolean {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: 'send_message',
            data: { conversation_id: conversationId, content },
          }),
        );
        return true;
      }
      return false;
    },
  };
}
