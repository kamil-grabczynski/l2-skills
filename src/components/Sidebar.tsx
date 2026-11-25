import { useTranslation } from "react-i18next";
import type { ChronicleData, LevelRange, Preset, Row } from "../types";
import { raceLabel, tierLabel } from "../lib/data";
import { fmt } from "../lib/format";
import { ClassIcon } from "./ClassIcon";
import { LevelInput } from "./LevelInput";

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
  const { t } = useTranslation();
  const c = p.data.classes[p.cls];
  let cum = 0;

  return (
    <section className="panel controls" aria-label={t("sidebar.settings")}>
      <button type="button" className="class-card" onClick={p.onOpenClasses}>
        <ClassIcon icon={c.icon} size="lg" />
        <span className="cc-text">
          <span className="cc-tier">{tierLabel(p.chain.length - 1)}</span>
          <strong>{c.name}</strong>
          <span className="cc-race">{raceLabel(c.race)}</span>
          <span className="chron-badge sm">{p.data.name}</span>
        </span>
        <span className="cc-change">{t("sidebar.change")}</span>
      </button>

      <div className="chain" aria-label={t("common.classPath")}>
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
        <span className="label">{t("sidebar.levelRange")}</span>
        <div className="presets">
          {p.presets.map((pr) => (
            <button
              type="button"
              key={pr.label ?? "all"}
              aria-pressed={pr.from === p.range.from && pr.to === p.range.to}
              onClick={() => p.onRange({ from: pr.from, to: pr.to })}
            >
              {pr.label ?? t("sidebar.wholeRange")}
              <small>
                {pr.from}–{pr.to}
              </small>
            </button>
          ))}
        </div>
        <div className="range-row">
          <label>
            {t("sidebar.from")}{" "}
            <LevelInput
              label={t("sidebar.fromLevel")}
              value={p.range.from}
              min={1}
              max={99}
              acceptsLive={(n) => n <= p.range.to}
              onCommit={(n) => p.onRange({ from: Math.min(n, p.range.to), to: Math.max(n, p.range.to) })}
            />
          </label>
          <label>
            {t("sidebar.to")}{" "}
            <LevelInput
              label={t("sidebar.toLevel")}
              value={p.range.to}
              min={1}
              max={99}
              acceptsLive={(n) => n >= p.range.from}
              onCommit={(n) => p.onRange({ from: Math.min(n, p.range.from), to: Math.max(n, p.range.from) })}
            />
          </label>
        </div>
        <input
          type="range"
          min={1}
          max={p.maxLv}
          value={Math.min(p.range.to, p.maxLv)}
          aria-label={t("sidebar.targetLevel")}
          onChange={(e) => p.onRange({ from: Math.min(p.range.from, +e.target.value), to: +e.target.value })}
        />
        <small className="hint">{t("sidebar.rangeHint")}</small>
      </div>

      <div className="summary">
        <div className="stat big">
          <span>{t("common.neededSp")}</span>
          <strong>{fmt(p.totals.sp)}</strong>
        </div>
        <div className="stat">
          <span>{t("sidebar.skills")}</span>
          <strong>{fmt(p.totals.skills)}</strong>
        </div>
        <div className="stat">
          <span>{t("sidebar.skillLevels")}</span>
          <strong>{fmt(p.totals.levels)}</strong>
        </div>
        <div className="stat">
          <span>{t("sidebar.books")}</span>
          <strong>{fmt(p.totals.books.length)}</strong>
        </div>
        <div className="stat">
          <span>{t("sidebar.skippedSp")}</span>
          <strong>{fmt(p.totals.skipped)}</strong>
        </div>
      </div>

      <details className="breakdown" open={!narrow()}>
        <summary>{t("sidebar.spPerLevel")}</summary>
        <table>
          <thead>
            <tr>
              <th>Lv</th>
              <th>SP</th>
              <th>{t("sidebar.sum")}</th>
            </tr>
          </thead>
          <tbody>
            {p.totals.perLevel.length ? (
              p.totals.perLevel.map(([l, sp]) => {
                cum += sp;
                return (
                  <tr key={l} title={t("sidebar.gotoLevel", { level: l })} onClick={() => p.onGotoLevel(l)}>
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
        <summary>{t("sidebar.neededBooks")}</summary>
        <ul className="books">
          {p.totals.books.length ? (
            p.totals.books.map((r) => (
              <li key={r.key}>
                {p.data.books[r.book] ?? `item ${r.book}`}{" "}
                <span className="lv">
                  {t("sidebar.bookFor", { skill: r.sk.n, lv: r.lv, level: r.l })}
                </span>
              </li>
            ))
          ) : (
            <li>{t("sidebar.none")}</li>
          )}
        </ul>
      </details>
    </section>
  );
}
