import type { SkillMeta } from "../types";
import i18n, { currentLang, type Lang } from "../i18n";

const LOCALE: Record<Lang, string> = { pl: "pl-PL", en: "en-US" };
const formats = new Map<string, Intl.NumberFormat>();

/** Formats numbers for the current language with at most the given number of decimals. */
function format(n: number, decimals: number): string {
  const locale = LOCALE[currentLang()];
  const key = `${locale}:${decimals}`;
  let nf = formats.get(key);
  if (!nf) formats.set(key, (nf = new Intl.NumberFormat(locale, { maximumFractionDigits: decimals })));
  return nf.format(n);
}

export const fmt = (n: number) => format(n, 3);
export const fmt1 = (n: number) => format(n, 1);
export const fmt2 = (n: number) => format(n, 2);

/** Compact SP for small chips: 1,800, 37k, 1.2M */
export const short = (n: number) => (n >= 1e6 ? `${fmt1(n / 1e6)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : fmt(n));

/** 1.5 s, 2 min, 1 min 30 s, 1 h */
export function duration(s: number): string {
  if (s < 60) return `${fmt2(s)} s`;
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  return [h && `${h} h`, min && `${min} min`, sec && `${sec} s`].filter(Boolean).join(" ");
}

const areaLabel = (area: string) => i18n.t(`area.${area as "party"}`, { defaultValue: area });

/** "35 MP · lasts 20 min · chance 60% · range 400 · cast 4 s · reuse 6 s", in the current language */
export function skillMeta(m: SkillMeta | undefined): string {
  if (!m) return "";
  const [mp, hp, cast, reuse, range, area, radius, time, chance, toggle] = m;
  return [
    toggle && i18n.t("meta.toggle"),
    mp && `${fmt(mp)} MP`,
    hp && `${fmt(hp)} HP`,
    time && i18n.t("meta.duration", { time: duration(time) }),
    chance && i18n.t("meta.chance", { chance }),
    range && i18n.t("meta.range", { range: fmt(range) }),
    area && `${areaLabel(area)}${radius ? ` (${fmt(radius)})` : ""}`,
    cast && i18n.t("meta.cast", { time: duration(cast) }),
    reuse && i18n.t("meta.reuse", { time: duration(reuse) }),
  ].filter(Boolean).join(" · ");
}
