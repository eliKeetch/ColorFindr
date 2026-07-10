import type { EffectDef, EffectScore, Oklch } from '../types/color';
import { clamp, clamp01, deltaEOk, hueDistance, normalizeHue } from './conversions';
import { buildExplanation } from './explanations';

/**
 * Heuristic scoring of how well a *surrounding* color is predicted to produce
 * a requested perceptual effect on a *target* color via simultaneous contrast.
 *
 * Core assumptions (documented once here, referenced by the sub-scorers):
 *
 * 1. Simultaneous contrast pushes the target's appearance AWAY from the
 *    surround: a surround biased toward hue H induces a bias toward the
 *    opposite hue (H+180) in the target; a darker surround makes the target
 *    look lighter; a more saturated surround makes it look more muted.
 * 2. Hue induction needs a visibly chromatic surround, but an extremely
 *    saturated surround starts to dominate the composition, so a moderate
 *    chroma band scores best (band scales with requested strength).
 * 3. Large lightness differences dominate perception. For hue/chroma effects
 *    we therefore prefer moderate lightness contrast so brightness contrast
 *    does not drown out the intended effect.
 * 4. Effects are weak when the target lacks the quality being amplified or
 *    reduced (e.g. "less blue" on an orange, "more vivid" on a pure gray).
 *    This is reported through `confidence` and also damps the total score.
 * 5. All numbers are heuristic and normalized to 0–100. They are meant to be
 *    consistent and explainable, not colorimetrically exact.
 */

/** Chroma below which we treat a color as effectively achromatic. */
export const NEUTRAL_CHROMA = 0.03;

export type ScoreComponents = {
  hueInfluence: number;
  lightnessInfluence: number;
  chromaInfluence: number;
  contrast: number;
  confidence: number;
};

/** Gaussian-ish bell: 100 at `center`, falling off over `width`. */
function bell(x: number, center: number, width: number): number {
  const t = (x - center) / width;
  return 100 * Math.exp(-t * t);
}

/** Linear ramp: 0 at `from`, 1 at `to` (clamped). */
function ramp(x: number, from: number, to: number): number {
  return clamp01((x - from) / (to - from));
}

/**
 * How strongly a surround "carries" a hue message: needs chroma to be seen
 * as chromatic at all, then a preferred band that widens with strength.
 */
function hueCarrierStrength(surround: Oklch, strength01: number): number {
  const visible = ramp(surround.c, 0.015, 0.06);
  const preferred = 0.07 + 0.15 * strength01;
  const fit = clamp01(1 - Math.abs(surround.c - preferred) / 0.16);
  return visible * (0.35 + 0.65 * fit);
}

/** Alignment (0–1) of a hue with a direction, within a ~100° useful cone. */
function hueAlignment(h: number, towards: number): number {
  return clamp01(1 - hueDistance(h, towards) / 100);
}

// ---------------------------------------------------------------------------
// Category scorers. Each returns components in 0–100.
// ---------------------------------------------------------------------------

/**
 * Hue and temperature effects.
 * "More X" (increase): the surround should sit near X's perceptual opposite,
 * so contrast induces X into the target (assumption 1).
 * "Less X" (decrease): the surround should sit near X itself — comparison
 * against a stronger X makes the target's X content look weaker.
 */
function scoreHueEffect(
  target: Oklch,
  surround: Oklch,
  effect: EffectDef,
  strength01: number,
): ScoreComponents {
  const anchor = effect.hueAnchor ?? 0;
  const inducedFrom =
    effect.direction === 'increase' ? normalizeHue(anchor + 180) : anchor;

  const align = hueAlignment(surround.h, inducedFrom);
  const carrier = hueCarrierStrength(surround, strength01);
  const hueInfluence = 100 * align * carrier;

  const prefC = 0.07 + 0.15 * strength01;
  const chromaInfluence = 100 * clamp01(1 - Math.abs(surround.c - prefC) / 0.16);

  // Assumption 3: moderate lightness difference; brightness contrast should
  // support, not dominate, the hue effect.
  const dL = Math.abs(surround.l - target.l);
  const lightnessInfluence = bell(dL, 0.08 + 0.1 * strength01, 0.2);

  const dE = deltaEOk(target, surround);
  const contrast = bell(dE, 0.18 + 0.16 * strength01, 0.22);

  // Assumption 4: feasibility.
  let confidence: number;
  if (effect.direction === 'increase') {
    // Near-neutral targets accept induced hue readily; strongly chromatic
    // targets far from the anchor resist it.
    const affinity =
      target.c < NEUTRAL_CHROMA ? 0.75 : 1 - hueDistance(target.h, anchor) / 180;
    confidence = 100 * (0.3 + 0.7 * clamp01(affinity));
  } else {
    // Can only weaken a hue the target actually contains.
    const present =
      target.c < NEUTRAL_CHROMA
        ? 0.15
        : (1 - hueDistance(target.h, anchor) / 180) * ramp(target.c, 0.02, 0.08);
    confidence = 100 * (0.2 + 0.8 * clamp01(present));
  }

  return { hueInfluence, lightnessInfluence, chromaInfluence, contrast, confidence };
}

/**
 * Lightness effects. "Lighter" wants a darker surround; "darker" a lighter
 * one (assumption 1). More difference = stronger, saturating at a desired
 * magnitude that grows with strength. Foreign, saturated hues are penalized
 * a little because they add distracting hue contrast.
 */
function scoreLightnessEffect(
  target: Oklch,
  surround: Oklch,
  effect: EffectDef,
  strength01: number,
): ScoreComponents {
  const want = 0.14 + 0.36 * strength01;
  const dL = surround.l - target.l;
  const useful = effect.direction === 'increase' ? -dL : dL;
  const lightnessInfluence = useful <= 0 ? 0 : 100 * Math.min(1, useful / want);

  // Quiet hue: neutral surrounds or surrounds sharing the target's hue keep
  // the effect purely about lightness.
  const foreignness =
    ramp(surround.c, 0.03, 0.18) * (hueDistance(surround.h, target.h) / 180);
  const hueInfluence = 100 * (1 - 0.8 * foreignness);

  const chromaInfluence = 100 * clamp01(1 - Math.max(0, surround.c - target.c - 0.04) / 0.18);

  const dE = deltaEOk(target, surround);
  const contrast = 100 * ramp(dE, 0.05, want);

  // Lightness induction is the most robust contrast effect; confidence dips
  // only when the target has little headroom left to appear lighter/darker.
  const headroom =
    effect.direction === 'increase' ? 1 - target.l : target.l;
  const confidence = 100 * (0.55 + 0.4 * ramp(headroom, 0.05, 0.35));

  return { hueInfluence, lightnessInfluence, chromaInfluence, contrast, confidence };
}

/**
 * Chroma/neutrality effects.
 * Increase (more saturated / vivid / colorful / less gray): a muted or
 * neutral surround makes the target's chroma stand out (assumption 1).
 * Similar lightness keeps chroma contrast — not brightness — the main event.
 * Decrease (more muted / gray / neutral / less saturated): a clearly more
 * saturated surround makes the target look washed out by comparison. A
 * surround hue close to the target's own hue is preferred so the comparison
 * reads as "same color, just grayer" instead of inducing a new hue bias.
 */
function scoreChromaEffect(
  target: Oklch,
  surround: Oklch,
  effect: EffectDef,
  strength01: number,
): ScoreComponents {
  const dL = Math.abs(surround.l - target.l);
  const lightnessInfluence = bell(dL, 0.05, 0.16 + 0.08 * strength01);
  const dE = deltaEOk(target, surround);
  const contrast = bell(dE, 0.14 + 0.12 * strength01, 0.2);

  if (effect.direction === 'increase') {
    const neutralness = 1 - ramp(surround.c, 0.02, 0.13);
    const chromaInfluence = 100 * neutralness;
    // A neutral surround is hue-safe; a chromatic surround only helps when it
    // is roughly complementary to the target (hue contrast adds vibrancy).
    const complementAlign =
      target.c < NEUTRAL_CHROMA
        ? 0
        : hueAlignment(surround.h, normalizeHue(target.h + 180));
    const hueInfluence =
      100 * Math.max(neutralness * 0.7, complementAlign * ramp(surround.c, 0.04, 0.12));
    // Assumption 4: a near-gray target has almost no chroma to amplify.
    const confidence = 100 * (0.25 + 0.7 * ramp(target.c, 0.015, 0.09));
    return { hueInfluence, lightnessInfluence, chromaInfluence, contrast, confidence };
  }

  const excess = surround.c - target.c;
  const wantExcess = 0.07 + 0.13 * strength01;
  const chromaInfluence = excess <= 0 ? 0 : 100 * Math.min(1, excess / wantExcess);
  const hueInfluence =
    target.c < NEUTRAL_CHROMA
      ? 70
      : 100 * (1 - (hueDistance(surround.h, target.h) / 180) * 0.85);
  // Already-neutral targets can hardly look grayer.
  const confidence = 100 * (0.3 + 0.6 * ramp(target.c, 0.01, 0.07));
  return { hueInfluence, lightnessInfluence, chromaInfluence, contrast, confidence };
}

/**
 * Contrast effects: mostly about overall perceptual difference, with
 * lightness difference as the strongest lever.
 */
function scoreContrastEffect(
  target: Oklch,
  surround: Oklch,
  effect: EffectDef,
  strength01: number,
): ScoreComponents {
  const dE = deltaEOk(target, surround);
  const dL = Math.abs(surround.l - target.l);
  const hueGap =
    (hueDistance(surround.h, target.h) / 180) * ramp(Math.min(surround.c, target.c), 0.02, 0.1);

  if (effect.direction === 'increase') {
    const wantE = 0.35 + 0.35 * strength01;
    return {
      contrast: 100 * ramp(dE, 0.08, wantE),
      lightnessInfluence: 100 * ramp(dL, 0.05, 0.3 + 0.3 * strength01),
      hueInfluence: 100 * hueGap,
      chromaInfluence: 100 * ramp(Math.abs(surround.c - target.c), 0, 0.15),
      confidence: 92,
    };
  }
  // Lower contrast: close, but not identical (identical would just merge).
  const ideal = 0.09 - 0.04 * strength01;
  return {
    contrast: bell(dE, ideal, 0.08),
    lightnessInfluence: bell(dL, 0.03, 0.08),
    hueInfluence: 100 * (1 - hueGap),
    chromaInfluence: bell(Math.abs(surround.c - target.c), 0.01, 0.08),
    confidence: 85,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const WEIGHTS: Record<string, [hue: number, light: number, chroma: number, contrast: number]> = {
  hue: [0.45, 0.2, 0.15, 0.2],
  temperature: [0.45, 0.2, 0.15, 0.2],
  lightness: [0.2, 0.5, 0.1, 0.2],
  chroma: [0.2, 0.2, 0.45, 0.15],
  neutrality: [0.2, 0.2, 0.45, 0.15],
  contrast: [0.15, 0.35, 0.1, 0.4],
};

export function scoreComponents(
  target: Oklch,
  surround: Oklch,
  effect: EffectDef,
  strength: number,
): ScoreComponents {
  const s01 = clamp(strength, 1, 100) / 100;
  switch (effect.category) {
    case 'hue':
    case 'temperature':
      return scoreHueEffect(target, surround, effect, s01);
    case 'lightness':
      return scoreLightnessEffect(target, surround, effect, s01);
    case 'chroma':
    case 'neutrality':
      return scoreChromaEffect(target, surround, effect, s01);
    case 'contrast':
      return scoreContrastEffect(target, surround, effect, s01);
  }
}

/**
 * Score how well `surround` is predicted to produce `effect` on `target`.
 * Returns all components plus a human-readable, hedged explanation.
 */
export function scoreCandidate(
  target: Oklch,
  surround: Oklch,
  effect: EffectDef,
  strength: number,
): EffectScore {
  const c = scoreComponents(target, surround, effect, strength);
  const [wh, wl, wc, wk] = WEIGHTS[effect.category];
  const raw =
    wh * c.hueInfluence +
    wl * c.lightnessInfluence +
    wc * c.chromaInfluence +
    wk * c.contrast;
  // Low-confidence (infeasible) requests damp the total so they cannot
  // outrank feasible ones in shared mode (assumption 4).
  const total = clamp(raw * (0.55 + 0.45 * (c.confidence / 100)), 0, 100);

  return {
    total: Math.round(total),
    hueInfluence: Math.round(c.hueInfluence),
    lightnessInfluence: Math.round(c.lightnessInfluence),
    chromaInfluence: Math.round(c.chromaInfluence),
    contrast: Math.round(c.contrast),
    confidence: Math.round(c.confidence),
    explanation: buildExplanation(target, surround, effect, c),
  };
}
