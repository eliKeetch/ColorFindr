import type { GenerationMode, TargetColorRequest } from '../types/color';
import { colorValueFromHex } from '../color/conversions';

export type Preset = {
  id: string;
  label: string;
  description: string;
  mode: GenerationMode;
  targets: Array<{ hex: string; effectId: string }>;
};

export const PRESETS: Preset[] = [
  {
    id: 'beige-yellow',
    label: 'Beige → more yellow',
    description: 'Make a warm beige appear more yellow',
    mode: 'individual',
    targets: [{ hex: '#C8B58A', effectId: 'more-yellow' }],
  },
  {
    id: 'gray-blue',
    label: 'Gray → more blue',
    description: 'Make a cool gray appear more blue',
    mode: 'individual',
    targets: [{ hex: '#8B8F94', effectId: 'more-blue' }],
  },
  {
    id: 'greige-gray',
    label: 'Greige → more gray',
    description: 'Make a warm greige appear more gray',
    mode: 'individual',
    targets: [{ hex: '#A89F96', effectId: 'more-gray' }],
  },
  {
    id: 'shared-trio',
    label: 'Shared: three targets',
    description: 'One surround for three different goals',
    mode: 'shared',
    targets: [
      { hex: '#C2A77D', effectId: 'more-yellow' },
      { hex: '#8897A2', effectId: 'more-blue' },
      { hex: '#A99791', effectId: 'more-muted' },
    ],
  },
];

let counter = 0;
export function newTargetId(): string {
  counter += 1;
  return `t-${Date.now().toString(36)}-${counter}`;
}

export function presetToTargets(preset: Preset): TargetColorRequest[] {
  return preset.targets.map(({ hex, effectId }) => ({
    id: newTargetId(),
    color: colorValueFromHex(hex)!,
    effectId,
    strength: 55,
    priority: 2,
  }));
}

export function defaultTarget(): TargetColorRequest {
  return {
    id: newTargetId(),
    color: colorValueFromHex('#C8B58A')!,
    effectId: 'more-yellow',
    strength: 55,
    priority: 2,
  };
}
