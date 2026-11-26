import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Spawns } from "../types";
import { mapUrl } from "../lib/data";

interface Props {
  spawns: Spawns;
  /** monsters to draw: [npc id, name] */
  mobs: [number, string][];
  /** monster to highlight and zoom to, null = all */
  picked: number | null;
  onPick: (npc: number | null) => void;
}

interface Shape {
  npc: number;
  name: string;
  pts: number[];
}

/** Bounding box of shapes with some room around, at least min wide/high, kept inside the map. */
function frame(shapes: Shape[], w: number, h: number) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) {
    for (let i = 0; i < s.pts.length; i += 2) {
      x0 = Math.min(x0, s.pts[i]);
      x1 = Math.max(x1, s.pts[i]);
      y0 = Math.min(y0, s.pts[i + 1]);
      y1 = Math.max(y1, s.pts[i + 1]);
    }
  }
  const pad = 70;
  let bw = Math.max(x1 - x0 + 2 * pad, 360);
  let bh = Math.max(y1 - y0 + 2 * pad, 240);
  // keep a landscape frame so the map does not get too tall
  if (bh > bw * 0.75) bw = bh / 0.75;
  else bh = Math.max(bh, bw * 0.5);
  bw = Math.min(bw, w);
  bh = Math.min(bh, h);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const x = Math.min(Math.max(cx - bw / 2, 0), w - bw);
  const y = Math.min(Math.max(cy - bh / 2, 0), h - bh);
  return `${x} ${y} ${bw} ${bh}`;
}

/** World map with the spawn areas of the monsters that drop an item, one map per world map used. */
export function SpawnMap({ spawns, mobs, picked, onPick }: Props) {
  const { t } = useTranslation();
  const byMap = useMemo(() => {
    const out = new Map<string, Shape[]>();
    for (const [npc, name] of mobs) {
      for (const [key, ...pts] of spawns.npc[npc]?.s ?? []) {
        if (!spawns.maps[key]) continue;
        let list = out.get(key);
        if (!list) out.set(key, (list = []));
        list.push({ npc, name, pts });
      }
    }
    return out;
  }, [spawns, mobs]);

  if (!byMap.size) return <p className="hint">{t("book.noSpawn")}</p>;

  return (
    <div className="spawn-maps">
      {[...byMap].map(([key, shapes]) => {
        const [file, w, h] = spawns.maps[key];
        const focus = picked != null && shapes.some((s) => s.npc === picked) ? shapes.filter((s) => s.npc === picked) : shapes;
        const vb = frame(focus, w, h);
        // spawn spots stay readable at any zoom
        const m = Math.max(5, +vb.split(" ")[2] / 90);
        return (
          <figure key={key} className="spawn-map">
            <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label={t("book.mapLabel")}>
              <image href={mapUrl(file)} width={w} height={h} />
              <rect width={w} height={h} className="spawn-shade" />
              {shapes.map((s, i) => {
                const on = picked == null || s.npc === picked;
                const cls = `spawn${on ? "" : " dim"}${s.npc === picked ? " picked" : ""}`;
                const title = <title>{s.name}</title>;
                if (s.pts.length === 2) {
                  return (
                    <g key={i} className={cls} onClick={() => onPick(s.npc === picked ? null : s.npc)}>
                      {title}
                      <rect x={s.pts[0] - m / 2} y={s.pts[1] - m / 2} width={m} height={m} transform={`rotate(45 ${s.pts[0]} ${s.pts[1]})`} />
                    </g>
                  );
                }
                return (
                  <polygon key={i} className={cls} points={s.pts.join(" ")} onClick={() => onPick(s.npc === picked ? null : s.npc)}>
                    {title}
                  </polygon>
                );
              })}
            </svg>
            <figcaption>
              {picked != null && shapes.some((s) => s.npc === picked)
                ? t("book.mapPicked", { name: shapes.find((s) => s.npc === picked)!.name })
                : t("book.mapAll")}
              {picked != null && (
                <button type="button" className="link-btn" onClick={() => onPick(null)}>
                  {t("book.mapShowAll")}
                </button>
              )}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
