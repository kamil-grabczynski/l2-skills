import type { Resist } from "../types";
import i18n from "../i18n";

/**
 * Land chance of hostile skills:
 *   (30 + base rate - target stat + min(magic level - target level + 3, 0) * level modifier)
 *     * (magic only) 11 * sqrt(M.Atk * shot) / M.Def
 *     * resistances * attributes * land bonus
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
  /** M.Atk from the status window, i.e. with the total INT below already counted */
  mAtk: number;
  /** total INT at that M.Atk */
  int: number;
  /** INT to add (dyes, set): raises M.Atk by the INT bonus table */
  intAdd: number;
  /** extra M.Atk and M.Def, % */
  mAtkPct: number;
  mDefPct: number;
  mDef: number;
  shot: Shot;
  /** resistance to the skill's type and to debuffs in general, % */
  typeRes: number;
  debuffRes: number;
  /** attribute attack minus the target's attribute defence (elemental debuffs from Gracia Final on) */
  attribute: number;
  /** bonus to the land chance from boss jewelry, % */
  landBonus: number;
}

/**
 * M.Atk is multiplied by the square of this bonus, so under the square root of the formula it counts once.
 * It depends on the total INT and has no threshold; below 32 it is a penalty (C1 server data, int_bonus, all 99 values).
 */
export const intBonus = (int: number) => Math.round(1.02 ** (Math.min(Math.max(int, 1), 99) - 31.375) * 100) / 100;

/** M.Atk after the added INT and the extra percentage. */
export function finalMAtk(d: Duel): number {
  return d.mAtk * (intBonus(d.int + d.intAdd) / intBonus(d.int)) ** 2 * (1 + d.mAtkPct / 100);
}

/** Multiplier of the attribute advantage. */
export function attributeBonus(advantage: number): number {
  if (advantage <= 0) return 1;
  if (advantage < 40) return 1 + advantage / 200;
  return advantage < 150 ? 1.2 : advantage < 300 ? 1.4 : 1.7;
}

/** Base INT of the starting class, only a starting point for the calculator. */
export const BASE_INT: Record<string, number> = {
  fighter: 21, mage: 41, elven_fighter: 23, elven_mage: 37, dark_fighter: 25, dark_mage: 44,
  orc_fighter: 18, orc_mage: 31, dwarven_fighter: 20, kamael_m_soldier: 29, kamael_f_soldier: 28,
};

export interface Chance {
  /** 30 + base - stat - level penalty, never below 0 */
  partial: number;
  /** level penalty in percentage points, 0 or more */
  penalty: number;
  magic: number;
  res: number;
  /** attributes and land bonus */
  bonus: number;
  /** before the caps */
  raw: number;
}

export function landChance(r: Resist, lv: number, d: Duel): Chance {
  const [magicLevel, lvBonus, rate] = r.v[lv];
  const penalty = Math.max(d.level - magicLevel - 3, 0) * lvBonus;
  const partial = Math.max(30 + rate - d.stat - penalty, 0);
  const magic = r.g ? (11 * Math.sqrt(finalMAtk(d) * SHOT[d.shot])) / Math.max(d.mDef * (1 + d.mDefPct / 100), 1) : 1;
  const res = Math.max(1 - d.typeRes / 100, 0) * Math.max(1 - d.debuffRes / 100, 0);
  const bonus = attributeBonus(d.attribute) * (1 + d.landBonus / 100);
  return { partial, penalty, magic, res, bonus, raw: partial * magic * res * bonus };
}

/** One MEN point raises M.Def by this factor. */
export const MEN_MDEF = 1.01;

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

export const traitLabel = (trait: string) => i18n.t(`trait.${trait as "Shock"}`, { defaultValue: trait });
