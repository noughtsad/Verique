'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Flame, Search, SearchX, X } from 'lucide-react';

import { listPosts, searchUsers } from '@/lib/api';
import { User } from '@/lib/types';
import { AppShell } from '@/components/layout/AppShell';
import { PostList } from '@/components/post/PostList';
import { UserRow } from '@/components/profile/UserRow';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';

function People({ q, viewer }: { q: string; viewer: User | null }) {
  const people = useQuery({ queryKey: ['user-search', q], queryFn: () => searchUsers(q, 5) });
  if (people.isLoading) return <Spinner label="Searching people" />;
  if (people.isError) return <ErrorBanner error={people.error} onRetry={() => people.refetch()} />;
  if (!people.data?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-bold text-ink">People</h2>
      <Card>
        <ul className="divide-y divide-line">
          {people.data.map((person) => (
            <UserRow key={person.id} person={person} viewerUsername={viewer?.username} />
          ))}
        </ul>
      </Card>
    </section>
  );
}

function ExploreView({ viewer }: { viewer: User | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [input, setInput] = useState(urlQuery);

  // Keep the search in the URL (shareable, survives back/forward), 300 ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = input.trim();
      if (next !== urlQuery) router.replace(next ? `${pathname}?q=${encodeURIComponent(next)}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [input, urlQuery, pathname, router]);

  return (
    <div className="space-y-6">
      <PageHeader title="Explore" subtitle="Search people and posts, or see what's popular." />
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search Verique"
          aria-label="Search people and posts"
          className="h-12 w-full rounded-md border border-line bg-surface/55 pl-11 pr-11 text-[15px] text-ink backdrop-blur-md placeholder:text-ink-muted focus:border-accent/60 focus:outline-none"
        />
        {input && (
          <button
            onClick={() => setInput('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-3 hover:bg-fill-strong hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {urlQuery ? (
        <>
          <People q={urlQuery} viewer={viewer} />
          <section className="space-y-3">
            <h2 className="font-bold text-ink">Posts</h2>
            <PostList
              key={urlQuery}
              queryKey={['search', urlQuery]}
              fetchPage={(limit, offset) => listPosts({ q: urlQuery, limit, offset })}
              viewer={viewer}
              empty={{ icon: SearchX, title: `No posts mention “${urlQuery}”`, body: 'Try a different word.' }}
            />
          </section>
        </>
      ) : (
        <section className="space-y-3">
          <h2 className="font-bold text-ink">Popular this month</h2>
          <PostList
            queryKey={['feed', 'popular']}
            fetchPage={(limit, offset) => listPosts({ feed: 'popular', limit, offset })}
            viewer={viewer}
            empty={{ icon: Flame, title: 'Nothing popular yet', body: 'Posts with the most likes and comments show up here.' }}
          />
        </section>
      )}
    </div>
  );
}

export default function ExplorePage() {
  return (
    <AppShell requireAuth={false}>
      {(user) => (
        // useSearchParams needs a Suspense boundary (Next.js 16).
        <Suspense fallback={<PageSpinner />}>
          <ExploreView viewer={user} />
        </Suspense>
      )}
    </AppShell>
  );
}
