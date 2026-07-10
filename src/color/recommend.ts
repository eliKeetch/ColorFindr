import type { CandidateResult, TargetColorRequest } from '../types/color';
import { generateCandidates } from './candidateGenerator';
import { rgbToOklch } from './conversions';
import { selectDiverse } from './diversityFilter';
import { getEffect } from './effects';
import { scoreCandidate } from './effectScoring';
import { compareShared, evaluateShared } from './sharedScoring';

export const RESULT_COUNT = 8;

/** Individual mode: a ranked, diversity-filtered result set for one target. */
export function recommendForTarget(
  target: TargetColorRequest,
  allTargets: TargetColorRequest[],
): CandidateResult[] {
  const candidates = generateCandidates(allTargets);
  const targetLch = rgbToOklch(target.color.rgb);
  const effect = getEffect(target.effectId);

  const scored = candidates
    .map((cand) => ({
      cand,
      score: scoreCandidate(targetLch, cand.oklch, effect, target.strength),
    }))
    .sort((a, b) => b.score.total - a.score.total);

  const diverse = selectDiverse(scored, (s) => s.cand.oklch, RESULT_COUNT);

  return diverse.map(({ cand, score }, i) => ({
    id: `${target.id}-r${i}`,
    color: cand.color,
    oklch: cand.oklch,
    overallScore: score.total,
    confidence: score.confidence,
    explanation: score.explanation,
    targetScores: [
      {
        targetId: target.id,
        score: score.total,
        satisfied: score.total >= 55,
        conflict: score.total < 30,
        explanation: score.explanation,
      },
    ],
  }));
}

export type SharedRecommendation = {
  results: CandidateResult[];
  /** True when no returned candidate reasonably satisfies every target. */
  isCompromise: boolean;
};

/** Shared mode: one set of surrounds evaluated against every target. */
export function recommendShared(targets: TargetColorRequest[]): SharedRecommendation {
  const candidates = generateCandidates(targets);

  const evaluated = candidates
    .map((cand) => ({ cand, ev: evaluateShared(cand.oklch, targets) }))
    .sort((a, b) => compareShared(a.ev, b.ev));

  const diverse = selectDiverse(evaluated, (e) => e.cand.oklch, RESULT_COUNT);

  const results: CandidateResult[] = diverse.map(({ cand, ev }, i) => ({
    id: `shared-r${i}`,
    color: cand.color,
    oklch: cand.oklch,
    overallScore: Math.round(ev.sharedScore),
    confidence: Math.round(
      ev.perTarget.reduce((s, p) => s + p.score.confidence, 0) / ev.perTarget.length,
    ),
    explanation: buildSharedExplanation(ev, targets),
    targetScores: ev.perTarget.map((p) => ({
      targetId: p.targetId,
      score: p.score.total,
      satisfied: p.satisfied,
      conflict: p.conflict,
      explanation: p.score.explanation,
    })),
  }));

  const isCompromise = !diverse.some((d) => d.ev.satisfiedCount === targets.length);
  return { results, isCompromise };
}

function buildSharedExplanation(
  ev: ReturnType<typeof evaluateShared>,
  targets: TargetColorRequest[],
): string {
  const label = (id: string) => `Target ${targets.findIndex((t) => t.id === id) + 1}`;
  const sorted = [...ev.perTarget].sort((a, b) => b.score.total - a.score.total);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const effectOf = (id: string) =>
    getEffect(targets.find((t) => t.id === id)!.effectId).label.toLowerCase();

  const parts: string[] = [];
  parts.push(
    `Works best for ${label(best.targetId)} (${effectOf(best.targetId)}, score ${best.score.total}).`,
  );
  if (ev.perTarget.length > 1) {
    if (worst.conflict) {
      parts.push(
        `It works against ${label(worst.targetId)} (${effectOf(worst.targetId)}, score ${worst.score.total}).`,
      );
    } else if (!worst.satisfied) {
      parts.push(
        `It has only a weak effect on ${label(worst.targetId)} (${effectOf(worst.targetId)}, score ${worst.score.total}).`,
      );
    } else {
      parts.push('All targets are predicted to be reasonably served.');
    }
  }
  parts.push(
    `${ev.satisfiedCount} of ${ev.perTarget.length} target${ev.perTarget.length > 1 ? 's' : ''} satisfied; weakest score ${ev.minScore}.`,
  );
  return parts.join(' ');
}
