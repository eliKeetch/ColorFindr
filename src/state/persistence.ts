import type { GenerationMode, PreviewMode, TargetColorRequest } from '../types/color';
import { colorValueFromHex } from '../color/conversions';
import { EFFECTS } from '../color/effects';
import { defaultTarget, newTargetId } from '../data/presets';

/**
 * Shareable app configuration. Serialized into the URL hash (`#s=...`) so a
 * configured tool state can be copied and shared, and mirrored to
 * localStorage so the last session is restored on return.
 */
export type AppConfig = {
  targets: TargetColorRequest[];
  mode: GenerationMode;
  previewMode: PreviewMode;
  previewSize: number;
};

export function defaultConfig(): AppConfig {
  return {
    targets: [defaultTarget()],
    mode: 'individual',
    previewMode: 'center',
    previewSize: 45,
  };
}

const STORAGE_KEY = 'color-influence-finder:v1';
const validEffectIds = new Set(EFFECTS.map((e) => e.id));
const clampNum = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** Compact wire format to keep share URLs short. */
type Wire = {
  m: GenerationMode;
  pm: PreviewMode;
  ps: number;
  t: Array<{ h: string; e: string; s: number; p: number }>;
};

export function serializeConfig(cfg: AppConfig): string {
  const wire: Wire = {
    m: cfg.mode,
    pm: cfg.previewMode,
    ps: cfg.previewSize,
    t: cfg.targets.map((t) => ({
      h: t.color.hex,
      e: t.effectId,
      s: t.strength,
      p: t.priority,
    })),
  };
  return encodeURIComponent(JSON.stringify(wire));
}

/** Defensive parse: any malformed part falls back rather than crashing. */
export function deserializeConfig(raw: string): AppConfig | null {
  try {
    const wire = JSON.parse(decodeURIComponent(raw)) as Wire;
    if (!wire || !Array.isArray(wire.t) || wire.t.length === 0) return null;
    const targets: TargetColorRequest[] = [];
    for (const t of wire.t.slice(0, 8)) {
      const color = typeof t.h === 'string' ? colorValueFromHex(t.h) : null;
      if (!color || !validEffectIds.has(t.e)) continue;
      targets.push({
        id: newTargetId(),
        color,
        effectId: t.e,
        strength: clampNum(t.s, 1, 100, 55),
        priority: clampNum(t.p, 1, 4, 2),
      });
    }
    if (targets.length === 0) return null;
    return {
      targets,
      mode: wire.m === 'shared' ? 'shared' : 'individual',
      previewMode: (['center', 'side', 'border', 'stripes'] as const).includes(
        wire.pm as PreviewMode,
      )
        ? (wire.pm as PreviewMode)
        : 'center',
      previewSize: clampNum(wire.ps, 15, 85, 45),
    };
  } catch {
    return null;
  }
}

export function loadInitialConfig(): AppConfig {
  const hash = window.location.hash;
  if (hash.startsWith('#s=')) {
    const fromUrl = deserializeConfig(hash.slice(3));
    if (fromUrl) return fromUrl;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const fromStorage = deserializeConfig(stored);
      if (fromStorage) return fromStorage;
    }
  } catch {
    // localStorage unavailable (private mode etc.) — fall through.
  }
  return defaultConfig();
}

export function persistConfig(cfg: AppConfig): void {
  const serialized = serializeConfig(cfg);
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Ignore quota/privacy errors; persistence is best-effort.
  }
  window.history.replaceState(null, '', `#s=${serialized}`);
}

export function clearPersistedConfig(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
