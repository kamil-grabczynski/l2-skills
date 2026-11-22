import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ChronicleData, ChronicleRef, LevelRange, Row, SkillType } from "./types";
import {
  buildRows, chainOf, chronicleLabel, defaultClass, loadChronicle, loadIndex, maxLevelOf, presetsFor,
} from "./lib/data";
import { usePersistentState, useSelection } from "./lib/storage";
import { hrefFor, navigate, useHashRoute } from "./lib/route";
import { fmt } from "./lib/format";
import { Sidebar, type Totals } from "./components/Sidebar";
import { ClassPicker } from "./components/ClassPicker";
import { SkillToolbar } from "./components/SkillToolbar";
import { SkillList, type Section, type SkillActions } from "./components/SkillList";

interface Prefs {
  chronicle: string;
  /** last class per chronicle (highlighted on the picker) */
  cls: Record<string, string>;
  /** level range per "chronicle/class"; missing = the class's own profession range */
  ranges: Record<string, LevelRange>;
  type: SkillType;
  showZero: boolean;
}

/** C1 unless the visitor already picked a chronicle (saved in localStorage on every pick). */
const DEFAULT_PREFS: Prefs = { chronicle: "c1", cls: {}, ranges: {}, type: "all", showZero: false };

const rangeKey = (slug: string, cls: string) => `${slug}/${cls}`;

/** Forget the saved range so the class opens on its own profession range (e.g. 2nd class: 40-75). */
const withoutRange = (p: Prefs, key: string): Prefs => {
  if (!(key in p.ranges)) return p;
  const ranges = { ...p.ranges };
  delete ranges[key];
  return { ...p, ranges };
};

export default function App() {
  const route = useHashRoute();
  const [chronicles, setChronicles] = useState<ChronicleRef[] | null>(null);
  const [prefs, setPrefs] = usePersistentState<Prefs>("spcalc:prefs", DEFAULT_PREFS);
  const [data, setData] = useState<ChronicleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [scrollTo, setScrollTo] = useState<number | null>(null);

  // ---------- routing & loading ----------
  useEffect(() => {
    loadIndex().then(setChronicles, (e: Error) => setError(e.message));
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
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [activeSlug]);

  const ready = !!data && data.slug === activeSlug;
  const cls = ready && route.cls && data.classes[route.cls] ? route.cls : null;
  const view: "loading" | "picker" | "calc" = !ready ? "loading" : cls ? "calc" : "picker";

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
      setPrefs((p) => withoutRange(p, rangeKey(data.slug, c)));
      navigate(data.slug, c);
      window.scrollTo({ top: 0 });
    },
    [data, setPrefs],
  );

  const pickChronicle = useCallback(
    async (slug: string) => {
      if (view !== "calc") {
        navigate(slug);
        return;
      }
      // stay in the calculator: same class if the chronicle has it, else the one used there last
      try {
        const d = await loadChronicle(slug);
        const target = cls && d.classes[cls] ? cls : prefs.cls[slug] && d.classes[prefs.cls[slug]] ? prefs.cls[slug] : defaultClass(d);
        setPrefs((p) => withoutRange(p, rangeKey(slug, target)));
        navigate(slug, target);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [view, cls, prefs.cls, setPrefs],
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

  const [off, updateOff] = useSelection(cls && activeSlug ? `spcalc:sel2:${activeSlug}:${cls}` : null);

  const inRange = useMemo(() => rows.filter((r) => r.l >= from && r.l <= to), [rows, from, to]);

  const totals: Totals = useMemo(() => {
    let sp = 0, skipped = 0, levels = 0;
    const ids = new Set<number>();
    const per = new Map<number, number>();
    const books: Row[] = [];
    for (const r of inRange) {
      if (off[r.key]) {
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
  }, [inRange, off]);

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
        updateOff((cur) => {
          const next = { ...cur };
          for (const k of keys) {
            if (on) delete next[k];
            else next[k] = 1;
          }
          return next;
        }),
      toggleKey: (key) =>
        updateOff((cur) => {
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
        updateOff((cur) => {
          const next = { ...cur };
          for (const r of inRangeRef.current) {
            if (r.id !== id) continue;
            if (on) delete next[r.key];
            else next[r.key] = 1;
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
    [updateOff],
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
  const nSkills = useMemo(() => new Set(inRange.map((r) => r.id)).size, [inRange]);
  const hidden = listInRange.length - visible.length;

  return (
    <>
      <header className="top">
        <a className="brand" href={hrefFor(activeSlug)}>
          <h1>Lineage 2 skills SP</h1>
          <span className="sub">Kalkulator SP skili · C1 – High Five</span>
        </a>
        <nav className="seg chronicles" aria-label="Kronika">
          {(chronicles ?? []).map((c) => (
            <button type="button" key={c.slug} title={c.name} aria-pressed={c.slug === activeSlug} onClick={() => pickChronicle(c.slug)}>
              {chronicleLabel(c.slug)}
            </button>
          ))}
        </nav>
      </header>

      {error && <div className="error">Błąd: {error}</div>}

      {view === "loading" && !error && <div className="loading">Ładowanie danych…</div>}

      {view === "picker" && data && <ClassPicker key={data.slug} data={data} current={prefs.cls[data.slug] ?? null} onPick={pickClass} />}

      {view === "calc" && data && cls && (
        <>
          <main className="layout">
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

            <section className="panel skills" aria-label="Skile">
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
                onReset={() => updateOff(() => ({}))}
                onCollapseAll={() => setCollapsed(allCollapsed ? new Set() : new Set(sections.map((s) => s.l)))}
              />
              <div className="status">
                {inRange.length
                  ? `Poziomy ${from}–${to}: ${nSkills} skili, ${inRange.length} poziomów skili${hidden ? ` · ukryte przez filtry: ${hidden}` : ""}`
                  : `Brak skili do nauczenia na poziomach ${from}–${to}.`}
              </div>
              <SkillList
                data={data}
                sections={sections}
                off={off}
                collapsed={collapsed}
                opened={opened}
                levelsInRange={levelsInRange}
                actions={actions}
                stale={stale}
              />
            </section>
          </main>

          <div className="mobile-bar" aria-hidden="true">
            <span>Potrzebne SP</span>
            <strong>{fmt(totals.sp)}</strong>
          </div>
        </>
      )}

    </>
  );
}
