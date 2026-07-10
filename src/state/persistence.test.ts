import { describe, expect, it } from 'vitest';
import { colorValueFromHex } from '../color/conversions';
import { deserializeConfig, serializeConfig, type AppConfig } from './persistence';

const config: AppConfig = {
  mode: 'shared',
  previewMode: 'side',
  previewSize: 60,
  targets: [
    {
      id: 'a',
      color: colorValueFromHex('#c2a77d')!,
      effectId: 'more-yellow',
      strength: 85,
      priority: 4,
    },
    {
      id: 'b',
      color: colorValueFromHex('#8897a2')!,
      effectId: 'more-blue',
      strength: 25,
      priority: 1,
    },
  ],
};

describe('config serialization', () => {
  it('round-trips mode, preview settings and targets', () => {
    const restored = deserializeConfig(serializeConfig(config))!;
    expect(restored.mode).toBe('shared');
    expect(restored.previewMode).toBe('side');
    expect(restored.previewSize).toBe(60);
    expect(restored.targets).toHaveLength(2);
    expect(restored.targets[0].color.hex).toBe('#c2a77d');
    expect(restored.targets[0].effectId).toBe('more-yellow');
    expect(restored.targets[0].strength).toBe(85);
    expect(restored.targets[0].priority).toBe(4);
    expect(restored.targets[1].color.hex).toBe('#8897a2');
  });

  it('rejects garbage instead of crashing', () => {
    expect(deserializeConfig('not-json')).toBeNull();
    expect(deserializeConfig(encodeURIComponent('{"t":[]}'))).toBeNull();
    expect(deserializeConfig(encodeURIComponent('{"t":[{"h":"nope","e":"x"}]}'))).toBeNull();
  });

  it('drops invalid targets but keeps valid ones', () => {
    const raw = encodeURIComponent(
      JSON.stringify({
        m: 'individual',
        pm: 'center',
        ps: 45,
        t: [
          { h: '#c8b58a', e: 'more-yellow', s: 55, p: 2 },
          { h: 'not-a-color', e: 'more-yellow', s: 55, p: 2 },
          { h: '#c8b58a', e: 'unknown-effect', s: 55, p: 2 },
        ],
      }),
    );
    const restored = deserializeConfig(raw)!;
    expect(restored.targets).toHaveLength(1);
  });
});
