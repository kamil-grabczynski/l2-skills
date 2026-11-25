import { useMemo, useState, type ReactNode } from "react";
import type { ChronicleData, SkillInfo } from "../types";
import { chronicleLabel } from "../lib/data";
import { hrefFor } from "../lib/route";
import { fmt, fmt1, skillMeta } from "../lib/format";
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
  const sk = data.skills[id];
  const back = (
    <a className="back" href={hrefFor(data.slug, cls)}>
      ← {cls ? data.classes[cls].name : "Wybór klasy"}
    </a>
  );
  if (!sk) {
    return (
      <main className="skill-page">
        {back}
        <section className="panel sk-block">
          <h2>Tego skila nie ma w {chronicleLabel(data.slug)}</h2>
          <p className="hint">Wybierz inną kronikę albo wróć do listy.</p>
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
            <span className={`tag ${sk.p ? "p" : "a"}`}>{sk.p ? "pasywny" : "aktywny"}</span>
            {r && <span className="tag">debuff</span>}
            {r && <span className="tag">{r.g ? "magiczny" : "fizyczny"}</span>}
            <span className="lvl-meta">
              {chronicleLabel(data.slug)} · {levels.length === 1 ? "1 poziom" : `poziomy ${levels[0]}–${levels[levels.length - 1]}`}
              {learn.size === 0 && " · żadna klasa nie uczy się go w tej kronice"}
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
          <h3>Od czego zależy wejście</h3>
          <p>
            Efekt natychmiastowy. Dane serwera podają najwyżej stałą szansę (kolumna „Co daje”), bez statystyki obrońcy,
            mnożnika poziomu i M.Atk.
          </p>
        </section>
      )}

      <section className="panel sk-block">
        <h3>Poziomy skila</h3>
        <div className="sk-scroll">
          <table className="sk-levels">
            <thead>
              <tr>
                <th>Lv</th>
                <th>Nauka</th>
                <th>Co daje</th>
                {rolls && (
                  <>
                    <th title="Szansa bazowa z danych serwera">Baza</th>
                    <th title="Poziom skila porównywany z poziomem celu">Poz. mag.</th>
                    <th title="Dla wartości wpisanych w kalkulatorze">Szansa</th>
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
                        <b>poziom {x.l}</b> · {fmt(x.sp)} SP
                        <small>{x.classes.join(", ")}</small>
                        {x.book > 0 && <span className="tag book">{data.books[x.book] ?? `item ${x.book}`}</span>}
                      </div>
                    )) ?? "—"}
                  </td>
                  <td className="desc">
                    {sk.d[lv]}
                    {sk.e?.[lv] && <div className="effect">{sk.e[lv]}</div>}
                    {sk.m?.[lv] && <div className="usage">{skillMeta(sk.m[lv])}</div>}
                  </td>
                  {rolls && (r.v[lv] ? (
                    <>
                      <td className="n">{r.v[lv][2] > 0 ? `${r.v[lv][2]}%` : "zawsze"}</td>
                      <td className="n">{r.v[lv][0]}</td>
                      <td className="n">
                        <button type="button" className="link" aria-pressed={lv === picked} title="Pokaż w kalkulatorze" onClick={() => setPicked(lv)}>
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
  return (
    <section className="panel sk-block">
      <h3>Od czego zależy wejście</h3>
      <p>
        {rate < 0
          ? "Efekt wchodzi zawsze: serwer nie losuje szansy, więc statystyki, M.Atk, shoty i poziom nie mają znaczenia."
          : `Dane serwera nie podają statystyki, którą cel się broni. Wpisana szansa to ${rate}%; nie wiadomo, czy poziom i M.Atk ją zmieniają.`}
      </p>
    </section>
  );
}

/** Cancel and Bane skills roll separately for every buff of the target. */
function Dispel({ x }: { x: NonNullable<SkillInfo["x"]> }) {
  const [lo, hi] = x.k === "bane" ? [40, 95] : [25, 75];
  return (
    <section className="panel sk-block">
      <h3>Zdejmowanie buffów</h3>
      <p className="sk-formula">Szansa na buff = baza + 2 × (poziom skila − poziom buffa) + czas buffa w sekundach ÷ 120</p>
      <table className="sk-factors">
        <tbody>
          <tr>
            <td>Poziom buffa wyższy o 1</td>
            <td className="n pp minus">−2 pp</td>
          </tr>
          <tr>
            <td>Buff dłuższy o 2 minuty</td>
            <td className="n pp plus">+1 pp</td>
          </tr>
          <tr>
            <td>Odporność na zdejmowanie buffów +10%</td>
            <td className="n">wynik × 0,9</td>
          </tr>
          {Object.entries(x.v).map(([lv, [ml, rate]]) => (
            <tr key={lv}>
              <td>
                Lv {lv}: poziom magiczny {ml}
              </td>
              <td className="n">baza {rate}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="sk-notes">
        <li>
          Wynik mieści się zawsze w {lo}–{hi}% i jest losowany osobno dla każdego buffa. M.Atk, M.Def i shoty nie mają znaczenia.
        </li>
        <li>
          Baza i poziomy magiczne to dane serwera tej kroniki. Wzór i limity opisano dla Gracia–Freya, inne kroniki mogły się różnić.
        </li>
      </ul>
    </section>
  );
}
