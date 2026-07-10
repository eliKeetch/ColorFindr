const PRESETS = [
  { label: 'Subtle', value: 25 },
  { label: 'Moderate', value: 55 },
  { label: 'Strong', value: 85 },
];

type Props = {
  value: number;
  onChange: (strength: number) => void;
  id: string;
};

/**
 * Strength presets backed by a 1–100 slider. A preset button is highlighted
 * when the slider sits closest to it.
 */
export function StrengthControl({ value, onChange, id }: Props) {
  const nearest = PRESETS.reduce((best, p) =>
    Math.abs(p.value - value) < Math.abs(best.value - value) ? p : best,
  );

  return (
    <div className="field">
      <span className="field-label" id={`${id}-label`}>
        Effect strength
      </span>
      <div className="segmented" role="group" aria-labelledby={`${id}-label`}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={nearest.label === p.label}
            onClick={() => onChange(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        id={id}
        className="strength-slider"
        type="range"
        min={1}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-labelledby={`${id}-label`}
        aria-valuetext={`${value} of 100 (${nearest.label.toLowerCase()})`}
      />
    </div>
  );
}
