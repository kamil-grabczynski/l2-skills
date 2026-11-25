import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { readJson, writeJson } from "../lib/storage";
import en from "./en.json";
import pl from "./pl.json";

export const LANGS = ["pl", "en"] as const;
export type Lang = (typeof LANGS)[number];

// "satisfies" fails the build when a language lacks a key that English has
const resources = { en: { translation: en }, pl: { translation: pl } } satisfies Record<Lang, { translation: typeof en }>;

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}

const STORAGE_KEY = "spcalc:lang";
const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** The language the visitor picked, otherwise the first supported one the browser asks for, otherwise English. */
function initialLang(): Lang {
  const saved = readJson<unknown>(STORAGE_KEY, null);
  if (isLang(saved)) return saved;
  return navigator.languages.map((l) => l.slice(0, 2).toLowerCase()).find(isLang) ?? "en";
}

i18n.on("languageChanged", (lang) => {
  document.documentElement.lang = lang;
});

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLang(),
  fallbackLng: "en",
  supportedLngs: LANGS,
  interpolation: { escapeValue: false }, // React escapes
});

export const currentLang = (): Lang => (isLang(i18n.language) ? i18n.language : "en");

/** Switch the language and remember the choice for the next visit. */
export function setLang(lang: Lang) {
  writeJson(STORAGE_KEY, lang);
  void i18n.changeLanguage(lang);
}

export default i18n;
