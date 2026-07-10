import { useEffect, useState } from 'react';
import type { ColorValue } from '../types/color';
import {
  colorValueFromHex,
  colorValueFromRgb,
  parseHex,
  parseRgbChannel,
} from '../color/conversions';

type Props = {
  value: ColorValue;
  onChange: (color: ColorValue) => void;
  idPrefix: string;
};

/**
 * Synchronized color picker + HEX field + R/G/B fields with a live swatch.
 * Invalid text is kept in the field (so typing isn't fought) with an inline
 * error; only valid values propagate upward.
 */
export function ColorInput({ value, onChange, idPrefix }: Props) {
  const [hexText, setHexText] = useState(value.hex);
  const [rgbText, setRgbText] = useState({
    r: String(value.rgb.r),
    g: String(value.rgb.g),
    b: String(value.rgb.b),
  });
  const [hexError, setHexError] = useState<string | null>(null);
  const [rgbError, setRgbError] = useState<string | null>(null);

  // Resync drafts when the committed value changes (picker, preset, share URL).
  useEffect(() => {
    setHexText(value.hex);
    setRgbText({ r: String(value.rgb.r), g: String(value.rgb.g), b: String(value.rgb.b) });
    setHexError(null);
    setRgbError(null);
  }, [value.hex, value.rgb.r, value.rgb.g, value.rgb.b]);

  const handleHex = (text: string) => {
    setHexText(text);
    const rgb = parseHex(text);
    if (rgb) {
      setHexError(null);
      onChange(colorValueFromRgb(rgb));
    } else {
      setHexError('Enter a hex color like #C8B58A or #fa0.');
    }
  };

  const handleRgb = (channel: 'r' | 'g' | 'b', text: string) => {
    const next = { ...rgbText, [channel]: text };
    setRgbText(next);
    const r = parseRgbChannel(next.r);
    const g = parseRgbChannel(next.g);
    const b = parseRgbChannel(next.b);
    if (r !== null && g !== null && b !== null) {
      setRgbError(null);
      onChange(colorValueFromRgb({ r, g, b }));
    } else {
      setRgbError('Each channel must be a whole number from 0 to 255.');
    }
  };

  const hexErrId = `${idPrefix}-hex-error`;
  const rgbErrId = `${idPrefix}-rgb-error`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div className="swatch-row">
        <input
          type="color"
          className="color-picker"
          value={value.hex}
          onChange={(e) => {
            const c = colorValueFromHex(e.target.value);
            if (c) onChange(c);
          }}
          aria-label="Color picker"
        />
        <div
          className="big-swatch"
          style={{ background: value.hex }}
          role="img"
          aria-label={`Current target color preview, ${value.hex}`}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-hex`}>
          HEX
        </label>
        <input
          id={`${idPrefix}-hex`}
          type="text"
          value={hexText}
          onChange={(e) => handleHex(e.target.value)}
          aria-invalid={hexError !== null}
          aria-describedby={hexError ? hexErrId : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        {hexError && (
          <p className="inline-error" id={hexErrId}>
            {hexError}
          </p>
        )}
      </div>

      <div>
        <div className="rgb-inputs">
          {(['r', 'g', 'b'] as const).map((ch) => (
            <div className="field" key={ch}>
              <label className="field-label" htmlFor={`${idPrefix}-${ch}`}>
                {ch.toUpperCase()}
              </label>
              <input
                id={`${idPrefix}-${ch}`}
                type="number"
                min={0}
                max={255}
                step={1}
                value={rgbText[ch]}
                onChange={(e) => handleRgb(ch, e.target.value)}
                aria-invalid={rgbError !== null}
                aria-describedby={rgbError ? rgbErrId : undefined}
              />
            </div>
          ))}
        </div>
        {rgbError && (
          <p className="inline-error" id={rgbErrId}>
            {rgbError}
          </p>
        )}
      </div>
    </div>
  );
}
