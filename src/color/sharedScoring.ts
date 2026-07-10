import type { EffectScore, Oklch, TargetColorRequest } from '../types/color';
import { hueDistance, normalizeHue, rgbToOklch } from './conversions';
import { getEffect } from './effects';
import { scoreCandidate } from './effectScoring';

/** A target counts as reasonably satisfied at or above this score. */
export const SATISFACTION_THRESHOLD = 55;
/** Below this score a candidate actively works against the target's request. */
export const CONFLICT_THRESHOLD = 30;

export type SharedEvaluation = {
  perTarget: Array<{
    targetId: string;
    score: EffectScore;
    satisfied: boolean;
    conflict: boolean;
  }>;
  weightedAverage: number;
  minScore: number;
  satisfiedCount: number;
  conflictCount: number;
  sharedScore: number;
};

/**
 * Evaluate one candidate surround against every target request.
 *
 * sharedScore blends:
 * - the priority-weighted average (main signal),
 * - the worst individual score (a great average must not hide a disaster),
 * - satisfaction coverage (how much priority-weight sits above threshold),
 * - minus a penalty per conflicting target.
 *
 * Together with the ranking in `rankShared` (satisfied count first), this
 * keeps a candidate that moderately helps everyone ahead of one that is
 * brilliant for a single target and hostile to the rest — unless priorities
 * deliberately skew the weights that way.
 */
export function evaluateShared(
  surround: Oklch,
  targets: TargetColorRequest[],
): SharedEvaluation {
  const perTarget = targets.map((t) => {
    const score = scoreCandidate(rgbToOklch(t.color.rgb), surround, getEffect(t.effectId), t.strength);
    return {
      targetId: t.id,
      score,
      satisfied: score.total >= SATISFACTION_THRESHOLD,
      conflict: score.total < CONFLICT_THRESHOLD,
    };
  });

  const totalWeight = targets.reduce((s, t) => s + t.priority, 0) || 1;
  const weightedAverage =
    targets.reduce((s, t, i) => s + t.priority * perTarget[i].score.total, 0) / totalWeight;
  const minScore = Math.min(...perTarget.map((p) => p.score.total));
  const satisfiedCount = perTarget.filter((p) => p.satisfied).length;
  const conflictCount = perTarget.filter((p) => p.conflict).length;
  const coverage =
    (targets.reduce((s, t, i) => s + (perTarget[i].satisfied ? t.priority : 0), 0) /
      totalWeight) *
    100;
  const conflictPenalty = (conflictCount / targets.length) * 100;

  const sharedScore = Math.max(
    0,
    weightedAverage * 0.55 + minScore * 0.2 + coverage * 0.2 - conflictPenalty * 0.05,
  );

  return { perTarget, weightedAverage, minScore, satisfiedCount, conflictCount, sharedScore };
}

/**
 * Rank shared evaluations: number of satisfied targets first, then blended
 * shared score, then the worst target score. (Diversity is applied after
 * ranking, by the caller.)
 */
export function compareShared(a: SharedEvaluation, b: SharedEvaluation): number {
  if (b.satisfiedCount !== a.satisfiedCount) return b.satisfiedCount - a.satisfiedCount;
  if (b.sharedScore !== a.sharedScore) return b.sharedScore - a.sharedScore;
  return b.minScore - a.minScore;
}

// ---------------------------------------------------------------------------
// Static conflict detection between requests (before any candidate exists).
// ---------------------------------------------------------------------------

/** What kind of surround a request "wants", reduced to comparable demands. */
type SurroundDemand = {
  hue?: number; // preferred surround hue direction
  lightnessDir?: 1 | -1; // surround should be lighter (+1) or darker (-1) than target
  chromaLevel?: 'low' | 'high';
};

function demandOf(t: TargetColorRequest): SurroundDemand {
  const effect = getEffect(t.effectId);
  const tl = rgbToOklch(t.color.rgb);
  switch (effect.category) {
    case 'hue':
    case 'temperature': {
      const anchor = effect.hueAnchor ?? 0;
      return {
        hue: effect.direction === 'increase' ? normalizeHue(anchor + 180) : anchor,
      };
    }
    case 'lightness':
      return { lightnessDir: effect.direction === 'increase' ? -1 : 1 };
    case 'chroma':
    case 'neutrality':
      return { chromaLevel: effect.direction === 'increase' ? 'low' : 'high' };
    case 'contrast':
      return effect.direction === 'increase'
        ? { lightnessDir: tl.l > 0.5 ? -1 : 1 }
        : {};
  }
}

export type RequestConflict = {
  targetIds: [string, string];
  reason: string;
};

/**
 * Detect pairs of requests whose ideal surrounds are directly opposed, so the
 * UI can warn that shared results will necessarily be compromises.
 */
export function detectRequestConflicts(targets: TargetColorRequest[]): RequestConflict[] {
  const conflicts: RequestConflict[] = [];
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = demandOf(targets[i]);
      const b = demandOf(targets[j]);
      const ea = getEffect(targets[i].effectId).label.toLowerCase();
      const eb = getEffect(targets[j].effectId).label.toLowerCase();
      if (a.hue !== undefined && b.hue !== undefined && hueDistance(a.hue, b.hue) > 110) {
        conflicts.push({
          targetIds: [targets[i].id, targets[j].id],
          reason: `“${ea}” and “${eb}” prefer surrounds in opposing hue regions.`,
        });
      } else if (a.lightnessDir && b.lightnessDir && a.lightnessDir !== b.lightnessDir) {
        conflicts.push({
          targetIds: [targets[i].id, targets[j].id],
          reason: `“${ea}” prefers a ${a.lightnessDir === 1 ? 'lighter' : 'darker'} surround while “${eb}” prefers the opposite.`,
        });
      } else if (a.chromaLevel && b.chromaLevel && a.chromaLevel !== b.chromaLevel) {
        conflicts.push({
          targetIds: [targets[i].id, targets[j].id],
          reason: `“${ea}” prefers a near-neutral surround while “${eb}” prefers a strongly saturated one.`,
        });
      }
    }
  }
  return conflicts;
}
