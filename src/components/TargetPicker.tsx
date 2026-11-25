import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ChronicleData } from "../types";
import { chainOf, depthOf, raceKey, raceLabel, raceRank, tierLabel } from "../lib/data";
import { fmt, fmt1 } from "../lib/format";
import { traitLabel } from "../lib/debuff";
import { searchMonsters, type Monster, type Stats, type TargetChoice, type TargetValues } from "../lib/target";
import { Combobox } from "./Combobox";

const KINDS = ["manual", "monster", "player"] as const;

interface Props {
  data: ChronicleData;
  choice: TargetChoice;
  /** monsters of the chronicle, null while loading or when not needed */
  monsters: Monster[] | null;
  failed: boolean;
  /** the picked monster in this chronicle */
  monster: Monster | undefined;
  /** values of the picked monster or class */
  values: TargetValues | null;
  /** stat the skill is resisted with */
  stat: string;
  /** magic skills also depend on M.Def */
  magic: boolean;
  onChoice: (v: Partial<TargetChoice>) => void;
}

/** Who the debuff is cast on: typed values, a monster of the chronicle or a player class. */
export function TargetPicker({ data, choice, monsters, failed, monster, values, stat, magic, onChoice }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <div className="sk-side-head">
        <span className="label">{t("target.title")}</span>
        <div className="seg" role="group" aria-label={t("target.title")}>
          {KINDS.map((k) => (
            <button type="button" key={k} aria-pressed={choice.kind === k} onClick={() => onChoice({ kind: k })}>
              {t(`target.${k}`)}
            </button>
          ))}
        </div>
      </div>
      {choice.kind === "monster" && (
        <>
          {failed ? (
            <p className="hint">{t("target.failed")}</p>
          ) : !monsters ? (
            <p className="hint">{t("target.loading")}</p>
          ) : (
            <MonsterSearch key={data.slug} monsters={monsters} monster={monster} onPick={(m) => onChoice({ monster: { name: m.name, level: m.level, mDef: m.mDef } })} />
          )}
          {monsters && choice.monster && !monster && (
            <p className="hint">{t("target.missing", { name: choice.monster.name, chronicle: data.name })}</p>
          )}
        </>
      )}
      {choice.kind === "player" && <PlayerSelect data={data} choice={choice} onChoice={onChoice} />}
      {values && (
        <p className="sk-target-info">
          {choice.kind === "monster" && monster && (
            <>
              <b>{monster.name}</b>
              {monster.boss && <span className="tag">{t("target.boss")}</span>} Lv {monster.level} · M.Def {fmt(monster.mDef)} ·{" "}
            </>
          )}
          <StatLine stats={values.stats} used={stat} />
          {Object.entries(values.res).map(([trait, v]) => (
            <span key={trait}>
              {" "}
              · {traitLabel(trait)} {v > 0 ? "+" : "−"}
              {fmt1(Math.abs(v))}%
            </span>
          ))}
          {choice.kind === "player" && (
            <small>
              {t("target.playerHint")} {magic && t("target.mDefHint")}
            </small>
          )}
          {choice.kind === "monster" && <small>{t("target.monsterHint", { chronicle: data.name })}</small>}
        </p>
      )}
    </>
  );
}

function StatLine({ stats, used }: { stats: Stats; used: string }) {
  return (
    <>
      {Object.entries(stats).map(([k, v], i) => (
        <span key={k}>
          {i > 0 && " · "}
          {k === used ? (
            <b>
              {k.toUpperCase()} {v}
            </b>
          ) : (
            `${k.toUpperCase()} ${v}`
          )}
        </span>
      ))}
    </>
  );
}

interface SearchProps {
  monsters: Monster[];
  monster: Monster | undefined;
  onPick: (m: Monster) => void;
}

function MonsterSearch({ monsters, monster, onPick }: SearchProps) {
  const { t } = useTranslation();
  const search = useCallback((query: string, limit: number) => searchMonsters(monsters, query, limit), [monsters]);
  return (
    <Combobox
      label={t("target.search")}
      placeholder={monster ? `${monster.name} (Lv ${monster.level})` : t("target.searchHint", { n: fmt(monsters.length) })}
      search={search}
      itemKey={(m) => monsters.indexOf(m)}
      empty={(query) => t("target.noMatch", { query })}
      onPick={onPick}
      render={(m) => (
        <>
          <span>
            {m.name}
            {m.boss && <span className="tag">{t("target.boss")}</span>}
          </span>
          <small>
            Lv {m.level} · M.Def {fmt(m.mDef)}
          </small>
        </>
      )}
    />
  );
}

interface PlayerProps {
  data: ChronicleData;
  choice: TargetChoice;
  onChoice: (v: Partial<TargetChoice>) => void;
}

/** Race, then class. The level and M.Def are fields of the calculator below. */
function PlayerSelect({ data, choice, onChoice }: PlayerProps) {
  const { t } = useTranslation();
  const races = useMemo(
    () => [...new Set(Object.values(data.classes).map((c) => c.race))].sort((a, b) => raceRank(a) - raceRank(b)),
    [data],
  );
  const cls = choice.cls && data.classes[choice.cls] ? choice.cls : null;
  const race = cls ? data.classes[cls].race : races[0];
  const classes = Object.keys(data.classes)
    .filter((c) => data.classes[c].race === race)
    .sort((a, b) => depthOf(data, a) - depthOf(data, b) || data.classes[a].name.localeCompare(data.classes[b].name));
  const depths = [...new Set(classes.map((c) => depthOf(data, c)))];
  // a new class starts from its own M.Def
  const pick = (c: string) => onChoice({ cls: c, mDef: undefined });

  return (
    <div className="sk-target-row">
      <label className="num-field">
        <span>{t("picker.race")}</span>
        <select
          value={raceKey(race)}
          onChange={(e) => {
            const next = races.find((r) => raceKey(r) === e.target.value)!;
            // keep fighter/mystic when the race changes
            const mystic = cls ? chainOf(data, cls)[0].includes("mage") : false;
            const roots = Object.keys(data.classes).filter((c) => data.classes[c].race === next && !data.classes[c].parent);
            pick(roots.find((c) => c.includes("mage") === mystic) ?? roots[0]);
          }}
        >
          {races.map((r) => (
            <option key={r} value={raceKey(r)}>
              {raceLabel(r)}
            </option>
          ))}
        </select>
      </label>
      <label className="num-field">
        <span>{t("target.class")}</span>
        <select value={cls ?? ""} onChange={(e) => pick(e.target.value)}>
          {!cls && <option value="">—</option>}
          {depths.map((d) => (
            <optgroup key={d} label={tierLabel(d)}>
              {classes
                .filter((c) => depthOf(data, c) === d)
                .map((c) => (
                  <option key={c} value={c}>
                    {data.classes[c].name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  );
}
