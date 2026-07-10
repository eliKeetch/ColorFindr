import { describe, expect, it } from 'vitest';
import { generateCandidates } from './candidateGenerator';
import { colorValueFromHex, deltaEOk } from './conversions';
import { selectDiverse } from './diversityFilter';
import { isInSrgbGamut, toSrgbGamut } from './gamut';
import type { TargetColorRequest } from '../types/color';

const target = (hex: string, effectId: string): TargetColorRequest => ({
  id: `t-${hex}`,
  color: colorValueFromHex(hex)!,
  effectId,
  strength: 55,
  priority: 2,
});

describe('generateCandidates', () => {
  const candidates = generateCandidates([target('#c8b58a', 'more-yellow')]);

  it('produces a broad pool', () => {
    expect(candidates.length).toBeGreaterThan(300);
  });

  it('deduplicates by hex', () => {
    const hexes = candidates.map((c) => c.color.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it('only produces displayable sRGB colors', () => {
    for (const c of candidates.slice(0, 50)) {
      expect(c.color.hex).toMatch(/^#[0-9a-f]{6}$/);
      const { r, g, b } = c.color.rgb;
      for (const v of [r, g, b]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
        expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  it('includes near-neutral candidates', () => {
    expect(candidates.some((c) => c.oklch.c < 0.02)).toBe(true);
  });
});

describe('toSrgbGamut', () => {
  it('keeps in-gamut colors unchanged', () => {
    const c = { l: 0.6, c: 0.05, h: 120 };
    expect(toSrgbGamut(c)).toEqual(c);
  });

  it('maps out-of-gamut colors by reducing chroma, preserving l and h', () => {
    const wild = { l: 0.6, c: 0.4, h: 145 };
    expect(isInSrgbGamut(wild)).toBe(false);
    const mapped = toSrgbGamut(wild);
    expect(isInSrgbGamut(mapped)).toBe(true);
    expect(mapped.l).toBeCloseTo(wild.l, 6);
    expect(mapped.h).toBeCloseTo(wild.h, 6);
    expect(mapped.c).toBeLessThan(wild.c);
    expect(mapped.c).toBeGreaterThan(0.05);
  });
});

describe('selectDiverse', () => {
  it('suppresses near-duplicates among selected results', () => {
    const pool = generateCandidates([target('#8b8f94', 'more-blue')]);
    const picked = selectDiverse(pool, (c) => c.oklch, 8, 0.09);
    expect(picked.length).toBe(8);
    for (let i = 0; i < picked.length; i++) {
      for (let j = i + 1; j < picked.length; j++) {
        expect(deltaEOk(picked[i].oklch, picked[j].oklch)).toBeGreaterThanOrEqual(0.09);
      }
    }
  });

  it('relaxes the threshold rather than returning too few', () => {
    const clones = Array.from({ length: 10 }, (_, i) => ({
      oklch: { l: 0.5 + i * 0.001, c: 0.05, h: 100 },
    }));
    const picked = selectDiverse(clones, (c) => c.oklch, 5, 0.09);
    expect(picked.length).toBe(5);
  });
});
