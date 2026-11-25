import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import type { ChronicleData, ChronicleRef, Evolution, SkillMeta } from "../types";
import { buildRows, chainOf, chronicleLabel, errorText, loadChronicle, loadEvolution } from "../lib/data";
import { readJson, writeJson } from "../lib/storage";
import { fmt, skillMeta } from "../lib/format";
import { skillDescription, skillEffect } from "../lib/skillText";
import { skillHref } from "../lib/route";
import { ClassIcon, SkillIcon } from "./ClassIcon";

interface Props {
  cls: string;
  data: ChronicleData;
  /** class path root -> cls */
  chain: string[];
  /** since = first chronicle that has the class (used when the current chronicle does not) */
  onPickClass: (cls: string, since: string) => void;
  onChangeClass: () => void;
  chronicles: ChronicleRef[];
  active: string;
  onPickChronicle: (slug: string) => void;
}

type Row = [number, (number | null)[]];
type Mode = "icons" | "table";

/**
 * Class path for the header: ancestors of the class, and from the 2nd profession on also its later
 * professions (e.g. Gladiator -> Duelist), even if the current chronicle does not have them yet.
 */
function useClassPath(cls: string) {
  const [info, setInfo] = useState<Evolution["classInfo"] | null>(null);
  useEffect(() => {
    loadEvolution().then((e) => setInfo(e.classInfo), () => setInfo(null));
  }, []);
  return useMemo(() => {
    if (!info || !info[cls]) return null;
    const up: string[] = [];
    for (let c: string | null = cls; c && info[c]; c = info[c].p) up.unshift(c);
    const down: string[] = [];
    if (up.length >= 3) {
      const walk = (c: string) =>
        Object.keys(info)
          .filter((k) => info[k].p === c)
          .sort()
          .forEach((k) => {
            down.push(k);
            walk(k);
          });
      walk(cls);
    }
    return [...up, ...down].map((c) => ({ c, n: info[c].n, i: info[c].i, s: info[c].s }));
  }, [info, cls]);
}

/** "C1: Harbingers of War" -> "Harbingers of War" */
const shortName = (name = "") => name.replace(/^C\d:\s*/, "");

/** Last known max level before chronicle i (null = class did not exist yet). */
const prevLevel = (lv: (number | null)[], i: number) => lv.slice(0, i).filter((x) => x !== null).pop() ?? 0;

/** Skills a class gained after C1, shown per chronicle (C2 ... H5) as icon cards or as a table. */
export function ChronicleTable({ cls, data, chain, onPickClass, onChangeClass, chronicles, active, onPickChronicle }: Props) {
  const { t } = useTranslation();
  const evoPath = useClassPath(cls);
  const [evo, setEvo] = useState<Evolution | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setModeState] = useState<Mode>(() => readJson<Mode>("spcalc:evoMode", "icons"));
  const q = useDeferredValue(query.trim().toLowerCase());

  const setMode = (m: Mode) => {
    setModeState(m);
    writeJson("spcalc:evoMode", m);
  };

  useEffect(() => {
    loadEvolution().then(setEvo, setError);
  }, []);

  const names = useMemo(() => new Map(chronicles.map((c) => [c.slug, c.name])), [chronicles]);

  const rows: Row[] = useMemo(() => {
    if (!evo) return [];
    return (evo.classes[cls] ?? [])
      .filter(([id]) => !q || (evo.skills[id]?.n ?? "").toLowerCase().includes(q))
      .sort((a, b) => (evo.skills[a[0]]?.n ?? "").localeCompare(evo.skills[b[0]]?.n ?? ""));
  }, [evo, cls, q]);

  if (error) return <div className="status">{errorText(error)}</div>;
  if (!evo) return <div className="status">{t("evo.loading")}</div>;

  // C1 is the baseline, so it gets no column/card
  const cols = evo.chronicles.map((slug, i) => ({ slug, i })).filter((c) => c.i > 0);
  const skillName = (id: number) => evo.skills[id]?.n ?? `Skill ${id}`;

  return (
    <div className="evo">
      <div className="evo-head">
        <div>
          <strong>{t("evo.title")}</strong>
          <div className="evo-chain" aria-label={t("common.classPath")}>
            {(evoPath ?? chain.map((c) => ({ c, n: data.classes[c].name, i: data.classes[c].icon ?? "", s: data.slug }))).map((x, i) => (
              <span key={x.c} className="chain-item">
                {i > 0 && <span className="sep">›</span>}
                <button
                  type="button"
                  aria-current={x.c === cls}
                  title={data.classes[x.c] ? undefined : t("evo.classSince", { chronicle: chronicleLabel(x.s) })}
                  onClick={() => onPickClass(x.c, x.s)}
                >
                  <ClassIcon icon={x.i} size="sm" />
                  {x.n}
                  {!data.classes[x.c] && <small className="since">{t("evo.since", { chronicle: chronicleLabel(x.s) })}</small>}
                </button>
              </span>
            ))}
            <button type="button" className="evo-change" onClick={onChangeClass}>
              {t("evo.changeClass")}
            </button>
          </div>
          <p className="hint">
            {mode === "icons"
              ? t("evo.hintIcons")
              : t("evo.hintTable")}
          </p>
        </div>
        <div className="evo-tools">
          <div className="seg" role="group" aria-label={t("evo.viewLabel")}>
            <button type="button" aria-pressed={mode === "icons"} onClick={() => setMode("icons")}>
              {t("evo.icons")}
            </button>
            <button type="button" aria-pressed={mode === "table"} onClick={() => setMode("table")}>
              {t("evo.table")}
            </button>
          </div>
          <input type="search" placeholder={t("common.searchSkill")} aria-label={t("common.searchSkillLabel")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="status">{q ? t("evo.noMatch", { query }) : t("evo.noNew")}</div>
      ) : mode === "icons" ? (
        <IconCards
          cls={cls}
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
  cls?: string;
  rows: Row[];
  cols: { slug: string; i: number }[];
  evo: Evolution;
  names: Map<string, string>;
  active: string;
  skillName: (id: number) => string;
  onPickChronicle: (slug: string) => void;
}

/** Skill shown in the hover popover: description is read from the chronicle where that level exists. */
interface Tip {
  id: number;
  /** chronicle of the card */
  slug: string;
  /** chronicle + skill level whose description is shown (for a removed skill: the last one that had it) */
  descSlug: string;
  descLv: number;
  /** a function, so an open popover follows a language change */
  info: () => string;
  rect: DOMRect;
}

function IconCards({ cls = "", rows, cols, evo, names, active, skillName, onPickChronicle }: ViewProps) {
  const { t } = useTranslation();
  const [tip, setTip] = useState<Tip | null>(null);
  const [desc, setDesc] = useState<(Desc & { key: string }) | null>(null);
  const tipKey = tip ? `${cls}:${tip.descSlug}:${tip.id}:${tip.descLv}` : "";

  useEffect(() => {
    if (!tip) return;
    let alive = true;
    loadChronicle(tip.descSlug).then(
      (d) => {
        const sk = d.skills[tip.id];
        // character level at which each skill level is learned, for this class path in that chronicle
        const own = d.classes[cls] ? buildRows(d, chainOf(d, cls)).filter((r) => r.id === tip.id) : [];
        own.sort((a, b) => a.lv - b.lv);
        const levels: Learn[] = [];
        for (const r of own) {
          const last = levels[levels.length - 1];
          if (last && last.l === r.l && last.to === r.lv - 1) {
            last.to = r.lv;
            last.sp += r.sp;
          } else levels.push({ l: r.l, from: r.lv, to: r.lv, sp: r.sp });
        }
        if (alive) setDesc({ key: tipKey, text: sk?.d[tip.descLv] ?? "", effect: sk?.e?.[tip.descLv] ?? "", meta: sk?.m?.[tip.descLv], passive: !!sk?.p, levels });
      },
      () => alive && setDesc({ key: tipKey, text: "", effect: "", passive: false, levels: [] }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipKey]);

  // the popover is positioned from the tile's rect, so drop it when the page moves
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [tip]);

  const lastWith = (lv: (number | null)[], i: number) => {
    for (let j = i - 1; j >= 0; j--) if (lv[j]) return j;
    return i;
  };

  const cards = cols.map(({ slug, i }) => {
    type Item = { id: number; v: number; prev: number; descSlug: string; descLv: number };
    const added: Item[] = [];
    const up: Item[] = [];
    const down: Item[] = [];
    const removed: Item[] = [];
    let classExists = false;
    for (const [id, lv] of rows) {
      const v = lv[i];
      if (v === null) continue;
      classExists = true;
      const prev = prevLevel(lv, i);
      const item = { id, v: v ?? 0, prev, descSlug: slug, descLv: v ?? 0 };
      if (v && !prev) added.push(item);
      else if (v && v > prev) up.push(item);
      else if (v && v < prev) down.push(item);
      else if (!v && prev) removed.push({ ...item, descSlug: evo.chronicles[lastWith(lv, i)], descLv: prev });
    }
    return { slug, added, up, down, removed, classExists };
  });

  const tile = (
    slug: string,
    it: { id: number; descSlug: string; descLv: number },
    kind: string,
    badge: string,
    info: () => string,
  ) => {
    const show = (el: HTMLElement) =>
      setTip({ id: it.id, slug, descSlug: it.descSlug, descLv: it.descLv, info, rect: el.getBoundingClientRect() });
    return (
      <a
        key={`${kind}-${it.id}`}
        href={skillHref(it.descSlug, it.id)}
        className={`evo-tile ${kind}`}
        aria-label={`${skillName(it.id)}: ${info()}`}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setTip(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setTip(null)}
      >
        <span className="ti">
          <SkillIcon file={evo.skills[it.id]?.i ?? ""} />
          <b className="lvb">{badge}</b>
        </span>
        <span className="tn">{skillName(it.id)}</span>
      </a>
    );
  };

  return (
    <div className="evo-cards">
      {cards.map((c) => {
        const changes = c.added.length + c.up.length + c.down.length + c.removed.length;
        return (
          <section key={c.slug} className={`evo-card${c.slug === active ? " active" : ""}${changes ? "" : " quiet"}`}>
            <header>
              <button type="button" className="ec-title" onClick={() => onPickChronicle(c.slug)} title={t("evo.pick", { chronicle: names.get(c.slug) ?? "" })}>
                <b>{chronicleLabel(c.slug)}</b>
                <span>{shortName(names.get(c.slug))}</span>
              </button>
              <span className="ec-count">
                {!c.classExists
                  ? t("evo.noClass")
                  : changes
                    ? [
                        c.added.length && t("evo.newCount", { count: c.added.length }),
                        c.up.length && `▲${c.up.length}`,
                        c.down.length && `▼${c.down.length}`,
                        c.removed.length && t("evo.removedCount", { count: c.removed.length }),
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : t("evo.noChanges")}
              </span>
            </header>
            {c.classExists && changes > 0 && (
              <div className="ec-body">
                {c.added.length > 0 && (
                  <div className="ec-group">
                    <span className="ec-label">{t("evo.groupNew")}</span>
                    <div className="ec-tiles">{c.added.map((it) => tile(c.slug, it, "new", String(it.v), () => i18n.t("evo.infoNew", { level: it.v })))}</div>
                  </div>
                )}
                {c.up.length > 0 && (
                  <div className="ec-group">
                    <span className="ec-label">{t("evo.groupUp")}</span>
                    <div className="ec-tiles">{c.up.map((it) => tile(c.slug, it, "up", String(it.v), () => i18n.t("evo.infoChanged", { prev: it.prev, level: it.v })))}</div>
                  </div>
                )}
                {c.down.length > 0 && (
                  <div className="ec-group">
                    <span className="ec-label">{t("evo.groupDown")}</span>
                    <div className="ec-tiles">{c.down.map((it) => tile(c.slug, it, "down", String(it.v), () => i18n.t("evo.infoChanged", { prev: it.prev, level: it.v })))}</div>
                  </div>
                )}
                {c.removed.length > 0 && (
                  <div className="ec-group">
                    <span className="ec-label">{t("evo.groupRemoved")}</span>
                    <div className="ec-tiles">{c.removed.map((it) => tile(c.slug, it, "removed", "✕", () => i18n.t("evo.infoRemoved", { prev: it.prev })))}</div>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
      {tip && (
        <SkillPopover
          tip={tip}
          name={skillName(tip.id)}
          icon={evo.skills[tip.id]?.i ?? ""}
          chronicle={`${chronicleLabel(tip.slug)} · ${shortName(names.get(tip.slug))}`}
          desc={desc && desc.key === tipKey ? desc : null}
        />
      )}
    </div>
  );
}

const POP_W = 320;

/** Skill levels learned at one character level. */
interface Learn {
  l: number;
  from: number;
  to: number;
  sp: number;
}

interface Desc {
  text: string;
  /** exact effect values, "" when there are none */
  effect: string;
  meta?: SkillMeta;
  passive: boolean;
  levels: Learn[];
}

interface PopoverProps {
  tip: Tip;
  name: string;
  icon: string;
  chronicle: string;
  desc: Desc | null;
}

function SkillPopover({ tip, name, icon, chronicle, desc }: PopoverProps) {
  const { t } = useTranslation();
  const usage = skillMeta(desc?.meta);
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  // measure before paint so the popover can flip above the tile or shift to stay on screen
  useLayoutEffect(() => {
    if (ref.current) setH(ref.current.offsetHeight);
  });
  const r = tip.rect;
  const left = Math.max(8, Math.min(r.left + r.width / 2 - POP_W / 2, window.innerWidth - POP_W - 8));
  const vh = window.innerHeight;
  const top =
    r.bottom + 8 + h <= vh - 8 ? r.bottom + 8 : r.top - 8 - h >= 8 ? r.top - 8 - h : Math.max(8, vh - h - 8);
  return (
    <div className="skill-pop" role="tooltip" ref={ref} style={{ left, top, width: POP_W, visibility: h ? "visible" : "hidden" }}>
      <div className="sp-head">
        <SkillIcon file={icon} />
        <div>
          <b>{name}</b>
          <span>
            {chronicle} · {tip.info()}
            {desc && <> · {desc.passive ? t("common.passive") : t("common.active")}</>}
          </span>
        </div>
      </div>
      <p>{desc ? skillDescription(desc.text) || (desc.effect ? "" : t("evo.noDescription")) : t("evo.loadingDescription")}</p>
      {desc?.effect && <p className="effect">{skillEffect(desc.effect)}</p>}
      {usage && <p className="usage">{usage}</p>}
      <small>
        {tip.descSlug !== tip.slug
          ? t("evo.descriptionFrom", { chronicle: chronicleLabel(tip.descSlug), level: tip.descLv })
          : t("evo.descriptionFor", { level: tip.descLv })}
      </small>
      {desc && desc.levels.length > 0 && (
        <div className="sp-levels">
          <span className="sp-levels-title">
            {t("evo.learnLevels")}{tip.descSlug !== tip.slug ? ` (${chronicleLabel(tip.descSlug)})` : ""}
          </span>
          <div className="sp-levels-list">
            {desc.levels.map((x) => (
              <span key={`${x.l}-${x.from}`} className="sp-lv">
                <b>{x.l}</b>
                Lv {x.from}
                {x.to !== x.from ? `–${x.to}` : ""}
                <em>{fmt(x.sp)} SP</em>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Table({ rows, cols, evo, names, active, skillName, onPickChronicle }: ViewProps) {
  const { t } = useTranslation();
  // group rows by the chronicle that introduced the skill
  const groups = new Map<number, Row[]>();
  for (const row of rows) {
    const at = row[1].findIndex((v, i) => i > 0 && !!v);
    if (at < 0) continue;
    if (!groups.has(at)) groups.set(at, []);
    groups.get(at)!.push(row);
  }
  const ordered = [...groups.entries()].sort((a, b) => a[0] - b[0]);

  /** the active chronicle when the skill exists there, otherwise the newest one that has it */
  const pageSlug = (lv: (number | null)[]) => {
    if (lv[evo.chronicles.indexOf(active)]) return active;
    let i = lv.length - 1;
    while (i > 0 && !lv[i]) i--;
    return evo.chronicles[i];
  };

  const cell = (lv: (number | null)[], i: number, on: boolean) => {
    const v = lv[i];
    const a = on ? " active" : "";
    if (v === null) return <td key={i} className={`na${a}`} title={t("evo.cellNoClass")}>·</td>;
    if (!v) return <td key={i} className={`no${a}`} title={t("evo.cellNoSkill")}>—</td>;
    const prev = prevLevel(lv, i);
    const kind = !prev ? "new" : v > prev ? "up" : v < prev ? "down" : "";
    const title = !prev ? t("evo.cellNew") : v !== prev ? t("evo.cellChanged", { prev, level: v }) : "";
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
        <span><i className="yes new">3</i> {t("evo.legendNew")}</span>
        <span><i className="yes up">5▲</i> {t("evo.legendUp")}</span>
        <span><i className="yes">5</i> {t("evo.legendPresent")}</span>
        <span><i className="no">—</i> {t("evo.legendNoSkill")}</span>
        <span><i className="na">·</i> {t("evo.legendNoClass")}</span>
      </div>
      <div className="evo-scroll">
        <table className="evo-table">
          <thead>
            <tr>
              <th className="sk">{t("evo.skillColumn", { n: rows.length })}</th>
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
                  {t("evo.newIn", { chronicle: chronicleLabel(evo.chronicles[at]) })} · {shortName(names.get(evo.chronicles[at]))}{" "}
                  <span className="count">({grp.length})</span>
                </th>
              </tr>
              {grp.map(([id, lv]) => (
                <tr key={id}>
                  <th className="sk">
                    <SkillIcon file={evo.skills[id]?.i ?? ""} />
                    <a className="skill-link" href={skillHref(pageSlug(lv), id)}>
                      {skillName(id)}
                    </a>
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
