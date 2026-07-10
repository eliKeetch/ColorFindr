# Color Influence Finder

Find surrounding colors that make selected qualities appear stronger or weaker in your
target colors — based on simultaneous color contrast. The target color is never changed;
the app predicts how neighboring colors may influence how it is *perceived*.

## Run it

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm test           # vitest unit tests (color math + scoring)
npm run typecheck  # tsc --noEmit
npm run build      # production build to dist/
```

## How it works

- All color math runs locally in the browser in **OKLCH** (via hand-rolled, unit-tested
  sRGB ↔ OKLab ↔ OKLCH conversions — no color library needed).
- A broad candidate pool is generated (structured OKLCH grid + complementary /
  split-complementary / analogous / neutral candidates per target), gamut-mapped into
  sRGB by chroma reduction, and deduplicated.
- Each candidate is scored per requested effect with documented heuristics
  (`src/color/effectScoring.ts`), e.g. a surround near a hue's perceptual opposite
  induces that hue; a darker surround makes the target look lighter; a saturated
  surround makes it look more muted. Scores include hue/lightness/chroma/contrast
  components plus a confidence value.
- Shared mode blends priority-weighted averages, worst-target score, satisfaction
  coverage and conflict penalties, and clearly labels compromises.
- Ranked results pass a perceptual-distance diversity filter so you get meaningfully
  different alternatives, not ten shades of the same color.

Configuration is persisted to localStorage and encoded in the URL hash for sharing.

## Structure

- `src/color/` — pure color science & scoring (no React)
- `src/components/` — presentation components
- `src/state/` — persistence / share-link serialization
- `src/data/presets.ts` — clickable examples
