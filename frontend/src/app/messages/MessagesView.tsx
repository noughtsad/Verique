'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle, PenSquare, Search, Send } from 'lucide-react';

import {
  getOrCreateConversation,
  listConversations,
  listMessages,
  markConversationRead,
  searchUsers,
  sendMessageRest,
} from '@/lib/api';
import { formatClock, timeAgo } from '@/lib/time';
import { Conversation, Message, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useChatSocket } from '@/hooks/useChatSocket';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';

const PAGE = 50;

function ConversationListItem({ conversation, active }: { conversation: Conversation; active: boolean }) {
  const other = conversation.other_user;
  return (
    <Link
      href={`/messages/${other.username}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 transition-colors',
        active ? 'border-accent/40 bg-white/10' : 'border-line bg-surface/55 hover:bg-white/5',
      )}
    >
      <Avatar user={other} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-bold text-white">{other.full_name || other.username}</span>
          {conversation.last_message_at && (
            <span className="shrink-0 text-xs text-zinc-500">{timeAgo(conversation.last_message_at)}</span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-sm text-zinc-400">
          {conversation.last_message ? conversation.last_message.content : 'No messages yet'}
        </span>
      </span>
      {conversation.unread_count > 0 && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
          {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
        </span>
      )}
    </Link>
  );
}

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  return (
    <div className={cn('flex items-end gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
      {!isMine && <Avatar user={message.sender} size="xs" />}
      <div
        className={cn(
          'max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isMine ? 'rounded-br-sm bg-accent text-white' : 'rounded-bl-sm border border-line bg-surface-strong text-zinc-100',
          message.id < 0 && 'opacity-60',
        )}
      >
        {message.content}
        <span className={cn('mt-1 block text-[11px]', isMine ? 'text-blue-100/70' : 'text-zinc-500')}>
          {message.id < 0 ? 'Sending…' : formatClock(message.created_at)}
        </span>
      </div>
    </div>
  );
}

function NewMessageDialog({ open, onClose, currentUser }: { open: boolean; onClose: () => void; currentUser: User }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const people = useQuery({ queryKey: ['user-search', debounced], queryFn: () => searchUsers(debounced, 8), enabled: !!debounced });
  const results = people.data?.filter((p) => p.username !== currentUser.username) ?? [];

  return (
    <Modal open={open} onClose={onClose} title="New message">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people"
          aria-label="Search people"
          className="h-11 w-full rounded-full border border-line bg-black/20 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none"
        />
      </div>
      <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto">
        {people.isLoading && <Spinner label="Searching" />}
        {people.isError && <ErrorBanner error={people.error} />}
        {debounced && people.isSuccess && results.length === 0 && <p className="text-sm text-zinc-400">No one matches “{debounced}”.</p>}
        {results.map((person) => (
          <li key={person.id}>
            <button
              onClick={() => {
                onClose();
                router.push(`/messages/${person.username}`);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5"
            >
              <Avatar user={person} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{person.full_name || person.username}</span>
                <span className="block truncate text-xs text-zinc-500">@{person.username}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function Thread({ currentUser, username }: { currentUser: User; username: string }) {
  const queryClient = useQueryClient();
  const chatSocket = useChatSocket(currentUser.id);
  const [draft, setDraft] = useState('');
  const [older, setOlder] = useState<Message[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<unknown>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Auto-scroll only while the reader is at the bottom, so reading history isn't interrupted.
  const stickToBottom = useRef(true);

  const conversation = useQuery({
    queryKey: ['conversation-with', username],
    queryFn: () => getOrCreateConversation(username),
    retry: false,
  });
  const conversationId = conversation.data?.id ?? null;

  // The socket delivers new messages; the poll heals a missed socket event within seconds.
  const latest = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => listMessages(conversationId as number, undefined, PAGE),
    enabled: conversationId !== null,
    refetchInterval: 8_000,
  });

  useEffect(() => {
    if (latest.isSuccess && older.length === 0) setHasOlder((latest.data?.length ?? 0) >= PAGE);
  }, [latest.isSuccess, latest.data, older.length]);

  const messages = useMemo(() => {
    const seen = new Set<number>();
    return [...older, ...(latest.data ?? [])].filter((m) => !seen.has(m.id) && seen.add(m.id));
  }, [older, latest.data]);

  useEffect(() => {
    stickToBottom.current = true;
    setOlder([]);
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [conversationId]);

  useEffect(() => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [latest.data]);

  // Keep the open thread's unread count at zero, including for messages arriving now.
  useEffect(() => {
    if (conversationId === null) return;
    markConversationRead(conversationId)
      .then(() =>
        queryClient.setQueryData<Conversation[]>(['conversations'], (old) =>
          old?.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c)) ?? old,
        ),
      )
      .catch(() => {
        // Best effort: a briefly stale badge isn't worth an error.
      });
  }, [conversationId, latest.data?.length, queryClient]);

  const loadOlder = async () => {
    if (conversationId === null || messages.length === 0) return;
    setLoadingOlder(true);
    setOlderError(null);
    const el = scrollRef.current;
    const previousHeight = el?.scrollHeight ?? 0;
    try {
      const page = await listMessages(conversationId, messages[0].id, PAGE);
      setOlder((current) => [...page, ...current]);
      setHasOlder(page.length >= PAGE);
      stickToBottom.current = false;
      // Keep the reader's place once the older messages are inserted above.
      requestAnimationFrame(() => el && (el.scrollTop += el.scrollHeight - previousHeight));
    } catch (error) {
      setOlderError(error);
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = useMutation({
    mutationFn: async (content: string) => {
      if (conversationId === null) throw new Error('This conversation is not open yet.');
      if (!chatSocket.sendMessage(conversationId, content)) await sendMessageRest(conversationId, content);
    },
    onMutate: async (content) => {
      if (conversationId === null) return {};
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      const previous = queryClient.getQueryData<Message[]>(['messages', conversationId]);
      const optimistic: Message = {
        id: -Date.now(),
        conversation_id: conversationId,
        sender: currentUser,
        content,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<Message[]>(['messages', conversationId], (old) => [...(old ?? []), optimistic]);
      stickToBottom.current = true;
      return { previous };
    },
    onError: (_error, content, context) => {
      if (conversationId !== null && context?.previous) queryClient.setQueryData(['messages', conversationId], context.previous);
      setDraft((current) => current || content); // give the text back so it can be resent
    },
    onSettled: () => {
      if (conversationId !== null) queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || conversationId === null) return;
    setDraft('');
    send.mutate(content);
  };

  const other = conversation.data?.other_user;
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line p-3 sm:p-4">
        <Link href="/messages" aria-label="Back to conversations" className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white sm:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {other && (
          <Link href={`/profile/${other.username}`} className="flex min-w-0 items-center gap-3">
            <Avatar user={other} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-white">{other.full_name || other.username}</span>
              <span className="block truncate text-xs text-zinc-400">@{other.username}</span>
            </span>
          </Link>
        )}
      </div>

      {conversation.isError ? (
        <div className="p-5">
          <ErrorBanner error={conversation.error} />
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={() => {
              const el = scrollRef.current;
              if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-5"
          >
            {hasOlder && (
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={loadOlder} loading={loadingOlder}>
                  Load older messages
                </Button>
              </div>
            )}
            {!!olderError && <ErrorBanner error={olderError} onRetry={loadOlder} />}
            {(conversation.isLoading || latest.isLoading) && (
              <div className="flex flex-1 items-center justify-center">
                <Spinner label="Loading messages" />
              </div>
            )}
            {latest.isError && <ErrorBanner error={latest.error} onRetry={() => latest.refetch()} />}
            {latest.isSuccess && messages.length === 0 && (
              <p className="m-auto text-sm text-zinc-500">No messages yet. Say hello.</p>
            )}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} isMine={message.sender.id === currentUser.id} />
            ))}
            <div ref={bottomRef} />
          </div>

          {send.isError && (
            <div className="px-4">
              <ErrorBanner error={send.error} />
            </div>
          )}
          <form onSubmit={submit} className="flex items-center gap-2 border-t border-line p-3 sm:p-4">
            <label htmlFor="message-draft" className="sr-only">
              Write a message
            </label>
            <input
              id="message-draft"
              value={draft}
              maxLength={2000}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message"
              className="h-11 flex-1 rounded-full border border-line bg-white/5 px-4 text-sm text-white placeholder:text-zinc-500 focus:border-accent/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || conversationId === null}
              aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-strong disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </Card>
  );
}

/** Conversation list plus the open thread. On phones only one of the two shows at a time. */
export function MessagesView({ currentUser, activeUsername }: { currentUser: User; activeUsername?: string }) {
  const [composing, setComposing] = useState(false);
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: listConversations,
    refetchInterval: 15_000,
  });

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <div className={cn('min-h-0 w-full flex-col gap-2 sm:flex sm:w-[300px] sm:shrink-0', activeUsername ? 'hidden' : 'flex')}>
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-white">Messages</h1>
          <button onClick={() => setComposing(true)} aria-label="New message" title="New message" className="rounded-full p-2 text-blue-400 hover:bg-blue-500/10">
            <PenSquare className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
          {conversations.isLoading && <Spinner label="Loading conversations" />}
          {conversations.isError && <ErrorBanner error={conversations.error} onRetry={() => conversations.refetch()} />}
          {conversations.isSuccess && conversations.data.length === 0 && (
            <EmptyState
              icon={MessageCircle}
              title="No conversations yet"
              body="Start one with anyone on Verique."
              action={<Button onClick={() => setComposing(true)}>New message</Button>}
            />
          )}
          {conversations.data?.map((c) => (
            <ConversationListItem key={c.id} conversation={c} active={c.other_user.username === activeUsername} />
          ))}
        </div>
      </div>

      <div className={cn('min-h-0 flex-1 flex-col sm:flex', activeUsername ? 'flex' : 'hidden')}>
        {activeUsername ? (
          <Thread key={activeUsername} currentUser={currentUser} username={activeUsername} />
        ) : (
          <Card className="flex flex-1 items-center justify-center">
            <EmptyState icon={MessageCircle} title="Pick a conversation" body="Or start a new one." />
          </Card>
        )}
      </div>

      <NewMessageDialog open={composing} onClose={() => setComposing(false)} currentUser={currentUser} />
    </div>
  );
}
