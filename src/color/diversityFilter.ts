import type { Oklch } from '../types/color';
import { deltaEOk } from './conversions';

/**
 * Greedy diversity selection: walk a ranked list and keep an item only if it
 * is at least `minDeltaE` (perceptual OKLab distance) away from everything
 * already kept. If the threshold is too strict to reach `count`, relax it in
 * halves so we still return a full result set rather than an empty one.
 */
export function selectDiverse<T>(
  ranked: T[],
  getOklch: (item: T) => Oklch,
  count: number,
  minDeltaE = 0.09,
): T[] {
  let threshold = minDeltaE;
  for (let attempt = 0; attempt < 4; attempt++) {
    const kept: T[] = [];
    for (const item of ranked) {
      if (kept.length >= count) break;
      const lch = getOklch(item);
      if (kept.every((k) => deltaEOk(getOklch(k), lch) >= threshold)) {
        kept.push(item);
      }
    }
    if (kept.length >= Math.min(count, ranked.length)) return kept;
    threshold /= 2;
  }
  return ranked.slice(0, count);
}
