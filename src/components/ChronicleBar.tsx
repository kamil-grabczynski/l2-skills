import { useEffect, useRef } from "react";
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
  const ref = useRef<HTMLElement>(null);

  // on narrow screens the bar scrolls sideways - keep the active chronicle in view
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active, chronicles]);

  return (
    <nav className="chronicle-bar" aria-label="Kronika" ref={ref}>
      <span className="cb-label">Kronika</span>
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
