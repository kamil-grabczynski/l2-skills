import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ChronicleRef, Evolution } from "../types";
import { chronicleLabel, loadEvolution } from "../lib/data";
import { readJson, writeJson } from "../lib/storage";
import { SkillIcon } from "./ClassIcon";

interface Props {
  cls: string;
  className: string;
  chronicles: ChronicleRef[];
  active: string;
  onPickChronicle: (slug: string) => void;
}

type Row = [number, (number | null)[]];
type Mode = "icons" | "table";

/** "C1: Harbingers of War" -> "Harbingers of War" */
const shortName = (name = "") => name.replace(/^C\d:\s*/, "");

/** Last known max level before chronicle i (null = class did not exist yet). */
const prevLevel = (lv: (number | null)[], i: number) => lv.slice(0, i).filter((x) => x !== null).pop() ?? 0;

/** Skills a class gained after C1, shown per chronicle (C2 ... H5) as icon cards or as a table. */
export function ChronicleTable({ cls, className, chronicles, active, onPickChronicle }: Props) {
  const [evo, setEvo] = useState<Evolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setModeState] = useState<Mode>(() => readJson<Mode>("spcalc:evoMode", "icons"));
  const q = useDeferredValue(query.trim().toLowerCase());

  const setMode = (m: Mode) => {
    setModeState(m);
    writeJson("spcalc:evoMode", m);
  };

  useEffect(() => {
    loadEvolution().then(setEvo, (e: Error) => setError(e.message));
  }, []);

  const names = useMemo(() => new Map(chronicles.map((c) => [c.slug, c.name])), [chronicles]);

  const rows: Row[] = useMemo(() => {
    if (!evo) return [];
    return (evo.classes[cls] ?? [])
      .filter(([id]) => !q || (evo.skills[id]?.n ?? "").toLowerCase().includes(q))
      .sort((a, b) => (evo.skills[a[0]]?.n ?? "").localeCompare(evo.skills[b[0]]?.n ?? ""));
  }, [evo, cls, q]);

  if (error) return <div className="status">Błąd: {error}</div>;
  if (!evo) return <div className="status">Ładowanie porównania kronik…</div>;

  // C1 is the baseline, so it gets no column/card
  const cols = evo.chronicles.map((slug, i) => ({ slug, i })).filter((c) => c.i > 0);
  const skillName = (id: number) => evo.skills[id]?.n ?? `Skill ${id}`;

  return (
    <div className="evo">
      <div className="evo-head">
        <div>
          <strong>Skile dodane po C1 · {className}</strong>
          <p className="hint">
            {mode === "icons"
              ? "Kroniki od lewej do prawej: co doszło, urosło lub zniknęło. Przewiń w bok; kliknij kronikę, aby ją wybrać."
              : "Liczba w komórce to maksymalny poziom skila w danej kronice. Kliknij kronikę w nagłówku, aby ją wybrać."}
          </p>
        </div>
        <div className="evo-tools">
          <div className="seg" role="group" aria-label="Widok porównania">
            <button type="button" aria-pressed={mode === "icons"} onClick={() => setMode("icons")}>
              Ikony
            </button>
            <button type="button" aria-pressed={mode === "table"} onClick={() => setMode("table")}>
              Tabela
            </button>
          </div>
          <input type="search" placeholder="Szukaj skila…" aria-label="Szukaj skila" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="status">{q ? `Brak skili pasujących do „${query}”.` : "Ta klasa nie dostała żadnych nowych skili po C1."}</div>
      ) : mode === "icons" ? (
        <IconCards
          rows={rows}
          cols={cols}
          evo={evo}
          names={names}
          active={active}
          skillName={skillName}
          onPickChronicle={onPickChronicle}
        />
      ) : (
        <Table rows={rows} cols={cols} evo={evo} names={names} active={active} skillName={skillName} onPickChronicle={onPickChronicle} />
      )}
    </div>
  );
}

interface ViewProps {
  rows: Row[];
  cols: { slug: string; i: number }[];
  evo: Evolution;
  names: Map<string, string>;
  active: string;
  skillName: (id: number) => string;
  onPickChronicle: (slug: string) => void;
}

function IconCards({ rows, cols, evo, names, active, skillName, onPickChronicle }: ViewProps) {
  const strip = useRef<HTMLDivElement>(null);
  // bring the selected chronicle's column into view in the horizontal strip
  useEffect(() => {
    const box = strip.current;
    const card = box?.querySelector<HTMLElement>(".evo-card.active");
    if (box && card) box.scrollTo({ left: card.offsetLeft - 8, behavior: "smooth" });
  }, [active]);

  const cards = cols.map(({ slug, i }) => {
    const added: [number, number][] = [];
    const up: [number, number, number][] = [];
    const down: [number, number, number][] = [];
    const removed: [number, number][] = [];
    let classExists = false;
    for (const [id, lv] of rows) {
      const v = lv[i];
      if (v === null) continue;
      classExists = true;
      const prev = prevLevel(lv, i);
      if (v && !prev) added.push([id, v]);
      else if (v && v > prev) up.push([id, prev, v]);
      else if (v && v < prev) down.push([id, prev, v]);
      else if (!v && prev) removed.push([id, prev]);
    }
    return { slug, added, up, down, removed, classExists };
  });

  const tile = (id: number, kind: string, badge: string, title: string) => (
    <div key={`${kind}-${id}`} className={`evo-tile ${kind}`} title={title}>
      <span className="ti">
        <SkillIcon file={evo.skills[id]?.i ?? ""} />
        <b className="lvb">{badge}</b>
      </span>
      <span className="tn">{skillName(id)}</span>
    </div>
  );

  return (
    <div className="evo-cards" ref={strip}>
      {cards.map((c) => {
        const changes = c.added.length + c.up.length + c.down.length + c.removed.length;
        return (
          <section key={c.slug} className={`evo-card${c.slug === active ? " active" : ""}${changes ? "" : " quiet"}`}>
            <header>
              <button type="button" className="ec-title" onClick={() => onPickChronicle(c.slug)} title={`Wybierz ${names.get(c.slug)}`}>
                <b>{chronicleLabel(c.slug)}</b>
                <span>{shortName(names.get(c.slug))}</span>
              </button>
              <span className="ec-count">
                {!c.classExists
                  ? "brak klasy"
                  : changes
                    ? [
                        c.added.length && `+${c.added.length} nowe`,
                        c.up.length && `▲${c.up.length}`,
                        c.down.length && `▼${c.down.length}`,
                        c.removed.length && `−${c.removed.length} usunięte`,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "bez zmian"}
              </span>
            </header>
            {c.classExists && changes > 0 && (
              <div className="ec-body">
                {c.added.length > 0 && (
                  <div className="ec-group">
                    <span className="ec-label">Nowe</span>
                    <div className="ec-tiles">{c.added.map(([id, v]) => tile(id, "new", String(v), `${skillName(id)} · nowy, max Lv ${v}`))}</div>
                  </div>
                )}
                {c.up.length > 0 && (
                  <div className="ec-group">
                    <span className="ec-label">Wyższy poziom</span>
                    <div className="ec-tiles">{c.up.map(([id, p, v]) => tile(id, "up", `${v}`, `${skillName(id)} · max Lv ${p} → ${v}`))}</div>
                  </div>
                )}
                {c.down.length > 0 && (
                  <div className="ec-group">
                    <span className="ec-label">Niższy poziom</span>
                    <div className="ec-tiles">{c.down.map(([id, p, v]) => tile(id, "down", `${v}`, `${skillName(id)} · max Lv ${p} → ${v}`))}</div>
                  </div>
                )}
                {c.removed.length > 0 && (
                  <div className="ec-group">
                    <span className="ec-label">Usunięte</span>
                    <div className="ec-tiles">{c.removed.map(([id, p]) => tile(id, "removed", "✕", `${skillName(id)} · usunięty (był Lv ${p})`))}</div>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Table({ rows, cols, evo, names, active, skillName, onPickChronicle }: ViewProps) {
  // group rows by the chronicle that introduced the skill
  const groups = new Map<number, Row[]>();
  for (const row of rows) {
    const at = row[1].findIndex((v, i) => i > 0 && !!v);
    if (at < 0) continue;
    if (!groups.has(at)) groups.set(at, []);
    groups.get(at)!.push(row);
  }
  const ordered = [...groups.entries()].sort((a, b) => a[0] - b[0]);

  const cell = (lv: (number | null)[], i: number, on: boolean) => {
    const v = lv[i];
    const a = on ? " active" : "";
    if (v === null) return <td key={i} className={`na${a}`} title="Klasa nie istnieje w tej kronice">·</td>;
    if (!v) return <td key={i} className={`no${a}`} title="Brak skila">—</td>;
    const prev = prevLevel(lv, i);
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
    <>
      <div className="evo-legend">
        <span><i className="yes new">3</i> nowy w tej kronice</span>
        <span><i className="yes up">5▲</i> wyższy max poziom</span>
        <span><i className="yes">5</i> jest</span>
        <span><i className="no">—</i> brak skila</span>
        <span><i className="na">·</i> brak klasy</span>
      </div>
      <div className="evo-scroll">
        <table className="evo-table">
          <thead>
            <tr>
              <th className="sk">Skil ({rows.length})</th>
              {cols.map((c) => (
                <th key={c.slug} className={c.slug === active ? "active" : ""}>
                  <button type="button" title={names.get(c.slug)} onClick={() => onPickChronicle(c.slug)}>
                    {chronicleLabel(c.slug)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          {ordered.map(([at, grp]) => (
            <tbody key={at}>
              <tr className="grp">
                <th className="sk" colSpan={cols.length + 1}>
                  Nowe w {chronicleLabel(evo.chronicles[at])} · {shortName(names.get(evo.chronicles[at]))}{" "}
                  <span className="count">({grp.length})</span>
                </th>
              </tr>
              {grp.map(([id, lv]) => (
                <tr key={id}>
                  <th className="sk">
                    <SkillIcon file={evo.skills[id]?.i ?? ""} />
                    <span>{skillName(id)}</span>
                  </th>
                  {cols.map((c) => cell(lv, c.i, c.slug === active))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </>
  );
}
