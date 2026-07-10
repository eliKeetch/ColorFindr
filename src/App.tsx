import { useEffect, useMemo, useRef, useState } from 'react';
import type { CandidateResult, PreviewMode, TargetColorRequest } from './types/color';
import { getEffect } from './color/effects';
import { recommendForTarget, recommendShared } from './color/recommend';
import type { SharedRecommendation } from './color/recommend';
import { detectRequestConflicts } from './color/sharedScoring';
import { defaultTarget, newTargetId, PRESETS, presetToTargets } from './data/presets';
import {
  clearPersistedConfig,
  defaultConfig,
  loadInitialConfig,
  persistConfig,
  type AppConfig,
} from './state/persistence';
import { Header } from './components/Header';
import { TargetColorCard } from './components/TargetColorCard';
import { GenerationModeSelector } from './components/GenerationModeSelector';
import { ResultCard } from './components/ResultCard';
import { EmptyState } from './components/EmptyState';

type Results =
  | { kind: 'individual'; byTarget: Array<{ target: TargetColorRequest; results: CandidateResult[] }> }
  | { kind: 'shared'; shared: SharedRecommendation; targets: TargetColorRequest[] };

const MAX_TARGETS = 6;

export default function App() {
  const [config, setConfig] = useState<AppConfig>(() => loadInitialConfig());
  const [results, setResults] = useState<Results | null>(null);
  /** Snapshot of the inputs the current results were generated from. */
  const [generatedFrom, setGeneratedFrom] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const shareTimer = useRef<number | undefined>(undefined);

  // Persist to localStorage + URL hash on every config change.
  useEffect(() => {
    persistConfig(config);
  }, [config]);

  useEffect(() => () => window.clearTimeout(shareTimer.current), []);

  const { targets, mode, previewMode, previewSize } = config;

  const inputFingerprint = useMemo(
    () =>
      JSON.stringify({
        mode,
        t: targets.map((t) => [t.color.hex, t.effectId, t.strength, t.priority]),
      }),
    [targets, mode],
  );
  const resultsStale = results !== null && generatedFrom !== inputFingerprint;

  const conflicts = useMemo(() => detectRequestConflicts(targets), [targets]);
  const targetLabel = (id: string) => `Target ${targets.findIndex((t) => t.id === id) + 1}`;

  const updateTarget = (updated: TargetColorRequest) =>
    setConfig((c) => ({
      ...c,
      targets: c.targets.map((t) => (t.id === updated.id ? updated : t)),
    }));

  const addTarget = () =>
    setConfig((c) =>
      c.targets.length >= MAX_TARGETS
        ? c
        : { ...c, targets: [...c.targets, { ...defaultTarget(), id: newTargetId() }] },
    );

  const removeTarget = (id: string) =>
    setConfig((c) => ({ ...c, targets: c.targets.filter((t) => t.id !== id) }));

  const generate = () => {
    if (mode === 'individual') {
      setResults({
        kind: 'individual',
        byTarget: targets.map((t) => ({ target: t, results: recommendForTarget(t, targets) })),
      });
    } else {
      setResults({ kind: 'shared', shared: recommendShared(targets), targets });
    }
    setGeneratedFrom(inputFingerprint);
  };

  const reset = () => {
    clearPersistedConfig();
    setConfig(defaultConfig());
    setResults(null);
    setGeneratedFrom(null);
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      window.clearTimeout(shareTimer.current);
      shareTimer.current = window.setTimeout(() => setShareCopied(false), 1600);
    } catch {
      // Clipboard unavailable; the URL bar still holds the shareable link.
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setConfig((c) => ({ ...c, mode: preset.mode, targets: presetToTargets(preset) }));
    setResults(null);
    setGeneratedFrom(null);
  };

  return (
    <div className="app">
      <Header />

      <section className="section" aria-label="Examples">
        <h2>Try an example</h2>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="preset-btn"
              onClick={() => applyPreset(p.id)}
              title={p.description}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section" aria-label="Target colors">
        <h2>Target colors</h2>
        <div className="targets-grid">
          {targets.map((t, i) => (
            <TargetColorCard
              key={t.id}
              target={t}
              index={i}
              onChange={updateTarget}
              onRemove={() => removeTarget(t.id)}
              canRemove={targets.length > 1}
            />
          ))}
        </div>
        <div style={{ marginTop: '0.9rem' }}>
          <button
            type="button"
            className="btn"
            onClick={addTarget}
            disabled={targets.length >= MAX_TARGETS}
          >
            + Add another target color
          </button>
        </div>
      </section>

      <div className="toolbar">
        <GenerationModeSelector
          mode={mode}
          onChange={(m) => setConfig((c) => ({ ...c, mode: m }))}
        />
        <div className="field">
          <label className="field-label" htmlFor="preview-mode">
            Preview layout
          </label>
          <select
            id="preview-mode"
            value={previewMode}
            onChange={(e) =>
              setConfig((c) => ({ ...c, previewMode: e.target.value as PreviewMode }))
            }
          >
            <option value="center">Target centered inside surround</option>
            <option value="side">Side by side</option>
            <option value="border">Surrounding border</option>
            <option value="stripes">Alternating stripes</option>
          </select>
        </div>
        <div className="field" style={{ minWidth: '10rem' }}>
          <label className="field-label" htmlFor="preview-size">
            Target size in preview
          </label>
          <input
            id="preview-size"
            type="range"
            min={15}
            max={85}
            value={previewSize}
            onChange={(e) =>
              setConfig((c) => ({ ...c, previewSize: Number(e.target.value) }))
            }
            aria-valuetext={`${previewSize} percent`}
          />
        </div>
        <div className="spacer" />
        <button type="button" className="btn" onClick={copyShareLink}>
          {shareCopied ? 'Link copied!' : 'Copy share link'}
        </button>
        <button type="button" className="btn" onClick={reset}>
          Reset
        </button>
        <button type="button" className="btn-primary btn" onClick={generate}>
          Generate suggestions
        </button>
      </div>

      {mode === 'shared' && conflicts.length > 0 && (
        <div className="banner" role="status" style={{ marginTop: '1rem' }}>
          <strong>Some requests pull in opposite directions:</strong>
          <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem' }}>
            {conflicts.map((c, i) => (
              <li key={i}>
                {targetLabel(c.targetIds[0])} and {targetLabel(c.targetIds[1])}: {c.reason}
              </li>
            ))}
          </ul>
          Shared results will be compromises between these goals.
        </div>
      )}

      <section className="section" aria-label="Results" aria-live="polite">
        <h2>Suggestions</h2>

        {resultsStale && (
          <div className="banner banner-info" role="status">
            Inputs have changed since these results were generated. Click{' '}
            <strong>Generate suggestions</strong> to refresh them.
          </div>
        )}

        {results === null && (
          <EmptyState message="Set up your target colors and desired effects, then click “Generate suggestions” to see surrounding colors predicted to produce them." />
        )}

        {results?.kind === 'individual' &&
          results.byTarget.map(({ target, results: list }, i) => (
            <div className="target-result-group" key={target.id}>
              <h3>
                <span className="mini-swatch" style={{ background: target.color.hex }} aria-hidden="true" />
                Target {i + 1} — {target.color.hex} · {getEffect(target.effectId).label.toLowerCase()}
              </h3>
              <div className="results-grid">
                {list.map((r) => (
                  <ResultCard
                    key={r.id}
                    result={r}
                    targets={[target]}
                    mode="individual"
                    previewMode={previewMode}
                    previewSize={previewSize}
                  />
                ))}
              </div>
            </div>
          ))}

        {results?.kind === 'shared' && (
          <>
            {results.shared.isCompromise && (
              <div className="banner" role="status">
                No single surrounding color strongly satisfies every requested effect.
                These results satisfy the greatest number of targets or provide the best
                overall compromise — each card explains its tradeoffs.
              </div>
            )}
            <div className="results-grid">
              {results.shared.results.map((r) => (
                <ResultCard
                  key={r.id}
                  result={r}
                  targets={results.targets}
                  mode="shared"
                  previewMode={previewMode}
                  previewSize={previewSize}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
