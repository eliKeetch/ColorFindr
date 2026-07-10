import type { EffectDef, Oklch } from '../types/color';
import { hueDistance } from './conversions';
import { HUE_ANCHORS } from './effects';
import type { ScoreComponents } from './effectScoring';

/**
 * Human-readable, deliberately hedged explanations ("may", "is likely to")
 * because simultaneous contrast varies with display, size and viewer.
 */

/** Closest named hue for an OKLCH hue angle. */
export function hueName(h: number): string {
  let best = 'red';
  let bestDist = Infinity;
  for (const [name, anchor] of Object.entries(HUE_ANCHORS)) {
    const d = hueDistance(h, anchor);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

/** Compact description like "light muted blue" or "dark near-neutral gray". */
export function describeColor(c: Oklch): string {
  const light =
    c.l < 0.25 ? 'very dark' : c.l < 0.45 ? 'dark' : c.l < 0.68 ? 'mid-tone' : c.l < 0.85 ? 'light' : 'very light';
  if (c.c < 0.02) return `${light} gray`;
  const sat = c.c < 0.06 ? 'near-neutral' : c.c < 0.11 ? 'muted' : c.c < 0.18 ? 'saturated' : 'vivid';
  return `${light} ${sat} ${hueName(c.h)}`;
}

function lightnessNote(target: Oklch, surround: Oklch): string {
  const dL = surround.l - target.l;
  if (Math.abs(dL) < 0.06) return 'Its similar lightness keeps brightness contrast from taking over.';
  if (Math.abs(dL) < 0.25)
    return 'The moderate lightness difference adds separation without letting brightness dominate.';
  return dL > 0
    ? 'Note that the large lightness gap may make the target read mostly as "darker".'
    : 'Note that the large lightness gap may make the target read mostly as "lighter".';
}

export function buildExplanation(
  target: Oklch,
  surround: Oklch,
  effect: EffectDef,
  c: ScoreComponents,
): string {
  const s = describeColor(surround);
  const low = c.confidence < 45;
  const caveat = low
    ? ' Confidence is low because the target barely carries this quality, so the effect is predicted to be weak.'
    : '';

  switch (effect.category) {
    case 'hue': {
      const q = hueName(effect.hueAnchor ?? 0);
      if (effect.direction === 'increase') {
        return (
          `This ${s} sits near the perceptual opposite of ${q}, so by contrast it may make the ${q} quality of the target appear stronger. ` +
          lightnessNote(target, surround) +
          caveat
        );
      }
      return (
        `This ${s} carries more ${q} than the target, so by comparison the target's ${q} content is likely to look weaker. ` +
        lightnessNote(target, surround) +
        caveat
      );
    }
    case 'temperature': {
      const warm = effect.id === 'warmer';
      return (
        `This ${s} is ${warm ? 'cool' : 'warm'}-leaning, so the target is predicted to appear ${warm ? 'warmer' : 'cooler'} next to it. ` +
        lightnessNote(target, surround) +
        caveat
      );
    }
    case 'lightness': {
      const lighter = effect.direction === 'increase';
      return (
        `This ${s} is ${lighter ? 'darker' : 'lighter'} than the target, so the target is likely to appear ${lighter ? 'lighter' : 'darker'} against it. ` +
        (c.hueInfluence > 70
          ? 'Its restrained hue keeps the effect focused on lightness.'
          : 'Its own hue adds some color contrast alongside the lightness effect.') +
        caveat
      );
    }
    case 'chroma':
    case 'neutrality': {
      if (effect.direction === 'increase') {
        return (
          `This ${s} is ${surround.c < 0.05 ? 'close to neutral' : 'restrained in saturation'}, so the target's own color may appear more vivid by comparison — the effect comes mainly from chroma contrast. ` +
          lightnessNote(target, surround) +
          caveat
        );
      }
      return (
        `This ${s} is clearly more saturated than the target, which may make the target appear grayer and more muted by comparison. ` +
        (hueDistance(surround.h, target.h) < 60 && target.c >= 0.03
          ? 'Sharing the target’s hue family keeps the comparison about saturation rather than inducing a new hue.'
          : lightnessNote(target, surround)) +
        caveat
      );
    }
    case 'contrast': {
      if (effect.direction === 'increase') {
        return `This ${s} differs strongly from the target in lightness and color, which is predicted to raise the overall contrast between the two.${caveat}`;
      }
      return `This ${s} stays perceptually close to the target, lowering apparent contrast while remaining distinguishable.${caveat}`;
    }
  }
}
