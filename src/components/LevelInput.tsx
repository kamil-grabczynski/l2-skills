import { useEffect, useState } from "react";

interface Props {
  value: number;
  min: number;
  max: number;
  /** a typed value is applied right away only when this accepts it; otherwise on blur / Enter */
  acceptsLive: (n: number) => boolean;
  onCommit: (n: number) => void;
  label: string;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Number field that can be cleared and retyped (e.g. "30") without being forced back to a valid value
 * on every keystroke. Out-of-order or empty values are only applied when the field loses focus.
 */
export function LevelInput({ value, min, max, acceptsLive, onCommit, label }: Props) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  // follow outside changes (presets, slider) while the user is not typing here
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    const v = clamp(n, min, max);
    setDraft(String(v));
    if (v !== value) onCommit(v);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      aria-label={label}
      value={draft}
      onFocus={(e) => {
        setEditing(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parseInt(e.target.value, 10);
        if (!Number.isNaN(n) && n >= min && n <= max && acceptsLive(n)) onCommit(n);
      }}
      onBlur={() => {
        setEditing(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(String(value));
          e.currentTarget.blur();
        }
      }}
    />
  );
}
