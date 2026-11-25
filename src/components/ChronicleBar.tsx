import { useTranslation } from "react-i18next";
import type { ChronicleRef } from "../types";
import { chronicleLabel } from "../lib/data";

interface Props {
  chronicles: ChronicleRef[];
  active: string | null;
  onPick: (slug: string) => void;
}

/** "C1: Harbingers of War" -> "Harbingers of War"; names without a prefix stay as they are. */
const subtitle = (c: ChronicleRef) => c.name.replace(/^C\d:\s*/, "");

/** Full-width chronicle switcher; the active chronicle is highlighted and shows its full name. */
export function ChronicleBar({ chronicles, active, onPick }: Props) {
  const { t } = useTranslation();
  return (
    <nav className="chronicle-bar" aria-label={t("common.chronicle")}>
      <span className="cb-label">{t("common.chronicle")}</span>
      {chronicles.map((c) => {
        const on = c.slug === active;
        return (
          <button type="button" key={c.slug} title={c.name} aria-pressed={on} onClick={() => onPick(c.slug)}>
            <b>{chronicleLabel(c.slug)}</b>
            {on && <span className="cb-name">{subtitle(c)}</span>}
          </button>
        );
      })}
    </nav>
  );
}
