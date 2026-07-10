import type { GenerationMode } from '../types/color';

type Props = {
  mode: GenerationMode;
  onChange: (mode: GenerationMode) => void;
};

export function GenerationModeSelector({ mode, onChange }: Props) {
  return (
    <div className="field">
      <span className="field-label" id="genmode-label">
        Generation mode
      </span>
      <div className="segmented" role="group" aria-labelledby="genmode-label">
        <button
          type="button"
          aria-pressed={mode === 'individual'}
          onClick={() => onChange('individual')}
        >
          Individual results
        </button>
        <button
          type="button"
          aria-pressed={mode === 'shared'}
          onClick={() => onChange('shared')}
        >
          Shared results
        </button>
      </div>
    </div>
  );
}
