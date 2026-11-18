import Link from 'next/link';
import { FollowerListItem } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { FollowButton } from '@/components/profile/FollowButton';

/** A person in a list (followers, following, search results). */
export function UserRow({ person, viewerUsername }: { person: FollowerListItem; viewerUsername?: string }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <Link href={`/profile/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar user={person} size="md" />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-ink hover:underline">{person.full_name || person.username}</span>
          <span className="block truncate text-sm text-ink-muted">@{person.username}</span>
          {person.bio && <span className="mt-0.5 line-clamp-1 block text-sm text-ink-3">{person.bio}</span>}
        </span>
      </Link>
      {viewerUsername && viewerUsername !== person.username && (
        <FollowButton username={person.username} following={person.is_followed_by_me} />
      )}
    </li>
  );
}
