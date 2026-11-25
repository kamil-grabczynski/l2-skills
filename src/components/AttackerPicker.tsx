import { useTranslation } from "react-i18next";
import type { ChronicleData } from "../types";
import type { AttackerChoice, Stats } from "../lib/target";
import { ClassSelect, StatLine } from "./ClassSelect";
import { NumberField } from "./NumberField";

const KINDS = ["manual", "player"] as const;

interface Props {
  data: ChronicleData;
  kind: AttackerChoice["kind"];
  cls: string;
  level: number;
  /** M.Atk of the weapon */
  weapon: number;
  stats: Stats;
  onChoice: (v: Partial<AttackerChoice>) => void;
}

/** Who casts the debuff: typed values or a class, whose INT and M.Atk are filled in. */
export function AttackerPicker({ data, kind, cls, level, weapon, stats, onChoice }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <div className="seg" role="group" aria-label={t("landing.attacker")}>
        {KINDS.map((k) => (
          <button type="button" key={k} aria-pressed={kind === k} onClick={() => onChoice({ kind: k })}>
            {t(`target.${k}`)}
          </button>
        ))}
      </div>
      {kind === "player" && (
        <>
          <div className="sk-target-row">
            {/* a new class starts from its own values */}
            <ClassSelect data={data} cls={cls} onPick={(c) => onChoice({ cls: c, mAtk: undefined, int: undefined })} />
            <NumberField label={t("attacker.level")} value={level} min={1} max={99} onChange={(v) => onChoice({ level: v, mAtk: undefined })} />
            <NumberField label={t("attacker.weapon")} value={weapon} min={1} max={2000} onChange={(v) => onChoice({ weapon: v, mAtk: undefined })} />
          </div>
          <p className="sk-target-info">
            <StatLine stats={stats} used="int" />
            <small>{t("attacker.hint")}</small>
          </p>
        </>
      )}
    </>
  );
}
