import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChronicleData, ChronicleRef, LevelRange, Row, SkillType } from "./types";
import {
  buildRows, chainOf, defaultClass, errorText, loadChronicle, loadIndex, maxLevelOf, presetsFor,
} from "./lib/data";
import { usePersistentState, useSelection } from "./lib/storage";
import { hrefFor, navigate, useHashRoute } from "./lib/route";
import { fmt } from "./lib/format";
import { currentLang } from "./i18n";
import { loadSkillTexts } from "./lib/skillText";
import { Sidebar, type Totals } from "./components/Sidebar";
import { ClassPicker } from "./components/ClassPicker";
import { SkillSearch } from "./components/SkillSearch";
import { LanguageSwitch } from "./components/LanguageSwitch";
import { ChronicleBar } from "./components/ChronicleBar";
import { ChronicleTable } from "./components/ChronicleTable";
import { SkillToolbar } from "./components/SkillToolbar";
import { SkillPage } from "./components/SkillPage";
import { SkillList, type Section, type SkillActions } from "./components/SkillList";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

interface Prefs {
  chronicle: string;
  /** last class per chronicle (highlighted on the picker) */
  cls: Record<string, string>;
  /** class the visitor picked last; kept when switching chronicles (or its nearest ancestor if missing there) */
  wanted?: string;
  /** race tab on the class picker */
  race?: string;
  /** level range per "chronicle/class"; missing = the class's own profession range */
  ranges: Record<string, LevelRange>;
  type: SkillType;
  showZero: boolean;
  /** right panel: skill selection or the per-chronicle comparison */
  view: "skills" | "chronicles";
}

/** C1 unless the visitor already picked a chronicle (saved in localStorage on every pick). */
const DEFAULT_PREFS: Prefs = { chronicle: "c1", cls: {}, ranges: {}, type: "all", showZero: false, view: "skills" };

const rangeKey = (slug: string, cls: string) => `${slug}/${cls}`;

/** Forget the saved range so the class opens on its own profession range (e.g. 2nd class: 40-75). */
const withoutRange = (p: Prefs, key: string): Prefs => {
  if (!(key in p.ranges)) return p;
  const ranges = { ...p.ranges };
  delete ranges[key];
  return { ...p, ranges };
};

export default function App() {
  const { t } = useTranslation();
  const route = useHashRoute();
  const [chronicles, setChronicles] = useState<ChronicleRef[] | null>(null);
  const [prefs, setPrefs] = usePersistentState<Prefs>("spcalc:prefs", DEFAULT_PREFS);
  const [data, setData] = useState<ChronicleData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [scrollTo, setScrollTo] = useState<number | null>(null);

  // ---------- routing & loading ----------
  const [textsReady, setTextsReady] = useState(false);
  useEffect(() => {
    loadSkillTexts(currentLang()).then(() => setTextsReady(true));
  }, []);
  useEffect(() => {
    loadIndex().then(setChronicles, setError);
  }, []);

  const known = (slug: string | null) => !!slug && !!chronicles?.some((c) => c.slug === slug);
  const activeSlug = chronicles
    ? known(route.slug) ? route.slug! : known(prefs.chronicle) ? prefs.chronicle : chronicles[0].slug
    : null;

  useEffect(() => {
    if (!activeSlug) return;
    let alive = true;
    setError(null);
    loadChronicle(activeSlug).then(
      (d) => alive && setData(d),
      (e: Error) => alive && setError(e),
    );
    return () => {
      alive = false;
    };
  }, [activeSlug]);

  const ready = textsReady && !!data && data.slug === activeSlug;
  const cls = ready && route.cls && data.classes[route.cls] ? route.cls : null;
  const view: "loading" | "picker" | "calc" | "skill" = !ready ? "loading" : route.skill ? "skill" : cls ? "calc" : "picker";
  /** class to return to from a skill page */
  const lastCls = ready && data.classes[prefs.cls[data.slug]] ? prefs.cls[data.slug] : null;

  // unknown chronicle/class in the address -> back to the picker
  useEffect(() => {
    if (!chronicles) return;
    if (route.slug && !known(route.slug)) navigate(null, null, true);
    else if (ready && route.cls && !data.classes[route.cls]) navigate(data.slug, null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chronicles, ready, route.slug, route.cls]);

  // remember chronicle and class for the next visit
  useEffect(() => {
    if (!activeSlug) return;
    setPrefs((p) =>
      p.chronicle === activeSlug && (!cls || p.cls[activeSlug] === cls)
        ? p
        : { ...p, chronicle: activeSlug, cls: cls ? { ...p.cls, [activeSlug]: cls } : p.cls },
    );
  }, [activeSlug, cls, setPrefs]);

  // a new class starts with all level sections expanded
  useEffect(() => {
    setCollapsed(new Set());
    setOpened(new Set());
  }, [cls, activeSlug]);

  const pickClass = useCallback(
    (c: string) => {
      if (!data) return;
      setPrefs((p) => ({ ...withoutRange(p, rangeKey(data.slug, c)), wanted: c, race: data.classes[c]?.race ?? p.race }));
      navigate(data.slug, c);
      window.scrollTo({ top: 0 });
    },
    [data, setPrefs],
  );

  /** Pick a class that may not exist in the current chronicle: then open the first chronicle that has it. */
  const pickClassAnywhere = useCallback(
    (c: string, since: string) => {
      if (data?.classes[c]) return pickClass(c);
      setPrefs((p) => ({ ...withoutRange(p, rangeKey(since, c)), wanted: c }));
      navigate(since, c);
    },
    [data, pickClass, setPrefs],
  );

  const pickChronicle = useCallback(
    async (slug: string) => {
      if (route.skill) {
        navigate(slug, `skill/${route.skill}`);
        return;
      }
      if (view !== "calc") {
        navigate(slug);
        return;
      }
      // stay in the calculator with the same class; if the chronicle does not have it yet (e.g. a 3rd class
      // before C4), use its nearest ancestor there. The picked class is remembered for later chronicles.
      try {
        const d = await loadChronicle(slug);
        const path = [prefs.wanted, ...(data && cls ? chainOf(data, cls).reverse() : [])];
        const target = path.find((c): c is string => !!c && !!d.classes[c]) ?? defaultClass(d);
        setPrefs((p) => withoutRange(p, rangeKey(slug, target)));
        navigate(slug, target);
      } catch (e) {
        setError(e as Error);
      }
    },
    [view, cls, data, route.skill, prefs.wanted, setPrefs],
  );

  // ---------- derived data ----------
  const chain = useMemo(() => (ready && cls ? chainOf(data, cls) : []), [ready, data, cls]);
  const rows = useMemo(() => (ready && cls ? buildRows(data, chain) : []), [ready, data, cls, chain]);
  const maxLv = useMemo(() => maxLevelOf(rows), [rows]);
  const presets = useMemo(() => (ready && cls ? presetsFor(data, chain, maxLv) : []), [ready, data, cls, chain, maxLv]);

  // Back/forward and reloads restore the range used for this class; a fresh pick starts on its profession range.
  const key = ready && cls ? rangeKey(data.slug, cls) : null;
  const own = presets[chain.length - 1];
  const saved = key ? prefs.ranges[key] : undefined;
  const rawFrom = saved?.from ?? own?.from ?? 1;
  const rawTo = saved?.to ?? own?.to ?? 80;
  const from = Math.min(rawFrom, rawTo);
  const to = Math.max(rawFrom, rawTo);
  const range = useMemo(() => ({ from, to }), [from, to]);
  const setRange = useCallback(
    (r: LevelRange) => key && setPrefs((p) => ({ ...p, ranges: { ...p.ranges, [key]: { from: r.from, to: r.to } } })),
    [key, setPrefs],
  );

  // a skill page opens at the top; going back restores the place in the class list
  const listScroll = useRef<{ key: string | null; y: number; back: boolean }>({ key: null, y: 0, back: false });
  useLayoutEffect(() => {
    const pos = listScroll.current;
    if (view === "skill") {
      pos.back = true;
      window.scrollTo(0, 0);
      return;
    }
    if (view !== "calc" || !key) return;
    if (pos.back && pos.key === key) window.scrollTo(0, pos.y);
    pos.back = false;
    const onScroll = () => {
      pos.key = key;
      pos.y = window.scrollY;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [view, key, route.skill]);

  // v3: selection stores the skill levels that ARE counted (default: none)
  const [sel, updateSel] = useSelection(cls && activeSlug ? `spcalc:sel3:${activeSlug}:${cls}` : null);

  const inRange = useMemo(() => rows.filter((r) => r.l >= from && r.l <= to), [rows, from, to]);

  const totals: Totals = useMemo(() => {
    let sp = 0, skipped = 0, levels = 0;
    const ids = new Set<number>();
    const per = new Map<number, number>();
    const books: Row[] = [];
    for (const r of inRange) {
      if (!sel[r.key]) {
        skipped += r.sp;
        continue;
      }
      sp += r.sp;
      levels++;
      ids.add(r.id);
      per.set(r.l, (per.get(r.l) ?? 0) + r.sp);
      if (r.book) books.push(r);
    }
    books.sort((a, b) => a.l - b.l);
    return { sp, skipped, levels, skills: ids.size, perLevel: [...per.entries()].sort((a, b) => a[0] - b[0]), books };
  }, [inRange, sel]);

  // The list follows range/search with deferred values so typing and dragging the slider stay smooth.
  const listRange = useDeferredValue(range);
  const listSearch = useDeferredValue(search.trim().toLowerCase());
  const stale = listRange !== range || listSearch !== search.trim().toLowerCase();

  const listInRange = useMemo(
    () => rows.filter((r) => r.l >= listRange.from && r.l <= listRange.to),
    [rows, listRange],
  );
  const visible = useMemo(
    () =>
      listInRange.filter(
        (r) =>
          (!listSearch || r.sk.n.toLowerCase().includes(listSearch)) &&
          (prefs.type === "all" || (prefs.type === "p") === !!r.sk.p) &&
          (prefs.showZero || r.sp > 0),
      ),
    [listInRange, listSearch, prefs.type, prefs.showZero],
  );
  const sections: Section[] = useMemo(() => {
    const byLevel = new Map<number, Map<number, Row[]>>();
    for (const r of visible) {
      let m = byLevel.get(r.l);
      if (!m) byLevel.set(r.l, (m = new Map()));
      let g = m.get(r.id);
      if (!g) m.set(r.id, (g = []));
      g.push(r);
    }
    return [...byLevel.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([l, m]) => ({
        l,
        groups: [...m.values()].map((g) => g.sort((a, b) => a.lv - b.lv)).sort((a, b) => a[0].sk.n.localeCompare(b[0].sk.n)),
      }));
  }, [visible]);
  const levelsInRange = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of listInRange) m.set(r.id, (m.get(r.id) ?? 0) + 1);
    return m;
  }, [listInRange]);

  // ---------- actions ----------
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const inRangeRef = useRef(inRange);
  inRangeRef.current = inRange;

  const actions: SkillActions = useMemo(
    () => ({
      setKeys: (keys, on) =>
        updateSel((cur) => {
          const next = { ...cur };
          for (const k of keys) {
            if (on) next[k] = 1;
            else delete next[k];
          }
          return next;
        }),
      toggleKey: (key) =>
        updateSel((cur) => {
          const next = { ...cur };
          if (next[key]) delete next[key];
          else next[key] = 1;
          return next;
        }),
      toggleOpen: (l, id) =>
        setOpened((s) => {
          const n = new Set(s);
          const k = `${l}:${id}`;
          if (!n.delete(k)) n.add(k);
          return n;
        }),
      setSkillEverywhere: (id, on) =>
        updateSel((cur) => {
          const next = { ...cur };
          for (const r of inRangeRef.current) {
            if (r.id !== id) continue;
            if (on) next[r.key] = 1;
            else delete next[r.key];
          }
          return next;
        }),
      toggleCollapsed: (l) =>
        setCollapsed((s) => {
          const n = new Set(s);
          if (!n.delete(l)) n.add(l);
          return n;
        }),
    }),
    [updateSel],
  );

  const allCollapsed = sections.length > 0 && sections.every((s) => collapsed.has(s.l));

  const gotoLevel = useCallback((l: number) => {
    setCollapsed((s) => {
      const n = new Set(s);
      n.delete(l);
      return n;
    });
    setScrollTo(l);
  }, []);
  useEffect(() => {
    if (scrollTo == null) return;
    document.getElementById(`lvl-${scrollTo}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollTo(null);
  }, [scrollTo, sections]);

  // ---------- render ----------
  const pageRoute =
    view === "loading" ? null
    : view === "skill" ? "/[chronicle]/skill/[id]"
    : view === "calc" ? "/[chronicle]/[class]"
    : "/[chronicle]";
  const nSkills = useMemo(() => new Set(inRange.map((r) => r.id)).size, [inRange]);
  const hidden = listInRange.length - visible.length;

  return (
    <>
      <header className="top">
        <a className="brand" href={hrefFor(activeSlug)}>
          <h1>Lineage 2 skills SP</h1>
          <span className="sub">{t("app.subtitle")}</span>
        </a>
        <SkillSearch data={ready ? data : null} />
        <LanguageSwitch />
      </header>
      <ChronicleBar chronicles={chronicles ?? []} active={activeSlug} onPick={pickChronicle} />
      {/* Vercel Web Analytics: the app routes in the URL hash, so page views are reported per hash route */}
      <Analytics
        mode={import.meta.env.DEV ? "development" : "production"}
        route={pageRoute}
        path={
          view === "loading" ? null
          : view === "skill" ? `/${activeSlug}/skill/${route.skill}`
          : view === "calc" ? `/${activeSlug}/${cls}`
          : `/${activeSlug}`
        }
      />
      {/* Vercel Speed Insights: Web Vitals grouped by the same hash routes */}
      <SpeedInsights route={pageRoute} />

      {error && <div className="error">{errorText(error)}</div>}

      {view === "loading" && !error && <div className="loading">{t("app.loading")}</div>}

      {view === "picker" && data && (
        <ClassPicker
          key={data.slug}
          data={data}
          current={prefs.wanted && data.classes[prefs.wanted] ? prefs.wanted : (prefs.cls[data.slug] ?? null)}
          race={prefs.race}
          onRace={(r) => setPrefs((p) => ({ ...p, race: r }))}
          onPick={pickClass}
        />
      )}

      {view === "skill" && data && route.skill && <SkillPage data={data} id={route.skill} cls={lastCls} />}

      {view === "calc" && data && cls && (
        <>
          <main className={`layout${prefs.view === "chronicles" ? " single" : ""}`}>
            {prefs.view !== "chronicles" && (
            <Sidebar
              data={data}
              cls={cls}
              chain={chain}
              range={range}
              maxLv={maxLv}
              presets={presets}
              totals={totals}
              onOpenClasses={() => navigate(data.slug)}
              onPickClass={pickClass}
              onRange={setRange}
              onGotoLevel={gotoLevel}
            />
            )}

            <section className="panel skills" aria-label={t("app.skills")}>
              <div className="view-tabs" role="tablist" aria-label={t("app.view")}>
                <button type="button" role="tab" aria-selected={prefs.view !== "chronicles"} onClick={() => setPrefs((p) => ({ ...p, view: "skills" }))}>
                  {t("app.tabSkills")}
                </button>
                <button type="button" role="tab" aria-selected={prefs.view === "chronicles"} onClick={() => setPrefs((p) => ({ ...p, view: "chronicles" }))}>
                  {t("app.tabChronicles")}
                </button>
              </div>
              {prefs.view === "chronicles" ? (
                <ChronicleTable
                  cls={cls}
                  data={data}
                  chain={chain}
                  onPickClass={pickClassAnywhere}
                  onChangeClass={() => navigate(data.slug)}
                  chronicles={chronicles ?? []}
                  active={data.slug}
                  onPickChronicle={pickChronicle}
                />
              ) : (
              <>
              <SkillToolbar
                search={search}
                type={prefs.type}
                showZero={prefs.showZero}
                allCollapsed={allCollapsed}
                onSearch={setSearch}
                onType={(t) => setPrefs((p) => ({ ...p, type: t }))}
                onShowZero={(v) => setPrefs((p) => ({ ...p, showZero: v }))}
                onAllOn={() => actions.setKeys(visibleRef.current.map((r) => r.key), true)}
                onAllOff={() => actions.setKeys(visibleRef.current.map((r) => r.key), false)}
                onReset={() => updateSel(() => ({}))}
                onCollapseAll={() => setCollapsed(allCollapsed ? new Set() : new Set(sections.map((s) => s.l)))}
              />
              <div className="status">
                {inRange.length
                  ? [
                      t("app.status", {
                        from,
                        to,
                        skills: t("common.skills", { count: nSkills }),
                        levels: t("common.skillLevels", { count: inRange.length }),
                      }),
                      hidden > 0 && t("app.statusHidden", { n: hidden }),
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : t("app.statusEmpty", { from, to })}
              </div>
              <SkillList
                data={data}
                sections={sections}
                sel={sel}
                collapsed={collapsed}
                opened={opened}
                levelsInRange={levelsInRange}
                actions={actions}
                stale={stale}
              />
              </>
              )}
            </section>
          </main>

          {prefs.view !== "chronicles" && <div className="mobile-bar" aria-hidden="true">
            <span>{t("common.neededSp")}</span>
            <strong>{fmt(totals.sp)}</strong>
          </div>}
        </>
      )}
    </>
  );
}
