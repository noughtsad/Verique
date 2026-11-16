import { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import { Post } from '@/lib/types';

/** Every query that holds posts has a key starting with 'posts', so one write updates them all. */
export const POSTS_KEY = ['posts'] as const;

type PostData = Post | Post[] | InfiniteData<Post[]> | null | undefined;

function mapPosts(data: PostData, fn: (post: Post) => Post | null): PostData {
  if (!data) return data;
  if (Array.isArray(data)) return data.map(fn).filter((p): p is Post => p !== null);
  if ('pages' in data) {
    return { ...data, pages: data.pages.map((page) => page.map(fn).filter((p): p is Post => p !== null)) };
  }
  return fn(data);
}

export function updatePost(queryClient: QueryClient, postId: number, update: (post: Post) => Post) {
  queryClient.setQueriesData<PostData>({ queryKey: POSTS_KEY }, (data) =>
    mapPosts(data, (post) => (post.id === postId ? update(post) : post)),
  );
}

/** Drop a post from every list (a single-post query keeps it; that page shows its own state). */
export function removePost(queryClient: QueryClient, postId: number) {
  queryClient.setQueriesData<PostData>({ queryKey: POSTS_KEY }, (data) =>
    Array.isArray(data) || (data && 'pages' in data)
      ? mapPosts(data, (post) => (post.id === postId ? null : post))
      : data,
  );
}

/**
 * Put a just-created post at the top of a paged list. Any in-flight fetch of these
 * lists is cancelled first: TanStack reuses a running first fetch instead of
 * refetching, and that fetch would return the list from before the post existed.
 */
export async function prependPost(queryClient: QueryClient, keys: QueryKey[], post: Post) {
  for (const queryKey of keys) {
    await queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<InfiniteData<Post[], number>>(queryKey, (data) =>
      data
        ? { ...data, pages: [[post, ...(data.pages[0] ?? []).filter((p) => p.id !== post.id)], ...data.pages.slice(1)] }
        : { pages: [[post]], pageParams: [0] },
    );
  }
  await queryClient.invalidateQueries({ queryKey: POSTS_KEY });
}

export type PostSnapshot = [QueryKey, unknown][];

export function snapshotPosts(queryClient: QueryClient): PostSnapshot {
  return queryClient.getQueriesData({ queryKey: POSTS_KEY });
}

export function restorePosts(queryClient: QueryClient, snapshot: PostSnapshot) {
  for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
}
