import type { ChronicleData } from "../types";
import { chainOf } from "./data";
import { intBonus, since } from "./debuff";

/** public/data/monsters/<chronicle>.json: what decides whether a debuff lands on each monster of that chronicle. */
interface MonsterFile {
  /** [STR, DEX, CON, INT, WIT, MEN] */
  stats: number[][];
  /** trait -> % resistance */
  res: Record<string, number>[];
  /** [name, level, 1 = raid boss, M.Def, index in stats, index in res] */
  list: [string, number, 0 | 1, number, number, number][];
}

export type Stats = Record<"str" | "dex" | "con" | "int" | "wit" | "men", number>;
const STAT_KEYS = ["str", "dex", "con", "int", "wit", "men"] as const;

export interface Monster {
  name: string;
  level: number;
  boss: boolean;
  mDef: number;
  stats: Stats;
  /** trait -> % resistance */
  res: Record<string, number>;
}

/** Target picked by the visitor, kept between skills and chronicles. */
export interface TargetChoice {
  kind: "manual" | "monster" | "player";
  /** picked monster; mDef tells apart variants with the same name and level */
  monster?: { name: string; level: number; mDef?: number };
  /** class and level of a player; mDef is the value typed for that class, missing = the default */
  cls?: string;
  level?: number;
  mDef?: number;
}

/** Attacker picked by the visitor; weapon, level, INT and M.Atk are typed values, missing = the default of the class. */
export interface AttackerChoice {
  kind: "manual" | "player";
  cls?: string;
  level?: number;
  /** M.Atk of the weapon */
  weapon?: number;
  int?: number;
  mAtk?: number;
}

/** Target values the calculator starts from. */
export interface TargetValues {
  level: number;
  stats: Stats;
  mDef: number;
  res: Record<string, number>;
}

const toStats = (v: number[]) => Object.fromEntries(STAT_KEYS.map((k, i) => [k, v[i]])) as Stats;

const cache = new Map<string, Promise<Monster[]>>();
export function loadMonsters(slug: string): Promise<Monster[]> {
  let p = cache.get(slug);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/monsters/${slug}.json`).then(async (res) => {
      if (!res.ok) throw new Error(`${res.status}`);
      const f = (await res.json()) as MonsterFile;
      const stats = f.stats.map(toStats);
      return f.list.map(([name, level, boss, mDef, s, r]) => ({ name, level, boss: !!boss, mDef, stats: stats[s], res: f.res[r] }));
    });
    p.catch(() => cache.delete(slug));
    cache.set(slug, p);
  }
  return p;
}

/** The same monster in this chronicle: same name and level, otherwise the closest level with that name. */
export function findMonster(list: Monster[], wanted: NonNullable<TargetChoice["monster"]>): Monster | undefined {
  const same = list.filter((m) => m.name === wanted.name);
  return same.sort((a, b) => Math.abs(a.level - wanted.level) - Math.abs(b.level - wanted.level) || Number(b.mDef === wanted.mDef) - Number(a.mDef === wanted.mDef))[0];
}

/** Every word must occur in the name; a number is the level. Names starting with the text come first. */
export function searchMonsters(list: Monster[], query: string, limit: number): Monster[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const text = words.filter((w) => !/^\d+$/.test(w));
  const levels = words.filter((w) => /^\d+$/.test(w)).map(Number);
  const start = text.join(" ");
  return list
    .filter((m) => {
      const name = m.name.toLowerCase();
      return text.every((w) => name.includes(w)) && levels.every((l) => m.level === l || name.includes(String(l)));
    })
    .sort(
      (a, b) =>
        Number(b.name.toLowerCase().startsWith(start)) - Number(a.name.toLowerCase().startsWith(start)) ||
        a.name.localeCompare(b.name) ||
        a.level - b.level,
    )
    .slice(0, limit);
}

/** Base stats depend on the race and on fighter/mystic only; C1 and later server files (recommended_stat) hold the same values. */
const BASE_STATS: Record<string, Stats> = {
  fighter: { str: 40, dex: 30, con: 43, int: 21, wit: 11, men: 25 },
  mage: { str: 22, dex: 21, con: 27, int: 41, wit: 20, men: 39 },
  elven_fighter: { str: 36, dex: 35, con: 36, int: 23, wit: 14, men: 26 },
  elven_mage: { str: 21, dex: 24, con: 25, int: 37, wit: 23, men: 40 },
  dark_fighter: { str: 41, dex: 34, con: 32, int: 25, wit: 12, men: 26 },
  dark_mage: { str: 23, dex: 23, con: 24, int: 44, wit: 19, men: 37 },
  orc_fighter: { str: 40, dex: 26, con: 47, int: 18, wit: 12, men: 27 },
  orc_mage: { str: 27, dex: 24, con: 31, int: 31, wit: 15, men: 42 },
  dwarven_fighter: { str: 39, dex: 29, con: 45, int: 20, wit: 10, men: 27 },
  kamael_m_soldier: { str: 41, dex: 33, con: 31, int: 29, wit: 11, men: 25 },
  kamael_f_soldier: { str: 39, dex: 35, con: 30, int: 28, wit: 11, men: 27 },
};

export const baseStats = (data: ChronicleData, cls: string): Stats => BASE_STATS[chainOf(data, cls)[0]] ?? BASE_STATS.fighter;

/** Passive skills that add a fixed M.Def: Anti Magic, Magic Resistance, Magic Immunity. */
const MDEF_PASSIVES = new Set([146, 147, 466]);

/** Passive skills known at a level: id -> skill level. */
function knownPassives(data: ChronicleData, chain: string[], level: number): Map<number, number> {
  const best = new Map<number, number>();
  for (const c of chain) {
    for (const [l, id, lv] of data.classes[c].rows) {
      if (l <= level && data.skills[id]?.p) best.set(id, Math.max(best.get(id) ?? 0, lv));
    }
  }
  return best;
}

function passiveMDef(data: ChronicleData, chain: string[], level: number): number {
  let sum = 0;
  for (const [id, lv] of knownPassives(data, chain, level)) {
    if (!MDEF_PASSIVES.has(id)) continue;
    const sk = data.skills[id];
    const m = /\+([\d.]+) M\. Def/.exec(sk?.e?.[lv] ?? "") ?? /M\. Def\.? (?:is )?(?:increase[sd]? )?by ([\d.]+)/i.exec(sk?.d[lv] ?? "");
    if (m) sum += Number(m[1].replace(/\.$/, ""));
  }
  return sum;
}

const menBonus = (men: number) => Math.round(1.01 ** (men + 0.06) * 100) / 100;

/** M.Def of a class without jewelry: (41 + passives) x MEN bonus x level modifier. */
export function playerMDef(data: ChronicleData, cls: string, level: number): number {
  const add = passiveMDef(data, chainOf(data, cls), level);
  return Math.round((41 + add) * menBonus(baseStats(data, cls).men) * ((level + 89) / 100));
}

/** M.Atk of the best common one-handed magic weapon of the grade for a level (item data of each chronicle). */
export function weaponMAtk(slug: string, level: number): number {
  if (level >= 84 && since(slug, "gracia-final")) return 244;
  if (level >= 80 && since(slug, "kamael")) return 202;
  if (level >= 76 && since(slug, "c4")) return 175;
  if (level >= 61) return since(slug, "interlude") ? 161 : since(slug, "c4") ? 152 : 146;
  if (level >= 52) return since(slug, "c5") ? 132 : 122;
  if (level >= 40) return since(slug, "c5") ? 111 : 101;
  return level >= 20 ? 72 : 21;
}

/** Unconditional M.Atk of the passives (Weapon Mastery and others): percentages multiply, fixed values are added. */
function passiveMAtk(data: ChronicleData, chain: string[], level: number): { mul: number; add: number } {
  let mul = 1;
  let add = 0;
  for (const [id, lv] of knownPassives(data, chain, level)) {
    const sk = data.skills[id];
    const effect = sk.e?.[lv];
    const found = effect
      ? [...effect.matchAll(/\+([\d.]+)(%?) M\. Atk\.(?! with| vs| when)/g)]
      : [...(sk.d[lv] ?? "").matchAll(/(?:M\. Atk\.|magic power) by ([\d.]+)(%)/g)];
    for (const [, value, percent] of found) {
      if (percent) mul *= 1 + Number(value) / 100;
      else add += Number(value);
    }
  }
  return { mul, add };
}

/** M.Atk of a class without buffs: weapon x INT bonus squared x level modifier squared, then the passives. */
export function playerMAtk(data: ChronicleData, cls: string, level: number, weapon: number, int: number): number {
  const { mul, add } = passiveMAtk(data, chainOf(data, cls), level);
  return Math.round(weapon * intBonus(int) ** 2 * ((level + 89) / 100) ** 2 * mul + add);
}
