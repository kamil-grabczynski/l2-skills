import type { BookInfo, ChronicleData, ChronicleRef, Evolution, Preset, Row } from "../types";
import i18n from "../i18n";

const BASE = import.meta.env.BASE_URL;

export const skillIconUrl = (file: string) => `${BASE}icons/skills/${file}`;
export const classIconUrl = (icon: string) => `${BASE}icons/classes/${icon}.svg`;
export const itemIconUrl = (icon: string) => `${BASE}icons/items/${icon}.png`;

/** Item name as the game shows it, a fallback when the wiki has no page for the item. */
export const bookName = (data: ChronicleData, id: number | string) => data.books[id] || `item ${id}`;
/** Kind of item from the first word of its name: Spellbook, Amulet, Ancient Book, Forgotten Scroll… */
export const bookKind = (name: string) => (name.includes(":") ? name.split(":")[0].trim() : "");

export const RACE_ORDER = ["Human", "Elf", "Elven", "Dark Elf", "Dark Elven", "Orc", "Dwarf", "Dwarven", "Kamael"];
/** The wiki names some races in two ways; both use one translation key. */
const RACE_KEY: Record<string, string> = { Elven: "Elf", "Dark Elven": "Dark Elf", Dwarven: "Dwarf" };
export const raceKey = (race: string) => RACE_KEY[race] ?? race;
/** Reads the current language: components using it must call useTranslation to follow language changes. */
export const raceLabel = (race: string) => i18n.t(`race.${raceKey(race) as "Human"}`, { defaultValue: race });
export const raceRank = (race: string) => {
  const i = RACE_ORDER.indexOf(race);
  return i < 0 ? 99 : i;
};

/** Character level of each class change: base, 1st, 2nd, 3rd profession. */
export const TIER_START = [1, 20, 40, 76];
export const tierLabel = (depth: number) => i18n.t(`tier.${depth as 0}`);

/** A data file the server did not return; the message is translated when it is shown. */
export class LoadError extends Error {
  constructor(readonly path: string, readonly status: number) {
    super(`could not load ${path} (${status})`);
  }
}
export const errorText = (e: Error) =>
  i18n.t("app.error", {
    message: e instanceof LoadError ? i18n.t("app.loadFailed", { path: e.path, status: e.status }) : e.message,
  });

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new LoadError(path, res.status);
  return res.json() as Promise<T>;
}

export const loadIndex = () => getJson<ChronicleRef[]>("data/index.json");

let evolution: Promise<Evolution> | null = null;
export function loadEvolution(): Promise<Evolution> {
  if (!evolution) {
    evolution = getJson<Evolution>("data/evolution.json");
    evolution.catch(() => (evolution = null));
  }
  return evolution;
}

const cache = new Map<string, Promise<ChronicleData>>();
export function loadChronicle(slug: string): Promise<ChronicleData> {
  let p = cache.get(slug);
  if (!p) {
    p = getJson<ChronicleData>(`data/${slug}.json`);
    p.catch(() => cache.delete(slug));
    cache.set(slug, p);
  }
  return p;
}

const bookCache = new Map<string, Promise<Record<string, BookInfo>>>();
/** Shops and drops of the chronicle's spellbooks, loaded when a book page opens. */
export function loadBooks(slug: string): Promise<Record<string, BookInfo>> {
  let p = bookCache.get(slug);
  if (!p) {
    p = getJson<Record<string, BookInfo>>(`data/books/${slug}.json`);
    p.catch(() => bookCache.delete(slug));
    bookCache.set(slug, p);
  }
  return p;
}

export function chainOf(data: ChronicleData, cls: string): string[] {
  const out: string[] = [];
  for (let c: string | null = cls; c && data.classes[c]; c = data.classes[c].parent) out.unshift(c);
  return out;
}

export const depthOf = (data: ChronicleData, cls: string) => chainOf(data, cls).length - 1;

/** All learnable skill levels for a class path; a level taught by two classes counts once, at the lower level. */
export function buildRows(data: ChronicleData, chain: string[]): Row[] {
  const seen = new Map<string, Row>();
  for (const c of chain) {
    for (const [l, id, lv, sp, book] of data.classes[c].rows) {
      const key = `${id}:${lv}`;
      const prev = seen.get(key);
      if (!prev || l < prev.l) {
        seen.set(key, {
          key, l, id, lv, sp, book: book ?? 0, cls: c,
          sk: data.skills[id] ?? { n: `Skill ${id}`, i: "", p: 0, d: {} },
        });
      }
    }
  }
  return [...seen.values()];
}

export const maxLevelOf = (rows: Row[]) => rows.reduce((m, r) => Math.max(m, r.l), 1);

/** One preset per profession in the path (until the next class change) plus the whole range. */
export function presetsFor(data: ChronicleData, chain: string[], maxLv: number): Preset[] {
  const out: Preset[] = chain.map((c, i) => ({
    label: data.classes[c].name,
    from: TIER_START[i] ?? 1,
    to: TIER_START[i + 1] ? Math.min(TIER_START[i + 1] - 1, maxLv) : maxLv,
  }));
  out.push({ label: null, from: 1, to: maxLv });
  return out;
}

export function defaultClass(data: ChronicleData): string {
  return data.classes.fighter ? "fighter" : Object.keys(data.classes)[0];
}

/** Short tab labels, as the wiki abbreviates the chronicles. */
const CHRONICLE_SHORT: Record<string, string> = {
  interlude: "IL", kamael: "K", hellbound: "HB", gracia1: "G1", gracia2: "G2",
  "gracia-final": "GF", "gracia-epilogue": "GE", freya: "F", "hi-five": "H5",
};
export const chronicleLabel = (slug: string) => CHRONICLE_SHORT[slug] ?? slug.toUpperCase();
