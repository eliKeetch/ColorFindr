import { describe, expect, it } from 'vitest';
import {
  colorValueFromHex,
  colorValueFromRgb,
  deltaEOk,
  hueDistance,
  oklchToRgb,
  parseHex,
  parseRgbChannel,
  rgbToHex,
  rgbToOklch,
} from './conversions';

describe('parseHex', () => {
  it('parses 6-digit hex with and without #', () => {
    expect(parseHex('#c8b58a')).toEqual({ r: 200, g: 181, b: 138 });
    expect(parseHex('C8B58A')).toEqual({ r: 200, g: 181, b: 138 });
    expect(parseHex('  #C8B58A  ')).toEqual({ r: 200, g: 181, b: 138 });
  });

  it('parses 3-digit shorthand', () => {
    expect(parseHex('#fa0')).toEqual({ r: 255, g: 170, b: 0 });
  });

  it('rejects invalid input', () => {
    for (const bad of ['', '#', '#12', '#1234', '#12345', '#1234567', 'zzzzzz', '#ggg', 'rgb(1,2,3)']) {
      expect(parseHex(bad)).toBeNull();
    }
  });
});

describe('parseRgbChannel', () => {
  it('accepts integers 0–255', () => {
    expect(parseRgbChannel('0')).toBe(0);
    expect(parseRgbChannel('255')).toBe(255);
    expect(parseRgbChannel(' 128 ')).toBe(128);
  });

  it('rejects out-of-range and non-integers', () => {
    for (const bad of ['256', '-1', '1.5', 'abc', '', '1e2']) {
      expect(parseRgbChannel(bad)).toBeNull();
    }
  });
});

describe('hex/rgb synchronization', () => {
  it('round-trips hex -> rgb -> hex', () => {
    for (const hex of ['#000000', '#ffffff', '#c8b58a', '#8b8f94', '#0a141e']) {
      const cv = colorValueFromHex(hex)!;
      expect(cv.hex).toBe(hex);
      expect(rgbToHex(cv.rgb)).toBe(hex);
    }
  });

  it('clamps and rounds rgb input', () => {
    const cv = colorValueFromRgb({ r: 300, g: -5, b: 127.6 });
    expect(cv.rgb).toEqual({ r: 255, g: 0, b: 128 });
    expect(cv.hex).toBe('#ff0080');
  });
});

describe('rgb <-> oklch', () => {
  it('maps white and black to the lightness extremes', () => {
    const white = rgbToOklch({ r: 255, g: 255, b: 255 });
    const black = rgbToOklch({ r: 0, g: 0, b: 0 });
    expect(white.l).toBeGreaterThan(0.99);
    expect(white.c).toBeLessThan(0.01);
    expect(black.l).toBeLessThan(0.01);
  });

  it('places sRGB red near the expected OKLCH hue', () => {
    const red = rgbToOklch({ r: 255, g: 0, b: 0 });
    expect(hueDistance(red.h, 29)).toBeLessThan(5);
    expect(red.c).toBeGreaterThan(0.2);
  });

  it('round-trips rgb -> oklch -> rgb within 1 step per channel', () => {
    const samples = [
      { r: 200, g: 181, b: 138 },
      { r: 139, g: 143, b: 148 },
      { r: 10, g: 200, b: 90 },
      { r: 250, g: 5, b: 250 },
      { r: 128, g: 128, b: 128 },
    ];
    for (const rgb of samples) {
      const back = oklchToRgb(rgbToOklch(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe('deltaEOk', () => {
  it('is zero for identical colors and large for black vs white', () => {
    const gray = rgbToOklch({ r: 120, g: 120, b: 120 });
    expect(deltaEOk(gray, gray)).toBeCloseTo(0, 6);
    const bw = deltaEOk(rgbToOklch({ r: 0, g: 0, b: 0 }), rgbToOklch({ r: 255, g: 255, b: 255 }));
    expect(bw).toBeGreaterThan(0.9);
  });

  it('grows with perceptual difference', () => {
    const base = rgbToOklch({ r: 120, g: 120, b: 120 });
    const near = rgbToOklch({ r: 128, g: 128, b: 128 });
    const far = rgbToOklch({ r: 220, g: 220, b: 220 });
    expect(deltaEOk(base, near)).toBeLessThan(deltaEOk(base, far));
  });
});
