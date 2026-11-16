import { format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns';

// The API sends naive UTC timestamps; mark them as UTC before parsing.
function parse(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

/** "now", "5m", "3h", then "Mar 4" (this year) or "Mar 4, 2025". */
export function timeAgo(value: string): string {
  const date = parse(value);
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`;
  return format(date, date.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy');
}

/** "5 minutes ago" — for tooltips and longer labels. */
export function timeAgoLong(value: string): string {
  return formatDistanceToNowStrict(parse(value), { addSuffix: true });
}

/** Message timestamps: "14:05", "Yesterday 14:05", "Mar 4 14:05". */
export function formatClock(value: string): string {
  const date = parse(value);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return `Yesterday ${format(date, 'HH:mm')}`;
  return format(date, 'MMM d HH:mm');
}

export function fullDate(value: string): string {
  return format(parse(value), 'PPpp');
}
