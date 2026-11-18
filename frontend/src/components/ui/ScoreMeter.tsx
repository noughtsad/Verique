import { TIER_THRESHOLDS, TIERS, ZONES, scoreTier } from '@/lib/score';
import { cn } from '@/lib/utils';

/**
 * The Verique score as a meter: a fill from 0 to the score in the tier's status
 * colour, on a dimmed track of the same hue, with notches at the tier boundaries
 * (40 and 70) so the reader sees where the score sits on the scale.
 *
 * `compact` is for post cards; `hero` is the post page's summary, with the zone
 * names under the bar.
 */
export function ScoreMeter({ score, size = 'compact', className }: { score: number; size?: 'compact' | 'hero'; className?: string }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const tier = scoreTier(value);
  const { label, color, icon: Icon } = TIERS[tier];
  const hero = size === 'hero';

  const bar = (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={`${value} out of 100, ${label.toLowerCase()}`}
      aria-label="Verique score"
      className={cn('relative w-full overflow-hidden rounded-full', hero ? 'h-2.5' : 'h-1.5')}
      style={{ backgroundColor: `color-mix(in oklab, ${color} 22%, transparent)` }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
      {TIER_THRESHOLDS.map((t) => (
        // A 2px surface-coloured notch at each tier boundary.
        <span key={t} aria-hidden className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-surface" style={{ left: `${t}%` }} />
      ))}
    </div>
  );

  if (!hero) {
    return (
      <div className={cn('w-44 space-y-1.5', className)} title={`Verique score ${value} of 100: ${label}`}>
        <div className="flex items-center gap-1.5 text-sm">
          <Icon aria-hidden className="h-4 w-4 shrink-0" style={{ color }} />
          <span className="font-semibold text-ink">{label}</span>
          <span className="ml-auto font-semibold text-ink">{value}</span>
        </div>
        {bar}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-end justify-between gap-4">
        <p className="flex items-center gap-2 whitespace-nowrap text-lg font-bold text-ink">
          <Icon aria-hidden className="h-6 w-6 shrink-0" style={{ color }} />
          {label}
        </p>
        <p className="leading-none">
          <span className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">{value}</span>
          <span className="ml-1 text-base text-ink-muted">/100</span>
        </p>
      </div>
      {bar}
      {/* Zone names: the outer two pinned to the ends, the middle one centred on its zone,
          so none is squeezed into its zone's width on narrow screens. */}
      <div aria-hidden className="relative h-4 text-xs">
        {ZONES.map((zone) => (
          <span
            key={zone.tier}
            style={zone.tier === 'mixed' ? { left: `${(zone.from + zone.to) / 2}%` } : undefined}
            className={cn(
              'absolute top-0 whitespace-nowrap',
              zone.tier === 'bad' && 'left-0',
              zone.tier === 'mixed' && '-translate-x-1/2',
              zone.tier === 'good' && 'right-0',
              zone.tier === tier ? 'font-semibold text-ink' : 'text-ink-muted',
            )}
          >
            {TIERS[zone.tier].label}
          </span>
        ))}
      </div>
    </div>
  );
}
