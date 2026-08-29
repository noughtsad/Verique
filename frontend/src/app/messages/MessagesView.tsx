'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircle, Send } from 'lucide-react';

import {
  getOrCreateConversation,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessageRest,
} from '@/lib/api';
import { Conversation, Message, User } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { useChatSocket } from '@/hooks/useChatSocket';

function avatarUrl(username: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
}

function formatMessageTime(dateString: string) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function ConversationListItem({
  conversation,
  active,
}: {
  conversation: Conversation;
  active: boolean;
}) {
  const other = conversation.other_user;
  return (
    <Link
      href={`/messages/${other.username}`}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl border transition-all duration-200',
        active
          ? 'bg-white/10 border-blue-500/30'
          : 'bg-[#18181b]/55 border-white/10 hover:bg-white/10',
      )}
    >
      <div className="w-11 h-11 rounded-full overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
        <img src={avatarUrl(other.username)} alt={other.username} className="w-full h-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-white truncate">{other.full_name || other.username}</p>
          {conversation.last_message_at && (
            <span className="text-[10px] text-slate-500 flex-shrink-0">
              {formatDate(conversation.last_message_at)}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 truncate mt-0.5">
          {conversation.last_message ? conversation.last_message.content : 'Say hello 👋'}
        </p>
      </div>
      {conversation.unread_count > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
          {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
        </span>
      )}
    </Link>
  );
}

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  return (
    <div className={cn('flex items-end gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
      <div className="w-7 h-7 rounded-full overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
        <img
          src={avatarUrl(message.sender.username)}
          alt={message.sender.username}
          className="w-full h-full object-cover"
        />
      </div>
      <div
        className={cn(
          'max-w-[70%] px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed break-words',
          isMine
            ? 'bg-blue-600/80 text-white rounded-br-sm'
            : 'bg-[#18181b]/70 border border-white/10 text-slate-200 rounded-bl-sm',
        )}
      >
        {message.content}
        <div className={cn('text-[10px] mt-1', isMine ? 'text-blue-100/70' : 'text-slate-500')}>
          {formatMessageTime(message.created_at)}
        </div>
      </div>
    </div>
  );
}

export function MessagesView({
  currentUser,
  activeUsername,
}: {
  currentUser: User | null;
  activeUsername?: string;
}) {
  const queryClient = useQueryClient();
  const chatSocket = useChatSocket(currentUser?.id);
  const [draft, setDraft] = useState('');

  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: listConversations,
    enabled: !!currentUser,
    refetchInterval: 15_000,
  });

  const activeConversationQuery = useQuery({
    queryKey: ['conversation-with', activeUsername],
    queryFn: () => getOrCreateConversation(activeUsername as string),
    enabled: !!currentUser && !!activeUsername,
  });

  const conversationId = activeConversationQuery.data?.id ?? null;

  // The socket is the primary delivery path, but polling every few seconds
  // as a fallback means a dropped/missed WS event (a flaky connection, a
  // backend restart, anything) self-heals within seconds instead of leaving
  // the open thread stuck until a manual reload.
  const messagesQuery = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => listMessages(conversationId as number),
    enabled: conversationId !== null,
    refetchInterval: 8_000,
  });

  // Keep the active thread's unread count at zero while it's open, including
  // when a new message for it arrives over the socket while we're looking.
  useEffect(() => {
    if (conversationId === null) return;
    markConversationRead(conversationId)
      .then(() => {
        queryClient.setQueryData<Conversation[]>(['conversations'], (old) =>
          old?.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)) ?? old,
        );
      })
      .catch(() => {
        // best-effort — an unread badge that's briefly stale isn't worth surfacing an error for
      });
  }, [conversationId, messagesQuery.data?.length, queryClient]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (conversationId === null) throw new Error('No conversation selected');
      const sentOverSocket = chatSocket.sendMessage(conversationId, content);
      if (!sentOverSocket) {
        await sendMessageRest(conversationId, content);
      }
    },
    onMutate: async (content: string) => {
      if (conversationId === null || !currentUser) return {};
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      const previous = queryClient.getQueryData<Message[]>(['messages', conversationId]);
      const optimisticMessage: Message = {
        id: -Date.now(),
        conversation_id: conversationId,
        sender: currentUser,
        content,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<Message[]>(['messages', conversationId], (old) =>
        old ? [...old, optimisticMessage] : [optimisticMessage],
      );
      return { previous };
    },
    onError: (_err, _content, context) => {
      if (conversationId !== null && context?.previous) {
        queryClient.setQueryData(['messages', conversationId], context.previous);
      }
    },
    onSettled: () => {
      if (conversationId !== null) {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || conversationId === null) return;
    setDraft('');
    sendMutation.mutate(content);
  };

  const conversations = useMemo(
    () => conversationsQuery.data ?? [],
    [conversationsQuery.data],
  );
  const activeOtherUser = activeConversationQuery.data?.other_user;

  return (
    <div className="flex h-full max-w-5xl mx-auto w-full gap-6">
      {/* Conversation list */}
      <div className="w-full sm:w-[320px] flex-shrink-0 flex flex-col gap-2 overflow-y-auto pb-10">
        <h1 className="text-lg font-semibold text-white tracking-tight mb-2">Messages</h1>
        {conversationsQuery.isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : conversations.length ? (
          conversations.map((c) => (
            <ConversationListItem
              key={c.id}
              conversation={c}
              active={c.other_user.username === activeUsername}
            />
          ))
        ) : (
          <div className="text-center py-16 text-slate-500 text-sm">
            No conversations yet. Visit a profile and hit Message to start one.
          </div>
        )}
      </div>

      {/* Active thread */}
      <div className="flex-1 hidden sm:flex flex-col bg-[#18181b]/55 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
        {!activeUsername ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
            <MessageCircle className="w-14 h-14 text-slate-400 mb-4" />
            <p className="text-sm font-semibold text-slate-400">
              Select a conversation to start chatting.
            </p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-white/10 flex items-center gap-3">
              {activeOtherUser && (
                <>
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-white/5 border border-white/10">
                    <img
                      src={avatarUrl(activeOtherUser.username)}
                      alt={activeOtherUser.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {activeOtherUser.full_name || activeOtherUser.username}
                    </p>
                    <p className="text-xs text-slate-400">@{activeOtherUser.username}</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {messagesQuery.isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : messagesQuery.data?.length ? (
                messagesQuery.data.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isMine={message.sender.id === currentUser?.id}
                  />
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                  No messages yet — say hello 👋
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 flex items-center gap-3">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2.5 px-4 text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white/10 transition"
              />
              <button
                type="submit"
                disabled={!draft.trim() || conversationId === null}
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
