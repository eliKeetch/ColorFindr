import type { EffectCategory } from '../types/color';
import { CATEGORY_LABELS, EFFECTS } from '../color/effects';

type Props = {
  value: string;
  onChange: (effectId: string) => void;
  id: string;
};

const CATEGORY_ORDER: EffectCategory[] = [
  'hue',
  'temperature',
  'lightness',
  'chroma',
  'neutrality',
  'contrast',
];

/** Grouped effect picker: one select with a category optgroup per group. */
export function EffectSelector({ value, onChange, id }: Props) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        Desired perceived effect
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {CATEGORY_ORDER.map((cat) => (
          <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
            {EFFECTS.filter((e) => e.category === cat).map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
