import { useEffect, useRef, useState } from 'react';
import type {
  CandidateResult,
  GenerationMode,
  PreviewMode,
  TargetColorRequest,
} from '../types/color';
import { formatOklch, formatRgb } from '../color/conversions';
import { ComparisonPreview } from './ComparisonPreview';
import { SharedComparisonPreview } from './SharedComparisonPreview';

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable: select-and-copy fallback is out of scope; the
      // values are visible as text either way.
    }
  };

  return (
    <button type="button" className="copy-btn" data-copied={copied} onClick={copy}>
      {copied ? 'Copied!' : label}
      <span className="visually-hidden" role="status">
        {copied ? `${text} copied to clipboard` : ''}
      </span>
    </button>
  );
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 75) return 'High confidence';
  if (confidence >= 45) return 'Medium confidence';
  return 'Low confidence';
}

type Props = {
  result: CandidateResult;
  targets: TargetColorRequest[];
  mode: GenerationMode;
  previewMode: PreviewMode;
  previewSize: number;
};

export function ResultCard({ result, targets, mode, previewMode, previewSize }: Props) {
  const targetIndex = (id: string) => targets.findIndex((t) => t.id === id) + 1;
  const individualTarget =
    mode === 'individual'
      ? targets.find((t) => t.id === result.targetScores[0]?.targetId)
      : undefined;

  return (
    <article className="result-card">
      <div className="result-head">
        <div
          className="result-swatch"
          style={{ background: result.color.hex }}
          role="img"
          aria-label={`Suggested surrounding color ${result.color.hex}`}
        />
        <div className="result-values">
          <div>
            <code>{result.color.hex}</code>
          </div>
          <div>
            <code>{formatRgb(result.color.rgb)}</code>
          </div>
          <div>
            <code>{formatOklch(result.oklch)}</code>
          </div>
        </div>
      </div>

      <div className="score-badges">
        <span className="badge badge-score">
          {mode === 'shared' ? 'Shared score' : 'Score'} {result.overallScore}/100
        </span>
        <span className="badge">{confidenceLabel(result.confidence)}</span>
        {mode === 'shared' &&
          result.targetScores.map((ts) => (
            <span
              key={ts.targetId}
              className={`badge ${
                ts.conflict ? 'badge-conflict' : ts.satisfied ? 'badge-satisfied' : 'badge-weak'
              }`}
              title={ts.explanation}
            >
              T{targetIndex(ts.targetId)}: {ts.score}
              {ts.conflict ? ' (conflicts)' : ts.satisfied ? '' : ' (weak)'}
            </span>
          ))}
      </div>

      <p className="explanation">{result.explanation}</p>

      <div className="copy-row">
        <CopyButton label="Copy HEX" text={result.color.hex} />
        <CopyButton label="Copy RGB" text={formatRgb(result.color.rgb)} />
      </div>

      {mode === 'individual' && individualTarget ? (
        <ComparisonPreview
          targetHex={individualTarget.color.hex}
          surroundHex={result.color.hex}
          mode={previewMode}
          size={previewSize}
        />
      ) : (
        <SharedComparisonPreview
          targets={targets}
          surroundHex={result.color.hex}
          mode={previewMode}
          size={previewSize}
        />
      )}
    </article>
  );
}
