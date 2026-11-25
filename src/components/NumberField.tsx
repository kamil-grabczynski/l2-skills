import { useEffect, useState } from "react";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (n: number) => void;
}

/** Labelled number input that can be cleared and retyped; out-of-range values are clamped on blur. */
export function NumberField({ label, value, min, max, suffix, onChange }: Props) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);
  const inRange = (n: number) => Number.isFinite(n) && n >= min && n <= max;
  return (
    <label className="num-field">
      <span>{label}</span>
      <span className="num-input">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          onFocus={() => setEditing(true)}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = parseFloat(e.target.value);
            if (inRange(n)) onChange(n);
          }}
          onBlur={() => {
            setEditing(false);
            const n = parseFloat(draft);
            if (Number.isFinite(n) && !inRange(n)) onChange(Math.min(Math.max(n, min), max));
          }}
        />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  );
}
