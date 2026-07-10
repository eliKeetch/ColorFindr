import { describe, expect, it } from 'vitest';
import type { TargetColorRequest } from '../types/color';
import { colorValueFromHex, rgbToOklch, parseHex } from './conversions';
import { recommendForTarget, recommendShared } from './recommend';
import {
  compareShared,
  detectRequestConflicts,
  evaluateShared,
  SATISFACTION_THRESHOLD,
  type SharedEvaluation,
} from './sharedScoring';

const target = (
  hex: string,
  effectId: string,
  priority = 2,
  strength = 55,
): TargetColorRequest => ({
  id: `t-${hex}-${effectId}`,
  color: colorValueFromHex(hex)!,
  effectId,
  strength,
  priority,
});

const lch = (hex: string) => rgbToOklch(parseHex(hex)!);

describe('evaluateShared', () => {
  const targets = [
    target('#c2a77d', 'more-yellow'),
    target('#8897a2', 'more-blue'),
    target('#a99791', 'more-muted'),
  ];

  it('scores every target and aggregates', () => {
    const ev = evaluateShared(lch('#7a6fa8'), targets);
    expect(ev.perTarget).toHaveLength(3);
    expect(ev.minScore).toBeLessThanOrEqual(ev.weightedAverage);
    expect(ev.sharedScore).toBeGreaterThanOrEqual(0);
    expect(ev.sharedScore).toBeLessThanOrEqual(100);
  });

  it('weights the average by target priority', () => {
    const surround = lch('#7a6fa8'); // violet: good for more-yellow, weak elsewhere
    const equal = evaluateShared(surround, targets);
    const perScores = equal.perTarget.map((p) => p.score.total);
    const worstIdx = perScores.indexOf(Math.min(...perScores));
    const boosted = targets.map((t, i) => (i === worstIdx ? { ...t, priority: 4 } : t));
    const reweighted = evaluateShared(surround, boosted);
    // Boosting the priority of the worst-served target must pull the
    // weighted average down.
    expect(reweighted.weightedAverage).toBeLessThan(equal.weightedAverage);
  });
});

describe('compareShared ranking', () => {
  const ev = (satisfiedCount: number, sharedScore: number, minScore: number): SharedEvaluation => ({
    perTarget: [],
    weightedAverage: sharedScore,
    minScore,
    satisfiedCount,
    conflictCount: 0,
    sharedScore,
  });

  it('prefers a candidate that moderately satisfies three targets over one that strongly satisfies one', () => {
    const moderateAll = ev(3, 62, 58);
    const strongOne = ev(1, 70, 12);
    expect(compareShared(moderateAll, strongOne)).toBeLessThan(0);
  });

  it('breaks ties by shared score, then worst target score', () => {
    expect(compareShared(ev(2, 70, 40), ev(2, 60, 55))).toBeLessThan(0);
    expect(compareShared(ev(2, 70, 55), ev(2, 70, 40))).toBeLessThan(0);
  });
});

describe('detectRequestConflicts', () => {
  it('flags opposite lightness requests', () => {
    const conflicts = detectRequestConflicts([
      target('#888888', 'lighter'),
      target('#666666', 'darker'),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].reason).toMatch(/lighter|darker/);
  });

  it('flags opposite chroma requests', () => {
    const conflicts = detectRequestConflicts([
      target('#a08050', 'more-saturated'),
      target('#5080a0', 'more-muted'),
    ]);
    expect(conflicts).toHaveLength(1);
  });

  it('flags opposing hue-induction requests', () => {
    const conflicts = detectRequestConflicts([
      target('#c8b58a', 'more-yellow'), // wants a violet-ish surround
      target('#8b8f94', 'more-purple'), // wants a yellow-green-ish surround
    ]);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('does not flag compatible requests', () => {
    const conflicts = detectRequestConflicts([
      target('#c8b58a', 'more-yellow'),
      target('#b0866a', 'warmer'), // both want cool/violet-region surrounds
    ]);
    expect(conflicts).toHaveLength(0);
  });
});

describe('recommendForTarget (individual mode)', () => {
  it('returns 5–10 diverse, ranked results', () => {
    const t = target('#c8b58a', 'more-yellow');
    const results = recommendForTarget(t, [t]);
    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(results.length).toBeLessThanOrEqual(10);
    expect(results[0].overallScore).toBeGreaterThanOrEqual(
      results[results.length - 1].overallScore,
    );
    // The top result for "more yellow" should be reasonably strong.
    expect(results[0].overallScore).toBeGreaterThan(SATISFACTION_THRESHOLD);
  });
});

describe('recommendShared (shared mode)', () => {
  it('returns compromises with per-target detail rather than an empty set', () => {
    // Directly conflicting goals: no candidate can fully satisfy both.
    const targets = [target('#888888', 'lighter'), target('#666666', 'darker')];
    const { results, isCompromise } = recommendShared(targets);
    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(isCompromise).toBe(true);
    for (const r of results) {
      expect(r.targetScores).toHaveLength(2);
      expect(r.explanation.length).toBeGreaterThan(10);
    }
  });

  it('reports success when goals are compatible', () => {
    const targets = [
      target('#c8b58a', 'more-yellow'),
      target('#b0866a', 'warmer'),
    ];
    const { results, isCompromise } = recommendShared(targets);
    expect(isCompromise).toBe(false);
    expect(results[0].targetScores.every((ts) => ts.satisfied)).toBe(true);
  });
});
