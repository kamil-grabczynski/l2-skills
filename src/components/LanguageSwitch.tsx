import { useTranslation } from "react-i18next";
import { LANGS, currentLang, setLang, type Lang } from "../i18n";

const NAMES: Record<Lang, string> = { pl: "Polski", en: "English" };

export function LanguageSwitch() {
  const { t } = useTranslation();
  const active = currentLang();
  return (
    <div className="seg" role="group" aria-label={t("common.language")}>
      {LANGS.map((l) => (
        <button type="button" key={l} lang={l} title={NAMES[l]} aria-label={NAMES[l]} aria-pressed={l === active} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
