import type { ColorValue, Oklch, TargetColorRequest } from '../types/color';
import { colorValueFromRgb, normalizeHue, oklchToRgb, rgbToOklch } from './conversions';
import { getEffect } from './effects';
import { toSrgbGamut } from './gamut';

export type Candidate = {
  oklch: Oklch;
  color: ColorValue;
};

/**
 * Build a broad, structured pool of surrounding-color candidates:
 *
 * 1. A coarse OKLCH grid over hue × lightness × chroma.
 * 2. Neutrals and near-neutrals across the lightness range.
 * 3. Targeted candidates derived from each target's hue and its effect's
 *    anchor: complementary, split-complementary, analogous and same-hue
 *    variants at several lightness/chroma levels.
 *
 * Everything is gamut-mapped into sRGB (chroma reduction) and deduplicated
 * by resulting hex, so downstream scoring only sees displayable colors.
 */
export function generateCandidates(targets: TargetColorRequest[]): Candidate[] {
  const specs: Oklch[] = [];

  // 1. Structured grid.
  const HUES = Array.from({ length: 24 }, (_, i) => i * 15);
  const LIGHTNESSES = [0.22, 0.38, 0.55, 0.72, 0.88];
  const CHROMAS = [0.05, 0.1, 0.16, 0.24];
  for (const h of HUES)
    for (const l of LIGHTNESSES)
      for (const c of CHROMAS) specs.push({ l, c, h });

  // 2. Neutrals and near-neutrals.
  for (let l = 0.12; l <= 0.96; l += 0.08) {
    specs.push({ l, c: 0.005, h: 0 });
    specs.push({ l, c: 0.028, h: 250 });
    specs.push({ l, c: 0.028, h: 70 });
  }

  // 3. Targeted candidates per target + effect.
  for (const t of targets) {
    const tl = rgbToOklch(t.color.rgb);
    const effect = getEffect(t.effectId);
    const anchors: number[] = [tl.h, tl.h + 180, tl.h + 150, tl.h - 150, tl.h + 30, tl.h - 30];
    if (effect.hueAnchor !== undefined) {
      anchors.push(effect.hueAnchor, effect.hueAnchor + 180, effect.hueAnchor + 150, effect.hueAnchor - 150);
    }
    const ls = [tl.l - 0.22, tl.l - 0.1, tl.l, tl.l + 0.1, tl.l + 0.22].map((l) =>
      Math.min(0.95, Math.max(0.12, l)),
    );
    const cs = [0.04, 0.1, 0.18];
    for (const h of anchors)
      for (const l of ls)
        for (const c of cs) specs.push({ l, c, h: normalizeHue(h) });
  }

  // Gamut-map and deduplicate by displayable hex.
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const spec of specs) {
    const mapped = toSrgbGamut(spec);
    const rgb = oklchToRgb(mapped);
    const color = colorValueFromRgb(rgb);
    if (seen.has(color.hex)) continue;
    seen.add(color.hex);
    // Re-derive OKLCH from the quantized sRGB value so scores and displayed
    // values describe the exact color the user will copy.
    out.push({ oklch: rgbToOklch(color.rgb), color });
  }
  return out;
}
