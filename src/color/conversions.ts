import type { ColorValue, Oklab, Oklch, Rgb } from '../types/color';

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const clamp01 = (v: number): number => clamp(v, 0, 1);

/** Normalize a hue to [0, 360). */
export const normalizeHue = (h: number): number => ((h % 360) + 360) % 360;

/** Shortest angular distance between two hues, 0–180. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(normalizeHue(a) - normalizeHue(b));
  return d > 180 ? 360 - d : d;
}

// ---------------------------------------------------------------------------
// HEX / RGB parsing and formatting
// ---------------------------------------------------------------------------

/** Parse "#abc", "abc", "#aabbcc" or "aabbcc". Returns null when invalid. */
export function parseHex(input: string): Rgb | null {
  const s = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    return {
      r: parseInt(s[0] + s[0], 16),
      g: parseInt(s[1] + s[1], 16),
      b: parseInt(s[2] + s[2], 16),
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(s)) {
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
    };
  }
  return null;
}

/** Parse a single RGB channel string. Returns null unless an integer 0–255. */
export function parseRgbChannel(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= 255 ? n : null;
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (v: number) =>
    clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function colorValueFromRgb(rgb: Rgb): ColorValue {
  const clamped = {
    r: clamp(Math.round(rgb.r), 0, 255),
    g: clamp(Math.round(rgb.g), 0, 255),
    b: clamp(Math.round(rgb.b), 0, 255),
  };
  return { hex: rgbToHex(clamped), rgb: clamped };
}

export function colorValueFromHex(hex: string): ColorValue | null {
  const rgb = parseHex(hex);
  return rgb ? colorValueFromRgb(rgb) : null;
}

// ---------------------------------------------------------------------------
// sRGB <-> OKLab <-> OKLCH
// Standard matrices from Björn Ottosson's OKLab reference implementation.
// ---------------------------------------------------------------------------

function srgbChannelToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearChannelToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** rgb 0–255 -> OKLab. */
export function rgbToOklab(rgb: Rgb): Oklab {
  const r = srgbChannelToLinear(rgb.r / 255);
  const g = srgbChannelToLinear(rgb.g / 255);
  const b = srgbChannelToLinear(rgb.b / 255);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l3 = Math.cbrt(l);
  const m3 = Math.cbrt(m);
  const s3 = Math.cbrt(s);

  return {
    l: 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3,
    a: 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3,
    b: 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3,
  };
}

/**
 * OKLab -> sRGB channels as unclamped floats in (nominally) 0–1.
 * Values outside 0–1 mean the color is out of the sRGB gamut.
 */
export function oklabToLinearSrgbFloats(lab: Oklab): {
  r: number;
  g: number;
  b: number;
} {
  const l3 = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m3 = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s3 = lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = l3 * l3 * l3;
  const m = m3 * m3 * m3;
  const s = s3 * s3 * s3;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

/** OKLab -> sRGB floats 0–1 (unclamped, gamma-encoded). */
export function oklabToSrgbFloats(lab: Oklab): { r: number; g: number; b: number } {
  const lin = oklabToLinearSrgbFloats(lab);
  return {
    r: linearChannelToSrgb(lin.r),
    g: linearChannelToSrgb(lin.g),
    b: linearChannelToSrgb(lin.b),
  };
}

export function oklabToOklch(lab: Oklab): Oklch {
  const c = Math.hypot(lab.a, lab.b);
  // Below this chroma the hue angle is numerically meaningless; report 0.
  const h = c < 1e-6 ? 0 : normalizeHue((Math.atan2(lab.b, lab.a) * 180) / Math.PI);
  return { l: lab.l, c, h };
}

export function oklchToOklab(lch: Oklch): Oklab {
  const rad = (lch.h * Math.PI) / 180;
  return { l: lch.l, a: lch.c * Math.cos(rad), b: lch.c * Math.sin(rad) };
}

export function rgbToOklch(rgb: Rgb): Oklch {
  return oklabToOklch(rgbToOklab(rgb));
}

/** OKLCH -> sRGB floats 0–1 (unclamped; check range for gamut). */
export function oklchToSrgbFloats(lch: Oklch): { r: number; g: number; b: number } {
  return oklabToSrgbFloats(oklchToOklab(lch));
}

/** OKLCH -> rgb 0–255, clamping out-of-gamut channels. */
export function oklchToRgb(lch: Oklch): Rgb {
  const f = oklchToSrgbFloats(lch);
  return {
    r: clamp(Math.round(f.r * 255), 0, 255),
    g: clamp(Math.round(f.g * 255), 0, 255),
    b: clamp(Math.round(f.b * 255), 0, 255),
  };
}

/**
 * Perceptual color difference: Euclidean distance in OKLab ("deltaEOK").
 * Roughly: 0.02 barely distinguishable, ~1.0 black vs white.
 */
export function deltaEOk(a: Oklch, b: Oklch): number {
  const la = oklchToOklab(a);
  const lb = oklchToOklab(b);
  return Math.hypot(la.l - lb.l, la.a - lb.a, la.b - lb.b);
}

export function formatRgb({ r, g, b }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

export function formatOklch({ l, c, h }: Oklch): string {
  return `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`;
}
