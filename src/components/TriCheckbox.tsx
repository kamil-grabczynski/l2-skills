import { useEffect, useRef } from "react";

interface Props {
  on: number;
  total: number;
  label: string;
  onChange: (checked: boolean) => void;
}

/** Checkbox that shows the mixed state when only part of its items is selected. */
export function TriCheckbox({ on, total, label, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const mixed = on > 0 && on < total;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={total > 0 && on === total}
      aria-label={label}
      aria-checked={mixed ? "mixed" : on === total}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}
