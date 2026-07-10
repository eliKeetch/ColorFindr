import type { PreviewMode, TargetColorRequest } from '../types/color';
import { ContextSwatch } from './ComparisonPreview';

type Props = {
  targets: TargetColorRequest[];
  surroundHex: string;
  mode: PreviewMode;
  size: number;
};

/** Shared-mode preview: every target swatch inside the same surround. */
export function SharedComparisonPreview({ targets, surroundHex, mode, size }: Props) {
  return (
    <div className="shared-preview-grid">
      {targets.map((t, i) => (
        <div key={t.id}>
          <div className="shared-preview-cell">
            <ContextSwatch
              targetHex={t.color.hex}
              surroundHex={surroundHex}
              mode={mode}
              size={size}
              ariaLabel={`Target ${i + 1} (${t.color.hex}) with suggested surrounding color ${surroundHex}`}
            />
          </div>
          <div className="preview-caption">Target {i + 1}</div>
        </div>
      ))}
    </div>
  );
}
