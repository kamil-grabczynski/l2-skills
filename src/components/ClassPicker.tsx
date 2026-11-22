import { useMemo, useState } from "react";
import type { ChronicleData } from "../types";
import { chainOf, depthOf, raceLabel, raceRank, TIER_LABEL } from "../lib/data";
import { ClassIcon } from "./ClassIcon";

interface Props {
  data: ChronicleData;
  /** last class used in this chronicle, highlighted with its path */
  current: string | null;
  onPick: (cls: string) => void;
}

/** Start page: class tree per race, with search across all races. */
export function ClassPicker({ data, current, onPick }: Props) {
  const races = useMemo(
    () => [...new Set(Object.values(data.classes).map((c) => c.race))].sort((a, b) => raceRank(a) - raceRank(b)),
    [data],
  );
  const [race, setRace] = useState(() => (current && data.classes[current]?.race) || races[0]);
  const [query, setQuery] = useState("");
  const activeRace = races.includes(race) ? race : races[0];

  const chain = useMemo(() => new Set(current && data.classes[current] ? chainOf(data, current) : []), [data, current]);

  const q = query.trim().toLowerCase();
  const hits = useMemo(
    () =>
      q
        ? Object.keys(data.classes)
            .filter((c) => data.classes[c].name.toLowerCase().includes(q))
            .sort((a, b) => depthOf(data, a) - depthOf(data, b) || data.classes[a].name.localeCompare(data.classes[b].name))
        : [],
    [q, data],
  );

  const inRace = useMemo(() => Object.keys(data.classes).filter((c) => data.classes[c].race === activeRace), [data, activeRace]);
  const kids = (c: string) =>
    inRace.filter((x) => data.classes[x].parent === c).sort((a, b) => data.classes[a].name.localeCompare(data.classes[b].name));
  // fighters first, then mages
  const roots = inRace
    .filter((c) => !data.classes[c].parent)
    .sort((a, b) => Number(a.includes("mage")) - Number(b.includes("mage")));

  const btn = (c: string, sub?: React.ReactNode) => (
    <button
      type="button"
      key={c}
      className={`cls-btn${c === current ? " sel" : chain.has(c) ? " chain" : ""}`}
      onClick={() => onPick(c)}
    >
      <ClassIcon icon={data.classes[c].icon} size="sm" />
      <span className="t">
        {data.classes[c].name}
        <small>{sub ?? TIER_LABEL[depthOf(data, c)]}</small>
      </span>
    </button>
  );

  const node = (c: string): React.ReactNode => {
    const ch = kids(c);
    return (
      <div className="tnode" key={c}>
        {btn(c)}
        {ch.length > 0 && <div className="tchildren">{ch.map(node)}</div>}
      </div>
    );
  };

  return (
    <main className="picker">
      <section className="panel picker-panel" aria-label="Wybór klasy">
        <div className="picker-head">
          <div>
            <h2>Wybierz klasę</h2>
            <p className="hint">{data.name} · kliknij klasę, aby policzyć potrzebne SP</p>
          </div>
          <input
            type="search"
            placeholder="Szukaj klasy…"
            aria-label="Szukaj klasy"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits[0]) onPick(hits[0]);
            }}
          />
        </div>
        <nav className="seg race-tabs" aria-label="Rasa">
          {races.map((r) => (
            <button
              type="button"
              key={r}
              aria-pressed={!q && r === activeRace}
              onClick={() => {
                setRace(r);
                setQuery("");
              }}
            >
              {raceLabel(r)}
            </button>
          ))}
        </nav>
        <div className="picker-body">
          {q ? (
            hits.length ? (
              <div className="flat">
                {hits.map((c) =>
                  btn(
                    c,
                    <span className="path">
                      {raceLabel(data.classes[c].race)} · {chainOf(data, c).map((x) => data.classes[x].name).join(" › ")}
                    </span>,
                  ),
                )}
              </div>
            ) : (
              <div className="empty">Brak klas pasujących do „{query}”.</div>
            )
          ) : (
            <div className="tree">{roots.map(node)}</div>
          )}
        </div>
      </section>
    </main>
  );
}
