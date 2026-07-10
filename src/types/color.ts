/** Integer sRGB channels, 0–255. */
export type Rgb = { r: number; g: number; b: number };

/** OKLab coordinates. L in 0–1, a/b roughly -0.4–0.4. */
export type Oklab = { l: number; a: number; b: number };

/** OKLCH coordinates. l in 0–1, c roughly 0–0.37 in sRGB, h in degrees 0–360. */
export type Oklch = { l: number; c: number; h: number };

export type ColorValue = {
  hex: string;
  rgb: Rgb;
};

export type EffectCategory =
  | 'hue'
  | 'temperature'
  | 'lightness'
  | 'chroma'
  | 'neutrality'
  | 'contrast';

export type EffectDirection = 'increase' | 'decrease';

/** Static definition of a selectable perceptual effect. */
export type EffectDef = {
  id: string;
  label: string;
  category: EffectCategory;
  direction: EffectDirection;
  /**
   * For hue/temperature effects: the OKLCH hue angle (degrees) of the quality
   * being strengthened or weakened (e.g. ~262 for "blue", ~55 for "warm").
   */
  hueAnchor?: number;
};

/**
 * One target color plus the single effect requested for it.
 * Modelled so that `effects` could become an array later without reshaping
 * the rest of the app: everything downstream consumes (color, effectId,
 * strength) tuples.
 */
export type TargetColorRequest = {
  id: string;
  color: ColorValue;
  effectId: string;
  /** 1–100. Presets: subtle=25, moderate=55, strong=85. */
  strength: number;
  /** Weight used in shared-mode scoring. 1=low, 2=normal, 4=high. */
  priority: number;
};

export type EffectScore = {
  /** 0–100 normalized overall score. */
  total: number;
  hueInfluence: number;
  lightnessInfluence: number;
  chromaInfluence: number;
  contrast: number;
  /** 0–100: how reliable/perceptible the predicted effect is likely to be. */
  confidence: number;
  explanation: string;
};

export type TargetScoreEntry = {
  targetId: string;
  score: number;
  satisfied: boolean;
  conflict: boolean;
  explanation: string;
};

export type CandidateResult = {
  id: string;
  color: ColorValue;
  oklch: Oklch;
  overallScore: number;
  confidence: number;
  targetScores: TargetScoreEntry[];
  explanation: string;
};

export type GenerationMode = 'individual' | 'shared';

export type PreviewMode = 'center' | 'side' | 'border' | 'stripes';
