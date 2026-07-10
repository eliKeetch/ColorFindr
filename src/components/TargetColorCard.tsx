import type { TargetColorRequest } from '../types/color';
import { ColorInput } from './ColorInput';
import { EffectSelector } from './EffectSelector';
import { StrengthControl } from './StrengthControl';

type Props = {
  target: TargetColorRequest;
  index: number;
  onChange: (target: TargetColorRequest) => void;
  onRemove: () => void;
  canRemove: boolean;
};

const PRIORITIES = [
  { label: 'Low', value: 1 },
  { label: 'Normal', value: 2 },
  { label: 'High', value: 4 },
];

export function TargetColorCard({ target, index, onChange, onRemove, canRemove }: Props) {
  const idp = `target-${target.id}`;
  return (
    <section className="target-card" aria-label={`Target color ${index + 1}`}>
      <div className="target-card-header">
        <h3>Target {index + 1}</h3>
        {canRemove && (
          <button
            type="button"
            className="btn-ghost"
            onClick={onRemove}
            aria-label={`Remove target ${index + 1}`}
          >
            Remove
          </button>
        )}
      </div>

      <ColorInput
        value={target.color}
        onChange={(color) => onChange({ ...target, color })}
        idPrefix={idp}
      />

      <EffectSelector
        id={`${idp}-effect`}
        value={target.effectId}
        onChange={(effectId) => onChange({ ...target, effectId })}
      />

      <div className="two-col">
        <StrengthControl
          id={`${idp}-strength`}
          value={target.strength}
          onChange={(strength) => onChange({ ...target, strength })}
        />
        <div className="field">
          <label className="field-label" htmlFor={`${idp}-priority`}>
            Priority (shared mode)
          </label>
          <select
            id={`${idp}-priority`}
            value={target.priority}
            onChange={(e) => onChange({ ...target, priority: Number(e.target.value) })}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
