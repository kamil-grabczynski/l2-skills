import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ChronicleData } from "../types";
import { chronicleLabel } from "../lib/data";
import { navigate } from "../lib/route";
import { Combobox } from "./Combobox";
import { SkillIcon } from "./ClassIcon";

interface Hit {
  id: string;
  name: string;
  icon: string;
  passive: boolean;
  /** classes that learn the skill themselves (not through an earlier profession) */
  classes: string;
  lowName: string;
  /** name and classes, lower case */
  text: string;
}

function skillIndex(data: ChronicleData): Hit[] {
  const classes = new Map<number, Set<string>>();
  for (const c of Object.values(data.classes)) {
    for (const [, id] of c.rows) {
      let set = classes.get(id);
      if (!set) classes.set(id, (set = new Set()));
      set.add(c.name);
    }
  }
  return Object.entries(data.skills).map(([id, sk]) => {
    const names = [...(classes.get(Number(id)) ?? [])].join(", ");
    return {
      id, name: sk.n, icon: sk.i, passive: !!sk.p, classes: names,
      lowName: sk.n.toLowerCase(), text: `${sk.n} ${names}`.toLowerCase(),
    };
  });
}

/** Search in the header over the skills of every class of the chronicle; picking one opens its page. */
export function SkillSearch({ data }: { data: ChronicleData | null }) {
  const { t } = useTranslation();
  const index = useMemo(() => (data ? skillIndex(data) : []), [data]);

  const search = useCallback(
    (query: string, limit: number) => {
      const q = query.toLowerCase();
      const words = q.split(/\s+/);
      // whole name starts with the text, then the name has every word, then words found in class names
      const rank = (h: Hit) => (h.lowName.startsWith(q) ? 0 : words.every((w) => h.lowName.includes(w)) ? 1 : 2);
      return index
        .filter((h) => words.every((w) => h.text.includes(w)))
        .map((h) => [rank(h), h] as const)
        .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
        .slice(0, limit)
        .map(([, h]) => h);
    },
    [index],
  );

  return (
    <div className="top-search" role="search">
      <Combobox
        label={t("skillSearch.label")}
        placeholder={t("skillSearch.placeholder", { chronicle: data ? chronicleLabel(data.slug) : "" })}
        disabled={!data}
        search={search}
        itemKey={(h) => h.id}
        empty={(query) => t("skillSearch.empty", { query, chronicle: data?.name ?? "" })}
        onPick={(h) => data && navigate(data.slug, `skill/${h.id}`)}
        render={(h) => (
          <>
            <SkillIcon file={h.icon} />
            <span className="combo-text">
              <span>
                {h.name}
                <span className={`tag ${h.passive ? "p" : "a"}`}>{h.passive ? t("common.passive") : t("common.active")}</span>
              </span>
              {h.classes && <small>{h.classes}</small>}
            </span>
          </>
        )}
      />
    </div>
  );
}
