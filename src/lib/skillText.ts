import { currentLang, type Lang } from "../i18n";
import { fmt } from "./format";

/**
 * Skill descriptions and effects are English game data. public/data/i18n/<lang>.json translates them sentence by
 * sentence with numbers replaced by "#", so one entry serves every skill level; {n} in a translation is the n-th number.
 * A sentence that is not in the file stays in English.
 */
interface Texts {
  /** description sentences */
  d: Record<string, string>;
  /** effect clauses */
  e: Record<string, string>;
}

const texts: Partial<Record<Lang, Texts>> = {};
const cache = new Map<string, string>();

/** Fetches the texts of a language; English needs none and a failed download leaves the English texts. */
export async function loadSkillTexts(lang: Lang): Promise<void> {
  if (lang === "en" || texts[lang]) return;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/i18n/${lang}.json`);
    if (res.ok) texts[lang] = (await res.json()) as Texts;
  } catch {
    /* keep English, the next switch tries again */
  }
}

const NUMBER = /\d+(?:[.,]\d+)*/g;

function localNumber(raw: string): string {
  const n = Number(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw) ? raw.replace(/,/g, "") : raw);
  return Number.isNaN(n) ? raw : fmt(n);
}

function translate(part: string, dict: Record<string, string>): string {
  const numbers: string[] = [];
  const key = part.replace(NUMBER, (n) => {
    numbers.push(n);
    return "#";
  });
  const found = dict[key];
  return found === undefined ? part : found.replace(/\{(\d+)\}/g, (_, i) => localNumber(numbers[Number(i)]));
}

/** Splits into sentences, but not inside "P. Atk.", "M. Def." and similar names. */
function sentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const m of text.matchAll(/[.!?]\s+|\n+/g)) {
    const end = m.index + m[0].length;
    if (/[.!?]/.test(m[0][0])) {
      const before = text.slice(start, m.index + 1);
      const after = text.slice(end);
      if (/\b(?:P|M|Max|Crt)\.$/.test(before)) continue;
      if (!/^[A-Z<[(\d]/.test(after) || /^(?:Atk|Def|Spd|P\. |M\. )/.test(after)) continue;
      if (/^\d/.test(after) && /(?:Atk|Def|Spd)\.$/.test(before)) continue;
    }
    out.push(text.slice(start, end));
    start = end;
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

function cached(kind: "d" | "e", text: string, run: (t: Texts) => string): string {
  const lang = currentLang();
  const t = texts[lang];
  if (!t || !text) return text;
  const key = `${lang}:${kind}:${text}`;
  let out = cache.get(key);
  if (out === undefined) cache.set(key, (out = run(t)));
  return out;
}

/** Description in the current language: components using it must call useTranslation to follow language changes. */
export const skillDescription = (text = "") =>
  cached("d", text, (t) => sentences(text).map((s) => translate(s, t.d)).filter(Boolean).join(" "));

/** Effect values in the current language. */
export const skillEffect = (text = "") =>
  cached("e", text, (t) => text.split("; ").map((c) => translate(c, t.e)).join("; "));
