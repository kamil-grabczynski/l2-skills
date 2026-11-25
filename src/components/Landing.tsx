import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { Resist } from "../types";
import { chronicleLabel } from "../lib/data";
import { fmt, fmt1, fmt2 } from "../lib/format";
import {
  MEN_MDEF, SHOT, caps, finalChance, finalMAtk, formulaKnown, hasDebuffRes, hasTraitBonus, intBonus, landChance,
  shortensDebuffs, traitLabel, usesAttributes, type Duel, type Shot,
} from "../lib/debuff";
import type { SavedDuel } from "./SkillPage";
import { NumberField } from "./NumberField";

const SOURCE = "https://l2s.userecho.ru/communities/1/topics/3014-nemnogo-redkoj-informatsii-pro-mehaniku-la2";
/** attribute advantage -> bonus to the chance */
const INT_DATA = "https://github.com/master-toma/l2datapack/blob/master/script/PcParameters/stat_bonus/int_bonus.pcparams";
const SHOTS = Object.keys(SHOT) as Shot[];
/** rows of the INT table: dyes raise a stat by at most 5 */
const INT_ROWS = [0, 1, 2, 3, 4, 5];
const ATTRIBUTE = [[40, 0.2], [150, 0.4], [300, 0.7]] as const;

interface Props {
  slug: string;
  r: Resist;
  lv: number;
  levels: number[];
  duel: Duel;
  /** choice of the attacker (magic skills) and of the target */
  attacker: ReactNode;
  target: ReactNode;
  onLevel: (lv: number) => void;
  onOwn: (v: Partial<Duel>) => void;
  onMDef: (mDef: number) => void;
  onMAtk: (mAtk: number) => void;
  onInt: (int: number) => void;
  onSaved: (v: Partial<SavedDuel>) => void;
  onReset: () => void;
}

/** One factor and how many percentage points it changes the chance by. */
function Factor({ name, note, change, pp }: { name: ReactNode; note?: string; change: string; pp: number }) {
  const v = Math.abs(pp) < 0.05 ? 0 : pp;
  return (
    <tr>
      <td>
        <b>{name}</b>
        {note && <small>{note}</small>}
      </td>
      <td>{change}</td>
      <td className={`n pp ${v > 0 ? "plus" : v < 0 ? "minus" : ""}`}>
        {v > 0 ? "+" : v < 0 ? "−" : ""}
        {fmt1(Math.abs(v))} pp
      </td>
    </tr>
  );
}

/** Calculator of the land chance and the influence of every factor. */
export function Landing({ slug, r, lv, levels, duel, attacker, target, onLevel, onOwn, onMDef, onMAtk, onInt, onSaved, onReset }: Props) {
  const { t } = useTranslation();
  const [magicLevel, lvBonus, rate] = r.v[lv];
  const STAT = r.s.toUpperCase();
  const now = landChance(r, lv, duel);
  const chance = finalChance(slug, r, lv, duel);
  const immune = now.res === 0;
  const [min, max] = caps(slug);
  /** change of the uncapped chance between two sets of inputs */
  const diff = (to: Partial<Duel>, from: Partial<Duel> = {}) =>
    landChance(r, lv, { ...duel, ...to }).raw - landChance(r, lv, { ...duel, ...from }).raw;
  const free = magicLevel + 3;
  const perLevel = lvBonus * now.magic * now.res * now.bonus;
  const attributes = usesAttributes(slug, r);
  const trait = hasTraitBonus(slug) && !!r.t && !attributes;
  const chanceAt = (d: Partial<Duel>) => finalChance(slug, r, lv, { ...duel, ...d });
  const totalInt = duel.int + duel.intAdd;
  const perInt = (intBonus(totalInt + 1) / intBonus(totalInt)) ** 2;
  const shotLabel = (s: Shot) => (s === "none" ? t("skill.chance_none") : s === "ss" ? "Spiritshot" : "Blessed Spiritshot");

  return (
    <section className="panel sk-block">
      <h3>{t("landing.title")}</h3>
      <p className="sk-formula">
        <Trans t={t} i18nKey="landing.formulaBase" values={{ rate, stat: STAT, value: duel.stat }} components={{ b: <b /> }} />
        {lvBonus > 0 && (
          <>
            {" "}
            <Trans t={t} i18nKey="landing.formulaPenalty" values={{ penalty: fmt1(now.penalty) }} components={{ b: <b /> }} />
          </>
        )}
        )
        {!!r.g && (
          <>
            {" "}
            <Trans t={t} i18nKey="landing.formulaMagic" values={{ factor: fmt2(now.magic) }} components={{ b: <b /> }} />
          </>
        )}
        {now.res !== 1 && (
          <>
            {" "}
            <Trans t={t} i18nKey="landing.formulaRes" values={{ factor: fmt2(now.res) }} components={{ b: <b /> }} />
          </>
        )}
        {now.bonus !== 1 && (
          <>
            {" "}
            <Trans t={t} i18nKey="landing.formulaBonus" values={{ factor: fmt2(now.bonus) }} components={{ b: <b /> }} />
          </>
        )}
      </p>
      <div className="sk-calc">
        <div className="sk-sides">
          <div className="sk-side">
            <div className="sk-side-head">
              <span className="label">{t("landing.attacker")}</span>
              {!!r.g && attacker}
              <button type="button" className="sk-reset" onClick={onReset}>
                {t("landing.reset")}
              </button>
            </div>
            <div className="sk-inputs">
              {levels.length > 1 && (
                <label className="num-field">
                  <span>{t("landing.skillLevel")}</span>
                  <select value={lv} onChange={(e) => onLevel(Number(e.target.value))}>
                    {levels.map((x) => (
                      <option key={x} value={x}>
                        Lv {x}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!!r.g && (
                <>
                  <NumberField label={t("landing.yourMAtk")} value={duel.mAtk} min={1} max={50000} onChange={onMAtk} />
                  <NumberField label={t("landing.yourInt")} value={duel.int} min={1} max={99} onChange={onInt} />
                  <NumberField label={t("landing.intAdd")} value={duel.intAdd} min={-20} max={40} onChange={(intAdd) => onSaved({ intAdd })} />
                  <NumberField label={t("landing.mAtkPct")} value={duel.mAtkPct} min={-90} max={500} suffix="%" onChange={(mAtkPct) => onSaved({ mAtkPct })} />
                  <label className="num-field">
                    <span>{t("landing.shots")}</span>
                    <select value={duel.shot} onChange={(e) => onSaved({ shot: e.target.value as Shot })}>
                      {SHOTS.map((s) => (
                        <option key={s} value={s}>
                          {shotLabel(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {trait && (
                <NumberField
                  label={t("landing.landBonus", { trait: traitLabel(r.t) })}
                  value={duel.landBonus}
                  min={-100}
                  max={200}
                  suffix="%"
                  onChange={(landBonus) => onSaved({ landBonus })}
                />
              )}
              {attributes && (
                <NumberField label={t("landing.attributeAdvantage")} value={duel.attribute} min={-600} max={1000} onChange={(attribute) => onOwn({ attribute })} />
              )}
            </div>
          </div>
          <div className="sk-side">
            {target}
            <div className="sk-inputs">
              <NumberField label={t("landing.targetLevel")} value={duel.level} min={1} max={99} onChange={(level) => onOwn({ level })} />
              <NumberField label={t("landing.targetStat", { stat: STAT })} value={duel.stat} min={1} max={150} onChange={(stat) => onOwn({ stat })} />
              {!!r.g && (
                <>
                  <NumberField label={t("landing.targetMDef")} value={duel.mDef} min={1} max={20000} onChange={onMDef} />
                  <NumberField label={t("landing.mDefPct")} value={duel.mDefPct} min={-90} max={500} suffix="%" onChange={(mDefPct) => onSaved({ mDefPct })} />
                </>
              )}
              {r.t && !attributes && (
                <NumberField
                  label={t("landing.resistance", { trait: traitLabel(r.t) })}
                  value={duel.typeRes}
                  min={-200}
                  max={100}
                  suffix="%"
                  onChange={(typeRes) => onOwn({ typeRes })}
                />
              )}
              {hasDebuffRes(slug) && (
                <NumberField
                  label={t("landing.debuffRes")}
                  value={duel.debuffRes}
                  min={-100}
                  max={100}
                  suffix="%"
                  onChange={(debuffRes) => onSaved({ debuffRes })}
                />
              )}
            </div>
          </div>
        </div>
        <div className="stat big sk-chance">
          <span>{t("landing.chance", { lv })}</span>
          <strong>{fmt1(chance)}%</strong>
          {immune && <small>{t("landing.immune")}</small>}
          {!immune && Math.abs(now.raw - chance) >= 0.05 && (
            <small>{t("landing.capped", { raw: fmt1(now.raw), cap: now.raw > chance ? max : min })}</small>
          )}
          {!!r.g && (
            <>
              <small>{t("landing.mAtkAfter", { mAtk: fmt(Math.round(finalMAtk(duel))) })}</small>
              <div className="sk-shots" role="group" aria-label={t("landing.shots")}>
                {SHOTS.map((s) => (
                  <button type="button" key={s} aria-pressed={s === duel.shot} onClick={() => onSaved({ shot: s })}>
                    {shotLabel(s)}
                    <b>{fmt1(chanceAt({ shot: s }))}%</b>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="sk-scroll">
        <table className="sk-factors">
          <thead>
            <tr>
              <th>{t("landing.factor")}</th>
              <th>{t("landing.change")}</th>
              <th>{t("landing.impact")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="grp">
              <th colSpan={3}>{t("landing.defender")}</th>
            </tr>
            <Factor
              name={STAT}
              note={r.g && r.s === "men" ? t("landing.menNote") : undefined}
              change={`+1 ${STAT}`}
              pp={diff({ stat: duel.stat + 1, mDef: r.s === "men" ? duel.mDef * MEN_MDEF : duel.mDef })}
            />
            {!!r.g && (
              <>
                {r.s !== "men" && (
                  <Factor name="MEN" note={t("landing.onlyMDef")} change="+1 MEN = M.Def +1%" pp={diff({ mDef: duel.mDef * MEN_MDEF })} />
                )}
                <Factor name="M.Def" change="+10%" pp={diff({ mDef: duel.mDef * 1.1 })} />
              </>
            )}
            <Factor
              name={t("landing.levelDiff")}
              note={
                lvBonus > 0
                  ? t("landing.levelDiffNote", { magicLevel, free })
                  : t("landing.levelDiffNone")
              }
              change={lvBonus > 0 ? t("landing.levelDiffChange", { free }) : "—"}
              pp={-perLevel}
            />
            {r.t && !attributes && (
              <Factor name={t("landing.resistance", { trait: traitLabel(r.t) })} change="+10%" pp={diff({ typeRes: duel.typeRes + 10 })} />
            )}
            {hasDebuffRes(slug) && (
              <Factor
                name={t("landing.generalRes")}
                note={shortensDebuffs(slug) ? t("landing.generalResNote") : undefined}
                change="+10%"
                pp={diff({ debuffRes: duel.debuffRes + 10 })}
              />
            )}
            <tr className="grp">
              <th colSpan={3}>{t("landing.attacker")}</th>
            </tr>
            {!!r.g && (
              <>
                <Factor name="Spiritshot" change={t("landing.ssChange", { factor: fmt2(Math.SQRT2) })} pp={diff({ shot: "ss" }, { shot: "none" })} />
                <Factor name="Blessed Spiritshot" change={t("landing.bssChange")} pp={diff({ shot: "bss" }, { shot: "none" })} />
                <Factor name="M.Atk" note={t("landing.underRoot")} change="+10%" pp={diff({ mAtk: duel.mAtk * 1.1 })} />
                <Factor
                  name="INT"
                  note={t("landing.onlyMAtk")}
                  change={t("landing.intChange", { from: totalInt, to: totalInt + 1, percent: fmt1((perInt - 1) * 100) })}
                  pp={diff({ mAtk: duel.mAtk * perInt })}
                />
              </>
            )}
            <Factor
              name={t("landing.skillLevel")}
              note={lvBonus > 0 ? t("landing.skillLevelNote", { free }) : t("landing.skillLevelNone")}
              change={lvBonus > 0 ? t("landing.skillLevelChange") : "—"}
              pp={duel.level > free ? perLevel : 0}
            />
            {trait && (
              <Factor
                name={t("landing.landBonus", { trait: traitLabel(r.t) })}
                note={t("landing.landBonusNote")}
                change="+10%"
                pp={diff({ landBonus: duel.landBonus + 10 })}
              />
            )}
            {attributes &&
              ATTRIBUTE.map(([from, bonus], i) => (
                <Factor
                  key={from}
                  name={t("landing.attribute", { trait: traitLabel(r.t) })}
                  note={i ? undefined : t("landing.attributeNote")}
                  change={t("landing.attributeChange", { from, factor: fmt2(1 + bonus) })}
                  pp={diff({ attribute: from }, { attribute: 0 })}
                />
              ))}
          </tbody>
        </table>
      </div>
      {!!r.g && (
        <div className="sk-int">
          <h4>{t("landing.intTitle")}</h4>
          <p>
            <Trans
              t={t}
              i18nKey="landing.intText"
              values={{ int: duel.int, bonus: fmt2(intBonus(duel.int)) }}
              components={{ b: <b />, source: <a href={INT_DATA} target="_blank" rel="noreferrer" /> }}
            />
          </p>
          <div className="sk-scroll">
            <table className="sk-factors">
              <thead>
                <tr>
                  <th>{t("landing.intTotal")}</th>
                  <th>{t("landing.intMultiplier")}</th>
                  <th>M.Atk</th>
                  {SHOTS.map((s) => (
                    <th key={s}>{shotLabel(s)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INT_ROWS.map((add) => (
                  <tr key={add} className={add === duel.intAdd ? "on" : ""}>
                    <td>
                      <b>{duel.int + add}</b>
                      {add > 0 && ` (+${add})`}
                    </td>
                    <td className="n">×{fmt2(intBonus(duel.int + add))}</td>
                    <td className="n">{fmt(Math.round(finalMAtk({ ...duel, intAdd: add })))}</td>
                    {SHOTS.map((s) => (
                      <td key={s} className="n">
                        {fmt1(chanceAt({ intAdd: add, shot: s }))}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ul className="sk-notes">
        <li>
          {t("landing.notePp")} {r.g ? t("landing.noteStartMagic") : t("landing.noteStart")}{" "}
          {min > 0 ? t("landing.noteCapRange", { min, max }) : t("landing.noteCapMax", { max })}
        </li>
        <li>{r.g ? t("landing.noteIgnoredMagic") : t("landing.noteIgnoredPhysical")}</li>
        <li>
          {r.t
            ? t("landing.noteDataTrait", { stat: STAT, rate, bonus: fmt(lvBonus), trait: traitLabel(r.t), magicLevel })
            : t("landing.noteData", { stat: STAT, rate, bonus: fmt(lvBonus), magicLevel })}{" "}
          <Trans
            t={t}
            i18nKey={formulaKnown(slug) ? "landing.noteFormulaKnown" : "landing.noteFormulaUnknown"}
            values={{ chronicle: chronicleLabel(slug) }}
            components={{ source: <a href={SOURCE} target="_blank" rel="noreferrer" /> }}
          />
        </li>
      </ul>
    </section>
  );
}
