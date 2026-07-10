import { describe, expect, it } from 'vitest';
import type { Oklch } from '../types/color';
import { rgbToOklch, parseHex } from './conversions';
import { getEffect } from './effects';
import { scoreCandidate } from './effectScoring';

const lch = (hex: string): Oklch => rgbToOklch(parseHex(hex)!);

const score = (targetHex: string, surroundHex: string, effectId: string, strength = 55) =>
  scoreCandidate(lch(targetHex), lch(surroundHex), getEffect(effectId), strength);

describe('scoreCandidate basics', () => {
  it('returns all components normalized to 0–100', () => {
    const s = score('#c8b58a', '#4a3f6b', 'more-yellow');
    for (const v of [s.total, s.hueInfluence, s.lightnessInfluence, s.chromaInfluence, s.contrast, s.confidence]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(s.explanation.length).toBeGreaterThan(20);
  });

  it('uses hedged language in explanations', () => {
    const s = score('#c8b58a', '#6b5fa8', 'more-yellow');
    expect(s.explanation).toMatch(/may|likely|predicted/i);
  });
});

describe('lightness effects', () => {
  it('scores a darker surround higher than a lighter one for "lighter"', () => {
    // Same hue family, opposite lightness relationship.
    const darkSurround = score('#8a8a8a', '#3a3a3a', 'lighter');
    const lightSurround = score('#8a8a8a', '#dedede', 'lighter');
    expect(darkSurround.total).toBeGreaterThan(lightSurround.total);
  });

  it('scores a lighter surround higher than a darker one for "darker"', () => {
    const light = score('#6a7a5a', '#e4ead9', 'darker');
    const dark = score('#6a7a5a', '#222a1c', 'darker');
    expect(light.total).toBeGreaterThan(dark.total);
  });
});

describe('chroma effects', () => {
  it('scores a highly saturated surround higher for making a low-chroma target more muted', () => {
    const saturated = score('#a89f96', '#c05a28', 'more-muted');
    const neutral = score('#a89f96', '#9a9a9a', 'more-muted');
    expect(saturated.total).toBeGreaterThan(neutral.total);
  });

  it('scores a neutral surround higher for making a chromatic target more vivid', () => {
    const neutral = score('#c05a28', '#9a9a9a', 'more-vivid');
    const vivid = score('#c05a28', '#28c05a', 'more-vivid');
    expect(neutral.total).toBeGreaterThan(vivid.total);
  });

  it('has low confidence for "more vivid" on a pure gray', () => {
    const s = score('#808080', '#9a9a9a', 'more-vivid');
    expect(s.confidence).toBeLessThan(45);
  });
});

describe('hue effects', () => {
  it('prefers a surround opposite the desired hue for "more blue" on a gray', () => {
    // Blue anchor ~262; its opposite is ~82 (warm yellow-orange region).
    const warmSurround = score('#8b8f94', '#b08a3f', 'more-blue');
    const blueSurround = score('#8b8f94', '#3f5ab0', 'more-blue');
    expect(warmSurround.total).toBeGreaterThan(blueSurround.total);
  });

  it('prefers a violet surround for "more yellow" on a beige', () => {
    const violet = score('#c8b58a', '#7a6fa8', 'more-yellow');
    const yellow = score('#c8b58a', '#c8b530', 'more-yellow');
    expect(violet.total).toBeGreaterThan(yellow.total);
  });

  it('has low confidence for reducing a hue the target barely contains', () => {
    // A strongly orange target contains essentially no blue.
    const s = score('#d2691e', '#4060c0', 'less-blue');
    expect(s.confidence).toBeLessThan(40);
  });

  it('an achromatic surround cannot carry a hue message', () => {
    const gray = score('#8b8f94', '#7d7d7d', 'more-blue');
    expect(gray.hueInfluence).toBeLessThan(15);
  });
});

describe('temperature effects', () => {
  it('prefers a cool surround for "warmer"', () => {
    const cool = score('#b0866a', '#4a6f9a', 'warmer');
    const warm = score('#b0866a', '#c07a3a', 'warmer');
    expect(cool.total).toBeGreaterThan(warm.total);
  });
});

describe('contrast effects', () => {
  it('rewards large differences for "higher contrast" and closeness for "lower contrast"', () => {
    const far = '#101418';
    const near = '#c2b294';
    const target = '#c8b58a';
    expect(score(target, far, 'higher-contrast').total).toBeGreaterThan(
      score(target, near, 'higher-contrast').total,
    );
    expect(score(target, near, 'lower-contrast').total).toBeGreaterThan(
      score(target, far, 'lower-contrast').total,
    );
  });
});

describe('strength', () => {
  it('shifts the preferred lightness gap for "lighter" toward larger differences', () => {
    const target = '#8a8a8a';
    const slightlyDarker = '#6f6f6f';
    const muchDarker = '#1c1c1c';
    const subtle = { a: score(target, slightlyDarker, 'lighter', 20), b: score(target, muchDarker, 'lighter', 20) };
    const strong = { a: score(target, slightlyDarker, 'lighter', 95), b: score(target, muchDarker, 'lighter', 95) };
    // At high strength the much-darker surround should gain relative ground.
    const subtleGap = subtle.b.total - subtle.a.total;
    const strongGap = strong.b.total - strong.a.total;
    expect(strongGap).toBeGreaterThan(subtleGap);
  });
});
