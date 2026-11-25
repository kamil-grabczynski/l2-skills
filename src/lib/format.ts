import type { SkillMeta } from "../types";

const nf = new Intl.NumberFormat("pl-PL");
const nf2 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });

export const fmt = (n: number) => nf.format(n);
export const fmt1 = (n: number) => nf1.format(n);
export const fmt2 = (n: number) => nf2.format(n);

/** Compact SP for small chips: 1 800, 37k, 1,2M */
export const short = (n: number) => (n >= 1e6 ? `${nf1.format(n / 1e6)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : nf.format(n));

/** 1.5 s, 2 min, 1 min 30 s, 1 h */
export function duration(s: number): string {
  if (s < 60) return `${nf2.format(s)} s`;
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  return [h && `${h} h`, min && `${min} min`, sec && `${sec} s`].filter(Boolean).join(" ");
}

const AREA: Record<string, string> = {
  party: "drużyna", pledge: "klan", alliance: "sojusz", party_pledge: "drużyna i klan", dead_pledge: "polegli z klanu",
  dead_alliance: "polegli z sojuszu", point_blank: "obszar wokół siebie", range: "obszar wokół celu", fan: "obszar przed sobą",
  square: "obszar w linii", range_sort_by_hp: "sojusznicy w pobliżu",
};

/** "35 MP · działa 20 min · szansa 60% · zasięg 400 · rzucanie 4 s · odnowienie 6 s" */
export function skillMeta(m: SkillMeta | undefined): string {
  if (!m) return "";
  const [mp, hp, cast, reuse, range, area, radius, time, chance, toggle] = m;
  return [
    toggle && "przełączany",
    mp && `${fmt(mp)} MP`,
    hp && `${fmt(hp)} HP`,
    time && `działa ${duration(time)}`,
    chance && `szansa ${chance}%`,
    range && `zasięg ${fmt(range)}`,
    area && `${AREA[area] ?? area}${radius ? ` (${fmt(radius)})` : ""}`,
    cast && `rzucanie ${duration(cast)}`,
    reuse && `odnowienie ${duration(reuse)}`,
  ].filter(Boolean).join(" · ");
}
