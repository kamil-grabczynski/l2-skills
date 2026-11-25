import type { Resist } from "../types";

/**
 * Land chance of hostile skills:
 *   (30 + base rate - target stat + min(magic level - target level + 3, 0) * level modifier)
 *     * (magic only) 11 * sqrt(M.Atk * shot) / M.Def
 *     * resistances
 * Base rate, level modifier, magic level and the target stat are server data of each chronicle. The formula itself is
 * documented for Gracia - High Five; earlier chronicles use the same skill fields, so it is an approximation there.
 */
export type Shot = "none" | "ss" | "bss";

/** M.Atk multiplier of the shot (under the square root: x1.41 and x2 chance). */
export const SHOT: Record<Shot, number> = { none: 1, ss: 2, bss: 4 };

export interface Duel {
  /** target level */
  level: number;
  /** value of the stat the target resists with */
  stat: number;
  mAtk: number;
  mDef: number;
  shot: Shot;
  /** resistance to the skill's type and to debuffs in general, % */
  typeRes: number;
  debuffRes: number;
}

export interface Chance {
  /** 30 + base - stat - level penalty, never below 0 */
  partial: number;
  /** level penalty in percentage points, 0 or more */
  penalty: number;
  magic: number;
  res: number;
  /** before the caps */
  raw: number;
}

export function landChance(r: Resist, lv: number, d: Duel): Chance {
  const [magicLevel, lvBonus, rate] = r.v[lv];
  const penalty = Math.max(d.level - magicLevel - 3, 0) * lvBonus;
  const partial = Math.max(30 + rate - d.stat - penalty, 0);
  const magic = r.g ? (11 * Math.sqrt(d.mAtk * SHOT[d.shot])) / Math.max(d.mDef, 1) : 1;
  const res = Math.max(1 - d.typeRes / 100, 0) * Math.max(1 - d.debuffRes / 100, 0);
  return { partial, penalty, magic, res, raw: partial * magic * res };
}

/** One MEN point raises M.Def, one INT point raises the square root of M.Atk by this factor. */
export const MEN_MDEF = 1.0103;
export const INT_SQRT_MATK = 1.0198;

const ORDER = [
  "c1", "c2", "c3", "c4", "c5", "interlude", "kamael", "hellbound", "gracia1", "gracia2",
  "gracia-final", "gracia-epilogue", "freya", "hi-five",
];
const since = (slug: string, first: string) => ORDER.indexOf(slug) >= ORDER.indexOf(first);

const ELEMENTS = new Set(["Fire", "Water", "Wind", "Earth", "Holy", "Unholy"]);

/** Lowest and highest possible chance. */
export const caps = (slug: string): [number, number] => (slug === "hi-five" ? [10, 90] : [0, 95]);
/** The general resistance to debuffs appears in C4. */
export const hasDebuffRes = (slug: string) => since(slug, "c4");
/** Boss jewelry adds to the land chance from Kamael on. */
export const hasTraitBonus = (slug: string) => since(slug, "kamael");
/** Resistances can also shorten a debuff from Gracia Part 1 on. */
export const shortensDebuffs = (slug: string) => since(slug, "gracia1");
/** Attack/defence attributes decide about elemental debuffs from Gracia Final on (before it: elemental resistance). */
export const usesAttributes = (slug: string, r: Resist) => since(slug, "gracia-final") && ELEMENTS.has(r.t);
/** Chronicles the formula is documented for. */
export const formulaKnown = (slug: string) => since(slug, "gracia-final");

export const clampChance = (slug: string, raw: number) => {
  const [min, max] = caps(slug);
  return Math.min(Math.max(raw, min), max);
};

/** A typical value of the stat, only a starting point for the calculator. */
export const STAT_DEFAULT: Record<string, number> = { str: 40, dex: 30, con: 40, int: 25, wit: 20, men: 25 };

const TRAIT_PL: Record<string, string> = {
  Shock: "ogłuszenie", Sleep: "uśpienie", Hold: "unieruchomienie", Paralyze: "paraliż", Derangement: "ataki mentalne",
  Poison: "trucizna", Bleed: "krwawienie", Fire: "ogień", Water: "woda", Wind: "wiatr", Earth: "ziemia",
  Holy: "świętość", Unholy: "mrok", Death: "śmierć", "Turn Stone": "petryfikacja", "Physical Blockade": "blokada fizyczna",
};
export const traitLabel = (t: string) => TRAIT_PL[t] ?? t;
