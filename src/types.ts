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
}

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
  label: string;
}

/** Excluded skill levels: "id:lv" -> 1 */
export type OffMap = Record<string, 1>;
