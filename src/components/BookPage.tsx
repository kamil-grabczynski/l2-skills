import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { BookInfo, ChronicleData } from "../types";
import { bookKind, bookName, chronicleLabel, errorText, loadBooks } from "../lib/data";
import { hrefFor, skillHref } from "../lib/route";
import { fmt } from "../lib/format";
import { ItemIcon, SkillIcon } from "./ClassIcon";

interface Props {
  data: ChronicleData;
  id: string;
  /** class to go back to, null = class picker */
  cls: string | null;
}

/** Skill level the book teaches, with the classes that learn it this way. */
interface Use {
  skill: number;
  lv: number;
  l: number;
  classes: string[];
}

const DROPS_SHOWN = 25;

function usesOf(data: ChronicleData, book: number): Use[] {
  const out: Use[] = [];
  for (const c of Object.values(data.classes)) {
    for (const [l, skill, lv, , b] of c.rows) {
      if (b !== book) continue;
      const same = out.find((u) => u.skill === skill && u.lv === lv && u.l === l);
      if (same) same.classes.push(c.name);
      else out.push({ skill, lv, l, classes: [c.name] });
    }
  }
  return out.sort((a, b) => a.l - b.l || a.lv - b.lv);
}


const pct = (x: number) => (x >= 1 ? x.toFixed(x >= 10 ? 1 : 2) : x >= 0.01 ? x.toFixed(3) : x.toPrecision(2)).replace(".", ",");

/** Page of one spellbook (amulet, ancient book…): what it teaches and where to get it. */
export function BookPage({ data, id, cls }: Props) {
  const { t, i18n } = useTranslation();
  const [books, setBooks] = useState<Record<string, BookInfo> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [allDrops, setAllDrops] = useState(false);

  useEffect(() => {
    let alive = true;
    setBooks(null);
    setError(null);
    loadBooks(data.slug).then(
      (b) => alive && setBooks(b),
      (e: Error) => alive && setError(e),
    );
    return () => {
      alive = false;
    };
  }, [data.slug]);

  const uses = useMemo(() => usesOf(data, +id), [data, id]);
  const name = bookName(data, id);
  const kind = bookKind(name);
  const info = books?.[id];

  const back = (
    <a className="back" href={hrefFor(data.slug, cls)}>
      ← {cls ? data.classes[cls].name : t("picker.label")}
    </a>
  );

  if (!data.books[id] && !uses.length) {
    return (
      <main className="skill-page">
        {back}
        <section className="panel sk-block">
          <h2>{t("book.missing", { chronicle: chronicleLabel(data.slug) })}</h2>
          <p className="hint">{t("skill.missingHint")}</p>
        </section>
      </main>
    );
  }

  const drops = info?.drop ?? [];
  const shownDrops = allDrops ? drops : drops.slice(0, DROPS_SHOWN);

  return (
    <main className="skill-page book-page">
      {back}
      <section className="panel sk-head">
        <ItemIcon icon={data.bi?.[id]} className="icon item-lg" />
        <div>
          <h2>{name.replace(/^[^:]+:\s*/, "") || name}</h2>
          <div className="line1">
            {kind && <span className="tag book">{kind}</span>}
            <span className="lvl-meta">
              {chronicleLabel(data.slug)} · item {id}
              {!!info?.p && ` · ${t("book.price", { price: fmt(info.p) })}`}
            </span>
          </div>
          {info?.d && <p className="book-desc">{info.d}</p>}
        </div>
      </section>

      <section className="panel sk-block">
        <h2>{t("book.teaches")}</h2>
        {uses.length ? (
          <ul className="book-uses">
            {uses.map((u) => {
              const sk = data.skills[u.skill];
              return (
                <li key={`${u.skill}-${u.lv}-${u.l}`}>
                  <SkillIcon file={sk?.i ?? ""} />
                  <span>
                    <a className="skill-link" href={skillHref(data.slug, u.skill)}>
                      {sk?.n ?? `Skill ${u.skill}`}
                    </a>{" "}
                    <b className="gold">Lv {u.lv}</b>
                    <small>
                      {t("skill.learnLevel", { level: u.l })} · {u.classes.join(", ")}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="hint">{t("book.noUse")}</p>
        )}
      </section>

      {error && <div className="error">{errorText(error)}</div>}
      {!books && !error && <div className="loading">{t("app.loading")}</div>}

      {books && (
        <>
          {!!info?.quest?.length && (
            <section className="panel sk-block">
              <h2>{t("book.quests", { n: info.quest.length })}</h2>
              <ul className="book-quests">
                {info.quest.map(([qid, title, lv, npc]) => (
                  <li key={qid}>
                    <span className="quest-mark" aria-hidden="true">!</span>
                    <div>
                      <b>{title}</b> <span className="lvl-meta">{t("book.questLevel", { level: lv })}</span>
                      <small>{t("book.questStart", { npc })}</small>
                      {i18n.exists(`book.quest${qid}`) && <p>{t(`book.quest${qid}` as "book.quest334", { item: name })}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel sk-block">
            <h2>{t("book.shops", { n: info?.shop.length ?? 0 })}</h2>
            {info?.shop.length ? (
              <div className="sk-scroll">
                <table className="sk-levels book-table">
                  <thead>
                    <tr>
                      <th>{t("book.npc")}</th>
                      <th>{t("book.town")}</th>
                      <th className="n">{t("book.cost")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.shop.map(([npc, title, town, price]) => (
                      <tr key={`${npc}-${town}`}>
                        <td>
                          {npc}
                          {title && <small>{title}</small>}
                        </td>
                        <td>{town || "—"}</td>
                        <td className="n adena">{price ? fmt(price) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="hint">{t("book.noShop")}</p>
            )}
          </section>

          <section className="panel sk-block">
            <h2>{t("book.drops", { n: drops.length })}</h2>
            {drops.length ? (
              <>
                <div className="sk-scroll">
                  <table className="sk-levels book-table">
                    <thead>
                      <tr>
                        <th>{t("book.monster")}</th>
                        <th className="n">Lv</th>
                        <th className="n">{t("book.chance")}</th>
                        <th className="n">{t("book.count")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownDrops.map(([npc, mob, lv, chance, min, max]) => (
                        <tr key={npc}>
                          <td>{mob}</td>
                          <td className="n">{lv}</td>
                          <td className="n">
                            <span className="chance-bar" style={{ "--w": `${Math.min(100, Math.max(2, chance))}%` } as CSSProperties} />
                            {pct(chance)}%
                          </td>
                          <td className="n">{min === max ? min : `${min}–${max}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {drops.length > DROPS_SHOWN && (
                  <button type="button" className="sk-reset book-more" onClick={() => setAllDrops((v) => !v)}>
                    {allDrops ? t("book.fewerDrops") : t("book.allDrops", { n: drops.length })}
                  </button>
                )}
              </>
            ) : (
              <p className="hint">{info?.quest?.length ? t("book.noDropQuest") : t("book.noDrop")}</p>
            )}
            <p className="hint book-source">{t("book.source")}</p>
          </section>
        </>
      )}
    </main>
  );
}
