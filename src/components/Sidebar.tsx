import type { ChronicleData, LevelRange, Preset, Row } from "../types";
import { raceLabel, TIER_LABEL } from "../lib/data";
import { fmt } from "../lib/format";
import { ClassIcon } from "./ClassIcon";

export interface Totals {
  sp: number;
  skipped: number;
  skills: number;
  levels: number;
  perLevel: [number, number][];
  books: Row[];
}

interface Props {
  data: ChronicleData;
  cls: string;
  chain: string[];
  range: LevelRange;
  maxLv: number;
  presets: Preset[];
  totals: Totals;
  onOpenClasses: () => void;
  onPickClass: (cls: string) => void;
  onRange: (r: LevelRange) => void;
  onGotoLevel: (l: number) => void;
}

const narrow = () => typeof window !== "undefined" && window.matchMedia?.("(max-width: 860px)").matches;

export function Sidebar(p: Props) {
  const c = p.data.classes[p.cls];
  const num = (v: string) => Math.max(1, Math.min(99, parseInt(v, 10) || 1));
  let cum = 0;

  return (
    <section className="panel controls" aria-label="Ustawienia">
      <button type="button" className="class-card" onClick={p.onOpenClasses}>
        <ClassIcon icon={c.icon} size="lg" />
        <span className="cc-text">
          <span className="cc-tier">{TIER_LABEL[p.chain.length - 1]}</span>
          <strong>{c.name}</strong>
          <span className="cc-race">{raceLabel(c.race)}</span>
          <span className="chron-badge sm">{p.data.name}</span>
        </span>
        <span className="cc-change">Zmień</span>
      </button>

      <div className="chain" aria-label="Ścieżka klasy">
        {p.chain.map((x, i) => (
          <span key={x} className="chain-item">
            {i > 0 && <span className="sep">›</span>}
            <button type="button" aria-current={x === p.cls} onClick={() => p.onPickClass(x)}>
              {p.data.classes[x].name}
            </button>
          </span>
        ))}
      </div>

      <div className="field">
        <span className="label">Zakres poziomów postaci</span>
        <div className="presets">
          {p.presets.map((pr) => (
            <button
              type="button"
              key={pr.label}
              aria-pressed={pr.from === p.range.from && pr.to === p.range.to}
              onClick={() => p.onRange({ from: pr.from, to: pr.to })}
            >
              {pr.label}
              <small>
                {pr.from}–{pr.to}
              </small>
            </button>
          ))}
        </div>
        <div className="range-row">
          <label>
            od <input type="number" min={1} max={99} value={p.range.from} onChange={(e) => p.onRange({ ...p.range, from: num(e.target.value) })} />
          </label>
          <label>
            do <input type="number" min={1} max={99} value={p.range.to} onChange={(e) => p.onRange({ ...p.range, to: num(e.target.value) })} />
          </label>
        </div>
        <input
          type="range"
          min={1}
          max={p.maxLv}
          value={Math.min(p.range.to, p.maxLv)}
          aria-label="Poziom docelowy"
          onChange={(e) => p.onRange({ from: Math.min(p.range.from, +e.target.value), to: +e.target.value })}
        />
        <small className="hint">Liczone są skile do nauczenia na poziomach od–do.</small>
      </div>

      <div className="summary">
        <div className="stat big">
          <span>Potrzebne SP</span>
          <strong>{fmt(p.totals.sp)}</strong>
        </div>
        <div className="stat">
          <span>Skile</span>
          <strong>{fmt(p.totals.skills)}</strong>
        </div>
        <div className="stat">
          <span>Poziomy skili</span>
          <strong>{fmt(p.totals.levels)}</strong>
        </div>
        <div className="stat">
          <span>Książki</span>
          <strong>{fmt(p.totals.books.length)}</strong>
        </div>
        <div className="stat">
          <span>Pominięte SP</span>
          <strong>{fmt(p.totals.skipped)}</strong>
        </div>
      </div>

      <details className="breakdown" open={!narrow()}>
        <summary>SP na poziom postaci</summary>
        <table>
          <thead>
            <tr>
              <th>Lv</th>
              <th>SP</th>
              <th>Suma</th>
            </tr>
          </thead>
          <tbody>
            {p.totals.perLevel.length ? (
              p.totals.perLevel.map(([l, sp]) => {
                cum += sp;
                return (
                  <tr key={l} title={`Przejdź do poziomu ${l}`} onClick={() => p.onGotoLevel(l)}>
                    <td>{l}</td>
                    <td>{fmt(sp)}</td>
                    <td>{fmt(cum)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={3}>—</td>
              </tr>
            )}
          </tbody>
        </table>
      </details>

      <details className="breakdown">
        <summary>Potrzebne spellbooki</summary>
        <ul className="books">
          {p.totals.books.length ? (
            p.totals.books.map((r) => (
              <li key={r.key}>
                {p.data.books[r.book] ?? `item ${r.book}`}{" "}
                <span className="lv">
                  — {r.sk.n} Lv {r.lv}, poz. {r.l}
                </span>
              </li>
            ))
          ) : (
            <li>brak</li>
          )}
        </ul>
      </details>
    </section>
  );
}
