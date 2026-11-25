import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { SkillType } from "../types";

interface Props {
  search: string;
  type: SkillType;
  showZero: boolean;
  allCollapsed: boolean;
  onSearch: (v: string) => void;
  onType: (t: SkillType) => void;
  onShowZero: (v: boolean) => void;
  onAllOn: () => void;
  onAllOff: () => void;
  onReset: () => void;
  onCollapseAll: () => void;
}

const TYPES = [
  ["all", "toolbar.all"],
  ["a", "toolbar.active"],
  ["p", "toolbar.passive"],
] as const;

export function SkillToolbar(p: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  // level headers stick right below the toolbar, whose height changes when it wraps
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => document.documentElement.style.setProperty("--toolbar-h", `${Math.floor(el.getBoundingClientRect().height)}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="toolbar" ref={ref}>
      <div className="tb-row">
        <input type="search" placeholder={t("common.searchSkill")} aria-label={t("common.searchSkillLabel")} value={p.search} onChange={(e) => p.onSearch(e.target.value)} />
        <div className="seg" role="group" aria-label={t("toolbar.type")}>
          {TYPES.map(([type, label]) => (
            <button type="button" key={type} aria-pressed={p.type === type} onClick={() => p.onType(type)}>
              {t(label)}
            </button>
          ))}
        </div>
      </div>
      <div className="tb-row">
        <label className="switch">
          <input type="checkbox" checked={p.showZero} onChange={(e) => p.onShowZero(e.target.checked)} />
          <span />
          {t("toolbar.showZero")}
        </label>
        <div className="btns">
          <button type="button" onClick={p.onAllOn}>{t("toolbar.selectVisible")}</button>
          <button type="button" onClick={p.onAllOff}>{t("toolbar.deselectVisible")}</button>
          <button type="button" onClick={p.onReset} title={t("toolbar.clearTitle")}>{t("toolbar.clear")}</button>
          <button type="button" onClick={p.onCollapseAll}>{p.allCollapsed ? t("toolbar.expandLevels") : t("toolbar.collapseLevels")}</button>
        </div>
      </div>
    </div>
  );
}
