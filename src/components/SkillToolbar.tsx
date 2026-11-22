import { useEffect, useRef } from "react";
import type { SkillType } from "../types";

interface Props {
  search: string;
  type: SkillType;
  showZero: boolean;
  allCollapsed: boolean;
  onSearch: (v: string) => void;
  onType: (t: SkillType) => void;
  onShowZero: (v: boolean) => void;
  onAllOn: () => void;
  onAllOff: () => void;
  onReset: () => void;
  onCollapseAll: () => void;
}

const TYPES: [SkillType, string][] = [
  ["all", "Wszystkie"],
  ["a", "Aktywne"],
  ["p", "Pasywne"],
];

export function SkillToolbar(p: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // level headers stick right below the toolbar, whose height changes when it wraps
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => document.documentElement.style.setProperty("--toolbar-h", `${Math.floor(el.getBoundingClientRect().height)}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="toolbar" ref={ref}>
      <div className="tb-row">
        <input type="search" placeholder="Szukaj skila…" aria-label="Szukaj skila" value={p.search} onChange={(e) => p.onSearch(e.target.value)} />
        <div className="seg" role="group" aria-label="Typ skila">
          {TYPES.map(([t, label]) => (
            <button type="button" key={t} aria-pressed={p.type === t} onClick={() => p.onType(t)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="tb-row">
        <label className="switch">
          <input type="checkbox" checked={p.showZero} onChange={(e) => p.onShowZero(e.target.checked)} />
          <span />
          pokaż skile 0 SP
        </label>
        <div className="btns">
          <button type="button" onClick={p.onAllOn}>Zaznacz widoczne</button>
          <button type="button" onClick={p.onAllOff}>Odznacz widoczne</button>
          <button type="button" onClick={p.onReset} title="Przywróć domyślne (wszystko zaznaczone)">Reset</button>
          <button type="button" onClick={p.onCollapseAll}>{p.allCollapsed ? "Rozwiń poziomy" : "Zwiń poziomy"}</button>
        </div>
      </div>
    </div>
  );
}
