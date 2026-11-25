import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ChronicleData, SkillInfo } from "../types";
import { chronicleLabel, defaultClass } from "../lib/data";
import { hrefFor } from "../lib/route";
import { fmt, fmt1, skillMeta } from "../lib/format";
import { skillDescription, skillEffect } from "../lib/skillText";
import { usePersistentState } from "../lib/storage";
import {
  SHOT, STAT_DEFAULT, finalChance, hasDebuffRes, hasTraitBonus, usesAttributes, type Duel, type Shot,
} from "../lib/debuff";
import {
  baseStats, findMonster, loadMonsters, playerMAtk, playerMDef, weaponMAtk,
  type AttackerChoice, type Monster, type TargetChoice, type TargetValues,
} from "../lib/target";
import { SkillIcon } from "./ClassIcon";
import { Landing } from "./Landing";
import { AttackerPicker } from "./AttackerPicker";
import { TargetPicker } from "./TargetPicker";

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
  return <Content key={`${data.slug}/${id}`} data={data} id={id} sk={sk} cls={cls} back={back} />;
}

/** Calculator values kept between skills; a missing one starts from a value fitting the skill. */
export interface SavedDuel {
  mAtk?: number;
  mDef?: number;
  int?: number;
  intAdd: number;
  mAtkPct: number;
  mDefPct: number;
  shot: Shot;
  debuffRes: number;
  landBonus: number;
}

const SAVED: SavedDuel = { shot: "bss", debuffRes: 0, intAdd: 0, mAtkPct: 0, mDefPct: 0, landBonus: 0 };
const SHOTS = Object.keys(SHOT) as Shot[];

interface ContentProps {
  data: ChronicleData;
  id: string;
  sk: SkillInfo;
  cls: string | null;
  back: ReactNode;
}

function Content({ data, id, sk, cls, back }: ContentProps) {
  const { t } = useTranslation();
  const learn = useMemo(() => learnRows(data, Number(id)), [data, id]);
  const levels = useMemo(() => Object.keys(sk.d).map(Number).sort((a, b) => a - b), [sk]);
  const r = sk.r;
  const inCalc = r ? levels.filter((lv) => r.v[lv]) : [];
  const learnable = inCalc.filter((lv) => learn.has(lv));
  const [picked, setPicked] = useState(() => (learnable.length ? learnable : inCalc).slice(-1)[0] ?? 0);
  const [saved, setSaved] = usePersistentState<SavedDuel>("spcalc:duel", SAVED);
  const [own, setOwn] = useState<Partial<Duel>>({});
  const [target, setTarget] = usePersistentState<TargetChoice>("spcalc:target", { kind: "manual" });
  const [attacker, setAttacker] = usePersistentState<AttackerChoice>("spcalc:attacker", { kind: "manual" });
  const [loaded, setLoaded] = useState<{ slug: string; list: Monster[] | null } | null>(null);
  // a chronicle has its own monsters, loaded when they are first needed
  useEffect(() => {
    if (target.kind !== "monster") return;
    let alive = true;
    loadMonsters(data.slug).then(
      (list) => alive && setLoaded({ slug: data.slug, list }),
      () => alive && setLoaded({ slug: data.slug, list: null }),
    );
    return () => {
      alive = false;
    };
  }, [target.kind, data.slug]);
  const monsters = loaded?.slug === data.slug ? loaded.list : null;
  const monster = useMemo(() => (monsters && target.monster ? findMonster(monsters, target.monster) : undefined), [monsters, target.monster]);
  const player = target.cls && data.classes[target.cls] ? target.cls : (cls ?? defaultClass(data));

  // M.Def starts where it balances M.Atk with a Blessed Spiritshot (x1), so the first numbers show the plain weights
  const magicLevel = Math.max(r?.v[picked]?.[0] ?? 1, 1);
  const mAtk0 = Math.max(magicLevel, 5) * 10;
  const manual = target.kind === "manual";
  const playerLevel = target.level ?? magicLevel;
  const values: TargetValues | null =
    target.kind === "monster"
      ? (monster ?? null)
      : target.kind === "player"
        ? { level: playerLevel, stats: baseStats(data, player), mDef: target.mDef ?? playerMDef(data, player, playerLevel), res: {} }
        : null;
  // a class as the attacker fills in INT and M.Atk; typed values win
  const caster = attacker.cls && data.classes[attacker.cls] ? attacker.cls : (cls ?? defaultClass(data));
  const asClass = attacker.kind === "player";
  const casterLevel = attacker.level ?? magicLevel;
  const weapon = attacker.weapon ?? weaponMAtk(data.slug, casterLevel);
  const casterInt = attacker.int ?? baseStats(data, caster).int;
  const duel: Duel = {
    level: own.level ?? values?.level ?? magicLevel,
    stat: own.stat ?? (r?.s ? (values?.stats[r.s as keyof TargetValues["stats"]] ?? STAT_DEFAULT[r.s]) : 0),
    typeRes: own.typeRes ?? (r?.t && !usesAttributes(data.slug, r) ? values?.res[r.t] : undefined) ?? 0,
    mAtk: asClass ? (attacker.mAtk ?? playerMAtk(data, caster, casterLevel, weapon, casterInt)) : (saved.mAtk ?? mAtk0),
    mDef: own.mDef ?? values?.mDef ?? saved.mDef ?? Math.round(22 * Math.sqrt(mAtk0)),
    int: asClass ? casterInt : saved.int ?? (cls ? baseStats(data, cls).int : 41),
    intAdd: saved.intAdd,
    mAtkPct: saved.mAtkPct,
    mDefPct: saved.mDefPct,
    shot: saved.shot,
    debuffRes: hasDebuffRes(data.slug) ? saved.debuffRes : 0,
    attribute: r && usesAttributes(data.slug, r) ? (own.attribute ?? 0) : 0,
    landBonus: r?.t && hasTraitBonus(data.slug) && !usesAttributes(data.slug, r) ? saved.landBonus : 0,
  };
  // only skills with a target stat and a base rate follow the formula
  const rolls = !!r && !!r.s && inCalc.some((lv) => r.v[lv][2] > 0);

  /** chance columns: shots only matter for magic skills */
  const shots = r?.g ? SHOTS : [duel.shot];

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
          attacker={
            <AttackerPicker
              data={data}
              kind={attacker.kind}
              cls={caster}
              level={casterLevel}
              weapon={weapon}
              stats={baseStats(data, caster)}
              onChoice={(v) => setAttacker((c) => ({ ...c, ...v }))}
            />
          }
          target={
            <TargetPicker
              data={data}
              choice={{ ...target, cls: player }}
              monsters={monsters}
              failed={loaded?.slug === data.slug && !loaded.list}
              monster={monster}
              values={values}
              stat={r.s}
              magic={!!r.g}
              onChoice={(v) => {
                // a new target starts from its own values
                setOwn({});
                setTarget((c) => ({ ...c, ...v }));
              }}
            />
          }
          onOwn={(v) => {
            // level and M.Def of a player are kept with the picked class, so they survive opening another skill
            if (target.kind === "player" && v.level !== undefined) setTarget((c) => ({ ...c, level: v.level }));
            else setOwn((o) => ({ ...o, ...v }));
          }}
          onMDef={(mDef) => {
            if (manual) setSaved((s) => ({ ...s, mDef }));
            else if (target.kind === "player") setTarget((c) => ({ ...c, cls: player, mDef }));
            else setOwn((o) => ({ ...o, mDef }));
          }}
          onMAtk={(mAtk) => (asClass ? setAttacker((c) => ({ ...c, cls: caster, mAtk })) : setSaved((s) => ({ ...s, mAtk })))}
          onInt={(int) => (asClass ? setAttacker((c) => ({ ...c, cls: caster, int, mAtk: undefined })) : setSaved((s) => ({ ...s, int })))}
          onSaved={(v) => setSaved((s) => ({ ...s, ...v }))}
          onReset={() => {
            setOwn({});
            setTarget((c) => ({ ...c, level: undefined, mDef: undefined }));
            setAttacker(({ kind, cls: picked }) => ({ kind, cls: picked }));
            setSaved({ ...SAVED, mAtk: undefined, mDef: undefined, int: undefined });
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
                    {shots.map((s) => (
                      <th key={s} className={r.g && s === duel.shot ? "cur" : ""} title={t("skill.chanceTitle")}>
                        {r.g ? t(`skill.chance_${s}`) : t("skill.chance")}
                      </th>
                    ))}
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
                      {shots.map((s) => (
                        <td key={s} className={`n${r.g && s === duel.shot ? " cur" : ""}`}>
                          <button
                            type="button"
                            className="link"
                            aria-pressed={lv === picked && s === duel.shot}
                            title={t("skill.showInCalc")}
                            onClick={() => {
                              setPicked(lv);
                              if (r.g) setSaved((v) => ({ ...v, shot: s }));
                            }}
                          >
                            {r.v[lv][2] > 0 ? `${fmt1(finalChance(data.slug, r, lv, { ...duel, shot: s }))}%` : "100%"}
                          </button>
                        </td>
                      ))}
                    </>
                  ) : (
                    <td colSpan={2 + shots.length}>—</td>
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
