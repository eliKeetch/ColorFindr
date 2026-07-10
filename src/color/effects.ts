import type { EffectCategory, EffectDef } from '../types/color';

/**
 * Approximate OKLCH hue angles (degrees) for named hue qualities.
 * These are perceptual anchors, not exact primaries: e.g. sRGB pure red
 * lands near h=29 in OKLCH.
 */
export const HUE_ANCHORS = {
  red: 29,
  orange: 60,
  yellow: 100,
  green: 142,
  cyan: 195,
  blue: 262,
  purple: 305,
  magenta: 335,
} as const;

/** Perceptual "warm" and "cool" poles in OKLCH hue space. */
export const WARM_HUE = 55; // orange region
export const COOL_HUE = 250; // blue region

const hueEffects: EffectDef[] = Object.entries(HUE_ANCHORS).flatMap(
  ([name, anchor]) => [
    {
      id: `more-${name}`,
      label: `More ${name}`,
      category: 'hue' as EffectCategory,
      direction: 'increase' as const,
      hueAnchor: anchor,
    },
    {
      id: `less-${name}`,
      label: `Less ${name}`,
      category: 'hue' as EffectCategory,
      direction: 'decrease' as const,
      hueAnchor: anchor,
    },
  ],
);

export const EFFECTS: EffectDef[] = [
  ...hueEffects,
  { id: 'warmer', label: 'Warmer', category: 'temperature', direction: 'increase', hueAnchor: WARM_HUE },
  { id: 'cooler', label: 'Cooler', category: 'temperature', direction: 'increase', hueAnchor: COOL_HUE },
  { id: 'lighter', label: 'Lighter', category: 'lightness', direction: 'increase' },
  { id: 'darker', label: 'Darker', category: 'lightness', direction: 'decrease' },
  { id: 'more-saturated', label: 'More saturated', category: 'chroma', direction: 'increase' },
  { id: 'less-saturated', label: 'Less saturated', category: 'chroma', direction: 'decrease' },
  { id: 'more-vivid', label: 'More vivid', category: 'chroma', direction: 'increase' },
  { id: 'more-muted', label: 'More muted', category: 'chroma', direction: 'decrease' },
  { id: 'more-colorful', label: 'More colorful', category: 'chroma', direction: 'increase' },
  { id: 'more-neutral', label: 'More neutral', category: 'neutrality', direction: 'decrease' },
  { id: 'more-gray', label: 'More gray', category: 'neutrality', direction: 'decrease' },
  { id: 'less-gray', label: 'Less gray', category: 'neutrality', direction: 'increase' },
  { id: 'higher-contrast', label: 'Higher contrast', category: 'contrast', direction: 'increase' },
  { id: 'lower-contrast', label: 'Lower contrast', category: 'contrast', direction: 'decrease' },
];

const byId = new Map(EFFECTS.map((e) => [e.id, e]));

export function getEffect(id: string): EffectDef {
  const def = byId.get(id);
  if (!def) throw new Error(`Unknown effect id: ${id}`);
  return def;
}

export const CATEGORY_LABELS: Record<EffectCategory, string> = {
  hue: 'Hue',
  temperature: 'Temperature',
  lightness: 'Lightness',
  chroma: 'Saturation & vividness',
  neutrality: 'Neutrality',
  contrast: 'Contrast',
};
