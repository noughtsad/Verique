import { ShieldAlert, ShieldCheck, ShieldX, type LucideIcon } from 'lucide-react';

/**
 * The one Verique score scale, used everywhere a score is shown.
 * 70 and above: mostly accurate. 40–69: mixed. Below 40: disputed.
 */
export type ScoreTier = 'good' | 'mixed' | 'bad';

export const TIER_THRESHOLDS = [40, 70] as const;

export function scoreTier(score: number): ScoreTier {
  if (score >= TIER_THRESHOLDS[1]) return 'good';
  if (score >= TIER_THRESHOLDS[0]) return 'mixed';
  return 'bad';
}

/**
 * Status colours, checked with the dataviz validator on the card surface (#18181b):
 * all inside the dark lightness band, ≥3:1 contrast, colour-blind separation ΔE ≥ 9.
 * They mark state only (fill and icon); labels and numbers stay in text colours,
 * and every tier also has its own icon and label, so colour is never the only cue.
 */
export const TIERS: Record<ScoreTier, { label: string; color: string; icon: LucideIcon }> = {
  good: { label: 'Mostly accurate', color: '#0f9f8f', icon: ShieldCheck },
  mixed: { label: 'Mixed', color: '#bb8a12', icon: ShieldAlert },
  bad: { label: 'Disputed', color: '#d03b3b', icon: ShieldX },
};

/** Zones of the scale, low to high, for captions under the hero meter. */
export const ZONES: { tier: ScoreTier; from: number; to: number }[] = [
  { tier: 'bad', from: 0, to: TIER_THRESHOLDS[0] },
  { tier: 'mixed', from: TIER_THRESHOLDS[0], to: TIER_THRESHOLDS[1] },
  { tier: 'good', from: TIER_THRESHOLDS[1], to: 100 },
];
