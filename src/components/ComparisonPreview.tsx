import type { CSSProperties } from 'react';
import type { PreviewMode } from '../types/color';

type ContextProps = {
  targetHex: string;
  surroundHex: string;
  mode: PreviewMode;
  /** Relative size of the target within the preview, 15–85 (%). */
  size: number;
  ariaLabel: string;
};

/** The target swatch rendered inside/next to the suggested surround. */
export function ContextSwatch({ targetHex, surroundHex, mode, size, ariaLabel }: ContextProps) {
  const base: CSSProperties = { width: '100%', height: '100%' };

  let inner: JSX.Element;
  switch (mode) {
    case 'side':
      inner = (
        <div style={{ ...base, display: 'flex' }}>
          <div style={{ width: `${size}%`, background: targetHex }} />
          <div style={{ flex: 1, background: surroundHex }} />
        </div>
      );
      break;
    case 'border':
      inner = (
        <div
          style={{
            ...base,
            background: targetHex,
            border: `${6 + (85 - size) * 0.45}px solid ${surroundHex}`,
          }}
        />
      );
      break;
    case 'stripes': {
      const stripe = 6 + size * 0.3;
      inner = (
        <div
          style={{
            ...base,
            background: `repeating-linear-gradient(90deg, ${targetHex} 0 ${stripe}px, ${surroundHex} ${stripe}px ${stripe * 2}px)`,
          }}
        />
      );
      break;
    }
    case 'center':
    default:
      inner = (
        <div
          style={{
            ...base,
            background: surroundHex,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: `${size}%`,
              height: `${size}%`,
              background: targetHex,
            }}
          />
        </div>
      );
  }

  return (
    <div className="preview-context" role="img" aria-label={ariaLabel}>
      {inner}
    </div>
  );
}

type Props = {
  targetHex: string;
  surroundHex: string;
  mode: PreviewMode;
  size: number;
};

/** Individual-mode preview: the target alone vs. the target in context. */
export function ComparisonPreview({ targetHex, surroundHex, mode, size }: Props) {
  return (
    <div>
      <div className="preview-wrap">
        <div style={{ width: '26%' }}>
          <div
            className="preview-alone"
            style={{ background: targetHex, height: '100%', minHeight: 60 }}
            role="img"
            aria-label={`Target color ${targetHex} on its own`}
          />
        </div>
        <div style={{ flex: 1 }}>
          <ContextSwatch
            targetHex={targetHex}
            surroundHex={surroundHex}
            mode={mode}
            size={size}
            ariaLabel={`Target color ${targetHex} shown with suggested surrounding color ${surroundHex}`}
          />
        </div>
      </div>
      <div className="preview-caption" aria-hidden="true">
        alone · in context
      </div>
    </div>
  );
}
