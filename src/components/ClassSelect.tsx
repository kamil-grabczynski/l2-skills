import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ChronicleData } from "../types";
import { chainOf, depthOf, raceKey, raceLabel, raceRank, tierLabel } from "../lib/data";
import type { Stats } from "../lib/target";

interface Props {
  data: ChronicleData;
  cls: string;
  onPick: (cls: string) => void;
}

/** Race, then class of that race. */
export function ClassSelect({ data, cls, onPick }: Props) {
  const { t } = useTranslation();
  const races = useMemo(
    () => [...new Set(Object.values(data.classes).map((c) => c.race))].sort((a, b) => raceRank(a) - raceRank(b)),
    [data],
  );
  const race = data.classes[cls].race;
  const classes = Object.keys(data.classes)
    .filter((c) => data.classes[c].race === race)
    .sort((a, b) => depthOf(data, a) - depthOf(data, b) || data.classes[a].name.localeCompare(data.classes[b].name));
  const depths = [...new Set(classes.map((c) => depthOf(data, c)))];

  return (
    <>
      <label className="num-field">
        <span>{t("picker.race")}</span>
        <select
          value={raceKey(race)}
          onChange={(e) => {
            const next = races.find((r) => raceKey(r) === e.target.value)!;
            // keep fighter/mystic when the race changes
            const mystic = chainOf(data, cls)[0].includes("mage");
            const roots = Object.keys(data.classes).filter((c) => data.classes[c].race === next && !data.classes[c].parent);
            onPick(roots.find((c) => c.includes("mage") === mystic) ?? roots[0]);
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
        <select value={cls} onChange={(e) => onPick(e.target.value)}>
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
    </>
  );
}

/** STR 40 · DEX 30 · …, the stat that matters in bold. */
export function StatLine({ stats, used }: { stats: Stats; used: string }) {
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
