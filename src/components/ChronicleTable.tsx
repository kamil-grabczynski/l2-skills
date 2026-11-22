import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ChronicleRef, Evolution } from "../types";
import { chronicleLabel, loadEvolution } from "../lib/data";
import { SkillIcon } from "./ClassIcon";

interface Props {
  cls: string;
  className: string;
  chronicles: ChronicleRef[];
  active: string;
  onPickChronicle: (slug: string) => void;
}

interface Group {
  /** index (in evolution.chronicles) of the chronicle that introduced the skills */
  at: number;
  rows: [number, (number | null)[]][];
}

/** Skills a class gained after C1: one column per chronicle (C2 ... H5), grouped by the chronicle that added them. */
export function ChronicleTable({ cls, className, chronicles, active, onPickChronicle }: Props) {
  const [evo, setEvo] = useState<Evolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    loadEvolution().then(setEvo, (e: Error) => setError(e.message));
  }, []);

  const names = useMemo(() => new Map(chronicles.map((c) => [c.slug, c.name])), [chronicles]);

  const groups: Group[] = useMemo(() => {
    if (!evo) return [];
    const byFirst = new Map<number, Group>();
    for (const row of evo.classes[cls] ?? []) {
      const [id, lv] = row;
      if (q && !(evo.skills[id]?.n ?? "").toLowerCase().includes(q)) continue;
      const at = lv.findIndex((v, i) => i > 0 && !!v);
      if (at < 0) continue;
      let g = byFirst.get(at);
      if (!g) byFirst.set(at, (g = { at, rows: [] }));
      g.rows.push(row);
    }
    for (const g of byFirst.values()) {
      g.rows.sort((a, b) => (evo.skills[a[0]]?.n ?? "").localeCompare(evo.skills[b[0]]?.n ?? ""));
    }
    return [...byFirst.values()].sort((a, b) => a.at - b.at);
  }, [evo, cls, q]);

  if (error) return <div className="status">Błąd: {error}</div>;
  if (!evo) return <div className="status">Ładowanie porównania kronik…</div>;

  // C1 is the baseline, so it gets no column
  const cols = evo.chronicles.map((slug, i) => ({ slug, i })).filter((c) => c.i > 0);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  const cell = (lv: (number | null)[], i: number, on: boolean) => {
    const v = lv[i];
    const a = on ? " active" : "";
    if (v === null) return <td key={i} className={`na${a}`} title="Klasa nie istnieje w tej kronice">·</td>;
    if (!v) return <td key={i} className={`no${a}`} title="Brak skila">—</td>;
    const prev = lv.slice(1, i).filter((x) => x !== null).pop() ?? 0;
    const kind = !prev ? "new" : v > prev ? "up" : v < prev ? "down" : "";
    const title = !prev ? "Skil pojawia się w tej kronice" : v !== prev ? `Max poziom zmieniony z ${prev} na ${v}` : "";
    return (
      <td key={i} className={`yes ${kind}${a}`} title={title}>
        {v}
        {kind === "up" && <span className="arrow">▲</span>}
        {kind === "down" && <span className="arrow">▼</span>}
      </td>
    );
  };

  return (
    <div className="evo">
      <div className="evo-head">
        <div>
          <strong>Skile dodane po C1 · {className}</strong>
          <p className="hint">
            Liczba w komórce to maksymalny poziom skila w danej kronice. Kliknij kronikę w nagłówku tabeli, aby ją wybrać.
          </p>
        </div>
        <input type="search" placeholder="Szukaj skila…" aria-label="Szukaj skila" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="evo-legend">
        <span><i className="yes new">3</i> nowy w tej kronice</span>
        <span><i className="yes up">5▲</i> wyższy max poziom</span>
        <span><i className="yes">5</i> jest</span>
        <span><i className="no">—</i> brak skila</span>
        <span><i className="na">·</i> brak klasy</span>
      </div>

      {total === 0 ? (
        <div className="status">
          {q ? `Brak skili pasujących do „${query}”.` : "Ta klasa nie dostała żadnych nowych skili po C1."}
        </div>
      ) : (
        <div className="evo-scroll">
          <table className="evo-table">
            <thead>
              <tr>
                <th className="sk">Skil ({total})</th>
                {cols.map((c) => (
                  <th key={c.slug} className={c.slug === active ? "active" : ""}>
                    <button type="button" title={names.get(c.slug)} onClick={() => onPickChronicle(c.slug)}>
                      {chronicleLabel(c.slug)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.at}>
                <tr className="grp">
                  <th className="sk" colSpan={cols.length + 1}>
                    Nowe w {chronicleLabel(evo.chronicles[g.at])} · {(names.get(evo.chronicles[g.at]) ?? "").replace(/^C\d:\s*/, "")}{" "}
                    <span className="count">({g.rows.length})</span>
                  </th>
                </tr>
                {g.rows.map(([id, lv]) => (
                  <tr key={id}>
                    <th className="sk">
                      <SkillIcon file={evo.skills[id]?.i ?? ""} />
                      <span>{evo.skills[id]?.n ?? `Skill ${id}`}</span>
                    </th>
                    {cols.map((c) => cell(lv, c.i, c.slug === active))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}
