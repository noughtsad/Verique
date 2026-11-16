'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Post } from '@/lib/types';

export const PAGE_SIZE = 20;

/**
 * Offset-paged post list. Posts can shift between pages while new ones arrive, so
 * pages are merged and de-duplicated by id.
 */
export function usePostList(
  key: readonly unknown[],
  fetchPage: (limit: number, offset: number) => Promise<Post[]>,
  enabled = true,
) {
  const query = useInfiniteQuery({
    queryKey: ['posts', ...key],
    queryFn: ({ pageParam }) => fetchPage(PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined),
    enabled,
  });
  const posts = useMemo(() => {
    const seen = new Set<number>();
    return (query.data?.pages.flat() ?? []).filter((post) => !seen.has(post.id) && seen.add(post.id));
  }, [query.data]);
  return { ...query, posts };
}

/** Calls `onVisible` when the returned element scrolls near the viewport (infinite scroll). */
export function useSentinel(onVisible: () => void, active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !active) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && onVisible(), {
      rootMargin: '600px',
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible, active]);
  return ref;
}
