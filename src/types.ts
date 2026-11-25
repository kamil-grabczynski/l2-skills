/** Shapes of public/data/*.json, produced by scraper/scrape.py. */

export interface ChronicleRef {
  slug: string;
  name: string;
}

export interface SkillInfo {
  /** name */
  n: string;
  /** icon file in public/icons/skills ("" when the wiki has none) */
  i: string;
  /** 1 = passive */
  p: 0 | 1;
  /** description per skill level */
  d: Record<string, string>;
  /** exact effect values per skill level, absent when the description already lists them */
  e?: Record<string, string>;
  /** usage data per skill level (active skills) */
  m?: Record<string, SkillMeta>;
  /** what decides whether the debuff lands */
  r?: Resist;
  /** removes the target's buffs: level -> [magic level, chance] */
  x?: { k: "cancel" | "bane"; v: Record<string, [number, number]> };
  /** 1 = hostile instant effect with only a fixed chance in the server data */
  f?: 1;
}

export interface Resist {
  /** stat the target resists with, "" = none */
  s: string;
  /** 1 = magic skill (M.Atk, M.Def and spiritshots count) */
  g: 0 | 1;
  /** trait or element of the skill, "" = none */
  t: string;
  /** level -> [magic level, level modifier, base rate (-1 = always lands)] */
  v: Record<string, [number, number, number]>;
}

/** [mp, hp, cast s, reuse s, cast range, area kind, area radius, duration s, success chance %, 1 = toggle?] */
export type SkillMeta = [number, number, number, number, number, string, number, number, number, 1?];

/** [learn level, skill id, skill level, sp, spellbook item id?] */
export type RawRow = [number, number, number, number, number?];

export interface ClassInfo {
  name: string;
  race: string;
  parent: string | null;
  icon?: string;
  rows: RawRow[];
}

export interface ChronicleData {
  slug: string;
  name: string;
  skills: Record<string, SkillInfo>;
  /** spellbook item id -> item name */
  books: Record<string, string>;
  classes: Record<string, ClassInfo>;
}

/** One learnable skill level for the selected class path. */
export interface Row {
  /** "id:lv", unique per class path */
  key: string;
  /** character level at which it is learned */
  l: number;
  id: number;
  lv: number;
  sp: number;
  /** spellbook item id, 0 when none */
  book: number;
  /** class (in the path) that teaches it */
  cls: string;
  sk: SkillInfo;
}

export type SkillType = "all" | "a" | "p";

export interface LevelRange {
  from: number;
  to: number;
}

export interface Preset extends LevelRange {
  /** class name, null = the whole range */
  label: string | null;
}

/** Skill levels counted in the SP sum: "id:lv" -> 1. Nothing is selected by default. */
export type SelMap = Record<string, 1>;

/** public/data/evolution.json: skills a class path gained after C1, per chronicle. */
export interface Evolution {
  /** chronicle slugs in release order */
  chronicles: string[];
  skills: Record<string, { n: string; i: string }>;
  /** class -> [skill id, max skill level per chronicle (0 = missing, null = class missing)] */
  classes: Record<string, [number, (number | null)[]][]>;
  /** class -> name, icon, parent (newest chronicle) and s = first chronicle that has the class */
  classInfo: Record<string, { n: string; i: string; p: string | null; s: string }>;
}
