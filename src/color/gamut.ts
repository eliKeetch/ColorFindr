import type { Oklch } from '../types/color';
import { clamp01, oklchToSrgbFloats } from './conversions';

const EPS = 1e-4;

/** Whether the OKLCH color converts to sRGB without clipping. */
export function isInSrgbGamut(lch: Oklch): boolean {
  const { r, g, b } = oklchToSrgbFloats(lch);
  return (
    r >= -EPS && r <= 1 + EPS && g >= -EPS && g <= 1 + EPS && b >= -EPS && b <= 1 + EPS
  );
}

/**
 * Map an OKLCH color into the sRGB gamut by keeping lightness and hue fixed
 * and reducing chroma (binary search). This is the CSS Color 4 style of
 * gamut mapping, simplified: hue and lightness are what our heuristics care
 * about, so chroma is the safest dimension to sacrifice.
 */
export function toSrgbGamut(lch: Oklch): Oklch {
  const clamped: Oklch = { ...lch, l: clamp01(lch.l), c: Math.max(0, lch.c) };
  if (isInSrgbGamut(clamped)) return clamped;

  let lo = 0;
  let hi = clamped.c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (isInSrgbGamut({ ...clamped, c: mid })) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { ...clamped, c: lo };
}
