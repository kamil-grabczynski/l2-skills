import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { ChronicleData, Row, SelMap } from "../types";
import { fmt, short, skillMeta } from "../lib/format";
import { skillHref } from "../lib/route";
import { SkillIcon } from "./ClassIcon";
import { TriCheckbox } from "./TriCheckbox";

export interface Section {
  l: number;
  /** rows grouped by skill, each group sorted by skill level */
  groups: Row[][];
}

export interface SkillActions {
  setKeys: (keys: string[], on: boolean) => void;
  toggleKey: (key: string) => void;
  toggleOpen: (l: number, id: number) => void;
  setSkillEverywhere: (id: number, on: boolean) => void;
  toggleCollapsed: (l: number) => void;
}

interface ListProps {
  data: ChronicleData;
  sections: Section[];
  sel: SelMap;
  collapsed: Set<number>;
  opened: Set<string>;
  /** skill id -> number of its levels inside the level range (for "select everywhere") */
  levelsInRange: Map<number, number>;
  actions: SkillActions;
  stale: boolean;
}

export function SkillList({ data, sections, sel, collapsed, opened, levelsInRange, actions, stale }: ListProps) {
  return (
    <div className={`skill-list${stale ? " stale" : ""}`}>
      {sections.map((s) => (
        <LevelSection
          key={s.l}
          data={data}
          section={s}
          sel={sel}
          closed={collapsed.has(s.l)}
          opened={opened}
          levelsInRange={levelsInRange}
          actions={actions}
        />
      ))}
    </div>
  );
}

interface SectionProps {
  data: ChronicleData;
  section: Section;
  sel: SelMap;
  closed: boolean;
  opened: Set<string>;
  levelsInRange: Map<number, number>;
  actions: SkillActions;
}

function LevelSection({ data, section, sel, closed, opened, levelsInRange, actions }: SectionProps) {
  const { t } = useTranslation();
  const { l, groups } = section;
  let n = 0, on = 0, sp = 0, total = 0;
  const classes = new Set<string>();
  for (const g of groups) {
    for (const r of g) {
      n++;
      total += r.sp;
      classes.add(data.classes[r.cls].name);
      if (sel[r.key]) {
        on++;
        sp += r.sp;
      }
    }
  }
  return (
    <section className={`lvl${closed ? " closed" : ""}`} id={`lvl-${l}`}>
      <header className="lvl-head">
        <TriCheckbox
          on={on}
          total={n}
          label={t("list.selectLevel", { level: l })}
          onChange={(checked) => actions.setKeys(groups.flat().map((r) => r.key), checked)}
        />
        <button type="button" className="lvl-title" aria-expanded={!closed} onClick={() => actions.toggleCollapsed(l)}>
          <span className="lvl-num">{t("list.level", { level: l })}</span>
          <span className="lvl-meta">
            {t("common.skills", { count: groups.length })} · {[...classes].join(", ")}
          </span>
        </button>
        <span className="lvl-sp">
          {fmt(sp)}
          {sp !== total && <small> / {fmt(total)}</small>} SP
        </span>
      </header>
      {!closed && (
        <div className="lvl-body">
          {groups.map((g) => (
            <SkillRow
              key={g[0].id}
              l={l}
              group={g}
              mask={g.map((r) => (sel[r.key] ? "1" : "0")).join("")}
              open={opened.has(`${l}:${g[0].id}`)}
              books={data.books}
              slug={data.slug}
              everywhere={levelsInRange.get(g[0].id) ?? 0}
              actions={actions}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface RowProps {
  l: number;
  group: Row[];
  /** "1" per selected skill level - lets memo skip rows whose selection did not change */
  mask: string;
  open: boolean;
  books: Record<string, string>;
  slug: string;
  everywhere: number;
  actions: SkillActions;
}

const SkillRow = memo(function SkillRow({ l, group, mask, open, books, slug, everywhere, actions }: RowProps) {
  const { t } = useTranslation();
  const sk = group[0].sk;
  const id = group[0].id;
  const isOn = (i: number) => mask[i] === "1";
  let on = 0, sp = 0, total = 0, bookCount = 0;
  group.forEach((r, i) => {
    total += r.sp;
    if (r.book) bookCount++;
    if (isOn(i)) {
      on++;
      sp += r.sp;
    }
  });

  // what the highest level of this row gives, visible without opening the details
  const top = group[group.length - 1].lv;
  const brief = sk.e?.[top] ?? sk.d[top] ?? "";

  return (
    <div className={`skill${on ? "" : " off"}${open ? " open" : ""}`}>
      <div className="skill-main">
        <TriCheckbox on={on} total={group.length} label={t("list.include", { skill: sk.n })} onChange={(c) => actions.setKeys(group.map((r) => r.key), c)} />
        <SkillIcon file={sk.i} />
        <div className="sname">
          <div className="line1">
            <a className="skill-link" href={skillHref(slug, id)} title={t("list.skillPage")}>
              {sk.n}
            </a>
            <span className={`tag ${sk.p ? "p" : "a"}`}>{sk.p ? t("common.passive") : t("common.active")}</span>
            {group.length === 1 && <span className="lvl-meta">Lv {group[0].lv}</span>}
            {bookCount > 0 && <span className="tag book">{t("list.book")}{bookCount > 1 ? ` ×${bookCount}` : ""}</span>}
            <button type="button" className="more" aria-expanded={open} onClick={() => actions.toggleOpen(l, id)}>
              {open ? `${t("list.collapse")} ▴` : `${t("list.details")} ▾`}
            </button>
          </div>
          {!open && brief && (
            <div className="brief" title={brief}>
              {group.length > 1 && <b>Lv {top}: </b>}
              {brief}
            </div>
          )}
          {group.length > 1 && (
            <div className="chips">
              {group.map((r, i) => (
                <button
                  type="button"
                  key={r.key}
                  className={`chip${isOn(i) ? " on" : ""}${r.book ? " book" : ""}`}
                  aria-pressed={isOn(i)}
                  title={`${sk.n} Lv ${r.lv}: ${fmt(r.sp)} SP${r.book ? ` · ${books[r.book] ?? ""}` : ""}
${sk.e?.[r.lv] ?? sk.d[r.lv] ?? ""}`}
                  onClick={() => actions.toggleKey(r.key)}
                >
                  <b>Lv {r.lv}</b>
                  <small>{short(r.sp)} SP</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ssp">
          {fmt(sp)}
          {sp !== total && <small>{t("list.ofTotal", { total: fmt(total) })}</small>}
        </div>
      </div>
      {open && (
        <div className="details">
          <table>
            <thead>
              <tr>
                <th>{t("list.skill")}</th>
                <th>SP</th>
                <th>{t("list.description")}</th>
              </tr>
            </thead>
            <tbody>
              {group.map((r, i) => (
                <tr key={r.key} className={isOn(i) ? "" : "off"}>
                  <td>Lv {r.lv}</td>
                  <td className="n">{fmt(r.sp)} SP</td>
                  <td className="desc">
                    {sk.d[r.lv]}
                    {sk.e?.[r.lv] && <div className="effect">{sk.e[r.lv]}</div>}
                    {sk.m?.[r.lv] && <div className="usage">{skillMeta(sk.m[r.lv])}</div>}
                    {r.book > 0 && (
                      <>
                        <br />
                        <span className="tag book">{books[r.book] ?? `item ${r.book}`}</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {everywhere > group.length && (
            <div className="acts">
              <button type="button" onClick={() => actions.setSkillEverywhere(id, true)}>
                {t("list.selectEverywhere", { skill: sk.n, n: everywhere })}
              </button>
              <button type="button" onClick={() => actions.setSkillEverywhere(id, false)}>
                {t("list.deselectEverywhere")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
