import { useQuery } from '@tanstack/react-query';
import { listModerationReviews } from '@/lib/api';
import { ReviewDecision, User } from '@/lib/types';

/** Moderators and admins share the moderation tools (the backend allows both). */
export function isStaff(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'moderator' || user?.role === 'admin';
}

/** Reasons a reader can give when challenging a verdict. */
export const CHALLENGE_REASONS = [
  ['missing_context', 'Missing context'],
  ['wrong_sources', 'Wrong or unreliable sources'],
  ['outdated_conclusion', 'Outdated conclusion'],
  ['incorrect_reasoning', 'Incorrect reasoning'],
] as const;

const REASON_LABEL: Record<string, string> = Object.fromEntries(CHALLENGE_REASONS);

/** Label for a stored reason code; unknown codes fall back to the code in words. */
export function challengeReasonLabel(code: string): string {
  return REASON_LABEL[code] ?? code.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** What a decision means, from the moderator's side (`action`) and the reader's (`past`). */
export const DECISIONS: Record<ReviewDecision, { action: string; past: string; hint: string }> = {
  uphold: { action: 'Uphold', past: 'Upheld', hint: 'The verdict stands as published.' },
  revise: { action: 'Revise', past: 'Revised', hint: 'Correct it, usually with a new score or summary.' },
  remove_verdict: { action: 'Remove', past: 'Removed', hint: 'The verdict should not be relied on.' },
};

export const MODERATION_KEY = ['moderation-reviews'] as const;

/** The open queue. Shared by the dashboard, the nav badge and the post page's moderator tools. */
export function useOpenReviews(enabled = true) {
  return useQuery({
    queryKey: [...MODERATION_KEY, 'open'],
    queryFn: () => listModerationReviews('open'),
    enabled,
    refetchInterval: enabled ? 60_000 : false,
  });
}
