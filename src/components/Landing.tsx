import type { ReactNode } from "react";
import type { Resist } from "../types";
import { chronicleLabel } from "../lib/data";
import { fmt1, fmt2 } from "../lib/format";
import {
  INT_SQRT_MATK, MEN_MDEF, caps, clampChance, formulaKnown, hasDebuffRes, hasTraitBonus, landChance, shortensDebuffs,
  traitLabel, usesAttributes, type Duel, type Shot,
} from "../lib/debuff";
import type { SavedDuel } from "./SkillPage";
import { NumberField } from "./NumberField";

const SOURCE = "https://l2s.userecho.ru/communities/1/topics/3014-nemnogo-redkoj-informatsii-pro-mehaniku-la2";
/** target attribute advantage -> bonus to the chance */
const ATTRIBUTE = [[40, 0.2], [150, 0.4], [300, 0.7]] as const;

interface Props {
  slug: string;
  r: Resist;
  lv: number;
  levels: number[];
  duel: Duel;
  onLevel: (lv: number) => void;
  onOwn: (v: Partial<Duel>) => void;
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
export function Landing({ slug, r, lv, levels, duel, onLevel, onOwn, onSaved, onReset }: Props) {
  const [magicLevel, lvBonus, rate] = r.v[lv];
  const STAT = r.s.toUpperCase();
  const now = landChance(r, lv, duel);
  const chance = clampChance(slug, now.raw);
  const [min, max] = caps(slug);
  /** change of the uncapped chance between two sets of inputs */
  const diff = (to: Partial<Duel>, from: Partial<Duel> = {}) =>
    landChance(r, lv, { ...duel, ...to }).raw - landChance(r, lv, { ...duel, ...from }).raw;
  const free = magicLevel + 3;
  const perLevel = lvBonus * now.magic * now.res;
  const attributes = usesAttributes(slug, r);

  return (
    <section className="panel sk-block">
      <h3>Od czego zależy wejście</h3>
      <p className="sk-formula">
        Szansa = (30 + baza <b>{rate}</b> − {STAT} celu <b>{duel.stat}</b>
        {lvBonus > 0 && (
          <>
            {" "}
            − kara za poziom <b>{fmt1(now.penalty)}</b>
          </>
        )}
        )
        {!!r.g && (
          <>
            {" "}
            × 11 × √(M.Atk × shot) ÷ M.Def <b>(×{fmt2(now.magic)})</b>
          </>
        )}
        {now.res !== 1 && (
          <>
            {" "}
            × odporności <b>(×{fmt2(now.res)})</b>
          </>
        )}
      </p>
      <div className="sk-calc">
        <div className="sk-inputs">
          {levels.length > 1 && (
            <label className="num-field">
              <span>Poziom skila</span>
              <select value={lv} onChange={(e) => onLevel(Number(e.target.value))}>
                {levels.map((x) => (
                  <option key={x} value={x}>
                    Lv {x}
                  </option>
                ))}
              </select>
            </label>
          )}
          <NumberField label="Poziom celu" value={duel.level} min={1} max={99} onChange={(level) => onOwn({ level })} />
          <NumberField label={`${STAT} celu`} value={duel.stat} min={1} max={150} onChange={(stat) => onOwn({ stat })} />
          {!!r.g && (
            <>
              <NumberField label="Twój M.Atk" value={duel.mAtk} min={1} max={50000} onChange={(mAtk) => onSaved({ mAtk })} />
              <NumberField label="M.Def celu" value={duel.mDef} min={1} max={20000} onChange={(mDef) => onSaved({ mDef })} />
              <label className="num-field">
                <span>Shoty</span>
                <select value={duel.shot} onChange={(e) => onSaved({ shot: e.target.value as Shot })}>
                  <option value="none">brak</option>
                  <option value="ss">Spiritshot</option>
                  <option value="bss">Blessed Spiritshot</option>
                </select>
              </label>
            </>
          )}
          {r.t && !attributes && (
            <NumberField
              label={`Odporność: ${traitLabel(r.t)}`}
              value={duel.typeRes}
              min={-100}
              max={100}
              suffix="%"
              onChange={(typeRes) => onOwn({ typeRes })}
            />
          )}
          {hasDebuffRes(slug) && (
            <NumberField
              label="Odporność na debuffy"
              value={duel.debuffRes}
              min={-100}
              max={100}
              suffix="%"
              onChange={(debuffRes) => onSaved({ debuffRes })}
            />
          )}
          <button type="button" className="sk-reset" onClick={onReset}>
            Wartości startowe
          </button>
        </div>
        <div className="stat big sk-chance">
          <span>Szansa wejścia, Lv {lv}</span>
          <strong>{fmt1(chance)}%</strong>
          {Math.abs(now.raw - chance) >= 0.05 && (
            <small>
              z wzoru {fmt1(now.raw)}%, limit {now.raw > chance ? max : min}%
            </small>
          )}
        </div>
      </div>

      <div className="sk-scroll">
        <table className="sk-factors">
          <thead>
            <tr>
              <th>Czynnik</th>
              <th>Zmiana</th>
              <th>Wpływ na szansę</th>
            </tr>
          </thead>
          <tbody>
            <tr className="grp">
              <th colSpan={3}>Obrońca</th>
            </tr>
            <Factor
              name={STAT}
              note={r.g && r.s === "men" ? "wprost i przez M.Def" : undefined}
              change={`+1 ${STAT}`}
              pp={diff({ stat: duel.stat + 1, mDef: r.s === "men" ? duel.mDef * MEN_MDEF : duel.mDef })}
            />
            {!!r.g && (
              <>
                {r.s !== "men" && (
                  <Factor name="MEN" note="tylko przez M.Def" change="+1 MEN = M.Def +1%" pp={diff({ mDef: duel.mDef * MEN_MDEF })} />
                )}
                <Factor name="M.Def" change="+10%" pp={diff({ mDef: duel.mDef * 1.1 })} />
              </>
            )}
            <Factor
              name="Różnica poziomów"
              note={
                lvBonus > 0
                  ? `liczy się poziom skila (${magicLevel}), nie postaci; cel do poziomu ${free} bez kary, niższy nie daje premii`
                  : "ten skill nie zależy od poziomu celu"
              }
              change={lvBonus > 0 ? `każdy poziom celu ponad ${free}` : "—"}
              pp={-perLevel}
            />
            {r.t && !attributes && (
              <Factor name={`Odporność: ${traitLabel(r.t)}`} change="+10%" pp={diff({ typeRes: duel.typeRes + 10 })} />
            )}
            {hasDebuffRes(slug) && (
              <Factor
                name="Ogólna odporność na debuffy"
                note={shortensDebuffs(slug) ? "odporności mogą też skrócić czas działania" : undefined}
                change="+10%"
                pp={diff({ debuffRes: duel.debuffRes + 10 })}
              />
            )}
            <tr className="grp">
              <th colSpan={3}>Atakujący</th>
            </tr>
            {!!r.g && (
              <>
                <Factor name="Spiritshot" change="brak → Spiritshot (×1,41)" pp={diff({ shot: "ss" }, { shot: "none" })} />
                <Factor name="Blessed Spiritshot" change="brak → Blessed (×2)" pp={diff({ shot: "bss" }, { shot: "none" })} />
                <Factor name="M.Atk" note="pod pierwiastkiem" change="+10%" pp={diff({ mAtk: duel.mAtk * 1.1 })} />
                <Factor
                  name="INT"
                  note="tylko przez M.Atk"
                  change="+1 INT = M.Atk +4%"
                  pp={diff({ mAtk: duel.mAtk * INT_SQRT_MATK ** 2 })}
                />
              </>
            )}
            <Factor
              name="Poziom skila"
              note={lvBonus > 0 ? `pomaga tylko na cel powyżej poziomu ${free}` : "ten skill nie zależy od poziomu"}
              change={lvBonus > 0 ? "+1 poziom magiczny" : "—"}
              pp={duel.level > free ? perLevel : 0}
            />
            {hasTraitBonus(slug) && r.t && !attributes && (
              <Factor name={`Bonus do wejścia: ${traitLabel(r.t)}`} note="np. biżuteria z bossów" change="+10%" pp={now.raw * 0.1} />
            )}
            {attributes &&
              ATTRIBUTE.map(([from, bonus], i) => (
                <Factor
                  key={from}
                  name={`Atrybut: ${traitLabel(r.t)}`}
                  note={i ? undefined : "atrybut broni i skila minus obrona celu; tylko gdy broń ma ten sam atrybut"}
                  change={`przewaga od ${from} (×${fmt2(1 + bonus)})`}
                  pp={now.raw * bonus}
                />
              ))}
          </tbody>
        </table>
      </div>
      <ul className="sk-notes">
        <li>
          pp to punkty procentowe dla wartości wpisanych wyżej, liczone przed limitem.
          {r.g ? " Startowe M.Atk i M.Def są przykładowe: z Blessed Spiritshotem dają mnożnik ×1." : " Startowe wartości są przykładowe."} Limit szansy:{" "}
          {min > 0 ? `od ${min}% do ${max}%` : `najwyżej ${max}%`}.
        </li>
        <li>
          {r.g
            ? "Soulshoty, P.Atk, WIT i poziom postaci atakującego nie wchodzą do wzoru."
            : "Skill fizyczny: M.Atk, M.Def, spiritshoty, soulshoty i P.Atk nie zmieniają szansy na debuff."}
        </li>
        <li>
          {STAT}, baza {rate}%, mnożnik poziomu {lvBonus}
          {r.t ? `, typ „${traitLabel(r.t)}”` : ""} i poziom magiczny {magicLevel} to dane serwera tej kroniki. Sam wzór jest{" "}
          <a href={SOURCE} target="_blank" rel="noreferrer">
            opisany dla Gracia–High Five
          </a>
          {formulaKnown(slug)
            ? "."
            : `; dla ${chronicleLabel(slug)} nie ma publicznego potwierdzenia, więc procenty są przybliżone.`}
        </li>
      </ul>
    </section>
  );
}
