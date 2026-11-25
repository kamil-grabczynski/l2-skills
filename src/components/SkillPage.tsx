import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ChronicleData, SkillInfo } from "../types";
import { chronicleLabel } from "../lib/data";
import { hrefFor } from "../lib/route";
import { fmt, fmt1, skillMeta } from "../lib/format";
import { skillDescription, skillEffect } from "../lib/skillText";
import { usePersistentState } from "../lib/storage";
import { STAT_DEFAULT, clampChance, hasDebuffRes, landChance, type Duel, type Shot } from "../lib/debuff";
import { SkillIcon } from "./ClassIcon";
import { Landing } from "./Landing";

interface Props {
  data: ChronicleData;
  id: string;
  /** class to go back to, null = class picker */
  cls: string | null;
}

/** Character level, SP and spellbook of one skill level, with every class that learns it on those terms. */
interface Learn {
  l: number;
  sp: number;
  book: number;
  classes: string[];
}

function learnRows(data: ChronicleData, id: number) {
  const byLevel = new Map<number, Learn[]>();
  for (const c of Object.values(data.classes)) {
    for (const [l, sid, lv, sp, book = 0] of c.rows) {
      if (sid !== id) continue;
      let list = byLevel.get(lv);
      if (!list) byLevel.set(lv, (list = []));
      const same = list.find((x) => x.l === l && x.sp === sp && x.book === book);
      if (same) same.classes.push(c.name);
      else list.push({ l, sp, book, classes: [c.name] });
    }
  }
  for (const list of byLevel.values()) list.sort((a, b) => a.l - b.l);
  return byLevel;
}

/** Page of one skill: its levels and, for debuffs, what decides whether it lands. */
export function SkillPage({ data, id, cls }: Props) {
  const { t } = useTranslation();
  const sk = data.skills[id];
  const back = (
    <a className="back" href={hrefFor(data.slug, cls)}>
      ← {cls ? data.classes[cls].name : t("picker.label")}
    </a>
  );
  if (!sk) {
    return (
      <main className="skill-page">
        {back}
        <section className="panel sk-block">
          <h2>{t("skill.missing", { chronicle: chronicleLabel(data.slug) })}</h2>
          <p className="hint">{t("skill.missingHint")}</p>
        </section>
      </main>
    );
  }
  return <Content key={`${data.slug}/${id}`} data={data} id={id} sk={sk} back={back} />;
}

/** Calculator values kept between skills; a missing one starts from a value fitting the skill. */
export interface SavedDuel {
  mAtk?: number;
  mDef?: number;
  shot: Shot;
  debuffRes: number;
}

const SAVED: SavedDuel = { shot: "bss", debuffRes: 0 };

function Content({ data, id, sk, back }: { data: ChronicleData; id: string; sk: SkillInfo; back: ReactNode }) {
  const { t } = useTranslation();
  const learn = useMemo(() => learnRows(data, Number(id)), [data, id]);
  const levels = useMemo(() => Object.keys(sk.d).map(Number).sort((a, b) => a - b), [sk]);
  const r = sk.r;
  const inCalc = r ? levels.filter((lv) => r.v[lv]) : [];
  const learnable = inCalc.filter((lv) => learn.has(lv));
  const [picked, setPicked] = useState(() => (learnable.length ? learnable : inCalc).slice(-1)[0] ?? 0);
  const [saved, setSaved] = usePersistentState<SavedDuel>("spcalc:duel", SAVED);
  const [own, setOwn] = useState<Partial<Duel>>({});

  // M.Def starts where it balances M.Atk with a Blessed Spiritshot (x1), so the first numbers show the plain weights
  const magicLevel = Math.max(r?.v[picked]?.[0] ?? 1, 1);
  const mAtk0 = Math.max(magicLevel, 5) * 10;
  const duel: Duel = {
    level: own.level ?? magicLevel,
    stat: own.stat ?? (r?.s ? STAT_DEFAULT[r.s] : 0),
    typeRes: own.typeRes ?? 0,
    mAtk: saved.mAtk ?? mAtk0,
    mDef: saved.mDef ?? Math.round(22 * Math.sqrt(mAtk0)),
    shot: saved.shot,
    debuffRes: hasDebuffRes(data.slug) ? saved.debuffRes : 0,
  };
  // only skills with a target stat and a base rate follow the formula
  const rolls = !!r && !!r.s && inCalc.some((lv) => r.v[lv][2] > 0);

  return (
    <main className="skill-page">
      {back}
      <section className="panel sk-head">
        <SkillIcon file={sk.i} />
        <div>
          <h2>{sk.n}</h2>
          <div className="line1">
            <span className={`tag ${sk.p ? "p" : "a"}`}>{sk.p ? t("common.passive") : t("common.active")}</span>
            {r && <span className="tag">{t("skill.debuff")}</span>}
            {r && <span className="tag">{r.g ? t("skill.magic") : t("skill.physical")}</span>}
            <span className="lvl-meta">
              {chronicleLabel(data.slug)} · {levels.length === 1 ? t("skill.oneLevel") : t("skill.levelRange", { from: levels[0], to: levels[levels.length - 1] })}
              {learn.size === 0 && ` · ${t("skill.notLearned")}`}
            </span>
          </div>
        </div>
      </section>

      {r && rolls && (
        <Landing
          slug={data.slug}
          r={r}
          lv={picked}
          levels={inCalc}
          duel={duel}
          onLevel={setPicked}
          onOwn={(v) => setOwn((o) => ({ ...o, ...v }))}
          onSaved={(v) => setSaved((s) => ({ ...s, ...v }))}
          onReset={() => {
            setOwn({});
            setSaved({ ...SAVED, mAtk: undefined, mDef: undefined });
          }}
        />
      )}
      {r && !rolls && <NoRoll rate={r.v[inCalc[inCalc.length - 1]][2]} />}
      {sk.x && <Dispel x={sk.x} />}
      {!!sk.f && !r && (
        <section className="panel sk-block">
          <h3>{t("landing.title")}</h3>
          <p>{t("skill.instant")}</p>
        </section>
      )}

      <section className="panel sk-block">
        <h3>{t("skill.levels")}</h3>
        <div className="sk-scroll">
          <table className="sk-levels">
            <thead>
              <tr>
                <th>Lv</th>
                <th>{t("skill.learn")}</th>
                <th>{t("skill.gives")}</th>
                {rolls && (
                  <>
                    <th title={t("skill.baseTitle")}>{t("skill.base")}</th>
                    <th title={t("skill.magicLevelTitle")}>{t("skill.magicLevel")}</th>
                    <th title={t("skill.chanceTitle")}>{t("skill.chance")}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {levels.map((lv) => (
                <tr key={lv} className={rolls && lv === picked ? "on" : ""}>
                  <td className="n">
                    <b>{lv}</b>
                  </td>
                  <td className="learn">
                    {learn.get(lv)?.map((x) => (
                      <div key={`${x.l}-${x.sp}-${x.book}`}>
                        <b>{t("skill.learnLevel", { level: x.l })}</b> · {fmt(x.sp)} SP
                        <small>{x.classes.join(", ")}</small>
                        {x.book > 0 && <span className="tag book">{data.books[x.book] ?? `item ${x.book}`}</span>}
                      </div>
                    )) ?? "—"}
                  </td>
                  <td className="desc">
                    {skillDescription(sk.d[lv])}
                    {sk.e?.[lv] && <div className="effect">{skillEffect(sk.e[lv])}</div>}
                    {sk.m?.[lv] && <div className="usage">{skillMeta(sk.m[lv])}</div>}
                  </td>
                  {rolls && (r.v[lv] ? (
                    <>
                      <td className="n">{r.v[lv][2] > 0 ? `${r.v[lv][2]}%` : t("skill.always")}</td>
                      <td className="n">{r.v[lv][0]}</td>
                      <td className="n">
                        <button type="button" className="link" aria-pressed={lv === picked} title={t("skill.showInCalc")} onClick={() => setPicked(lv)}>
                          {r.v[lv][2] > 0 ? `${fmt1(clampChance(data.slug, landChance(r, lv, duel).raw))}%` : "100%"}
                        </button>
                      </td>
                    </>
                  ) : (
                    <td colSpan={3}>—</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function NoRoll({ rate }: { rate: number }) {
  const { t } = useTranslation();
  return (
    <section className="panel sk-block">
      <h3>{t("landing.title")}</h3>
      <p>
        {rate < 0 ? t("skill.alwaysLands") : t("skill.noStat", { rate })}
      </p>
    </section>
  );
}

/** Cancel and Bane skills roll separately for every buff of the target. */
function Dispel({ x }: { x: NonNullable<SkillInfo["x"]> }) {
  const { t } = useTranslation();
  const [lo, hi] = x.k === "bane" ? [40, 95] : [25, 75];
  return (
    <section className="panel sk-block">
      <h3>{t("dispel.title")}</h3>
      <p className="sk-formula">{t("dispel.formula")}</p>
      <table className="sk-factors">
        <tbody>
          <tr>
            <td>{t("dispel.buffLevel")}</td>
            <td className="n pp minus">−2 pp</td>
          </tr>
          <tr>
            <td>{t("dispel.buffTime")}</td>
            <td className="n pp plus">+1 pp</td>
          </tr>
          <tr>
            <td>{t("dispel.resist")}</td>
            <td className="n">{t("dispel.resistResult", { factor: fmt1(0.9) })}</td>
          </tr>
          {Object.entries(x.v).map(([lv, [ml, rate]]) => (
            <tr key={lv}>
              <td>{t("dispel.magicLevel", { lv, level: ml })}</td>
              <td className="n">{t("dispel.base", { rate })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="sk-notes">
        <li>{t("dispel.noteRange", { min: lo, max: hi })}</li>
        <li>{t("dispel.noteSource")}</li>
      </ul>
    </section>
  );
}
