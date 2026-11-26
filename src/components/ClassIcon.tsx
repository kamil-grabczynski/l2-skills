import { useState } from "react";
import type { ChronicleData } from "../types";
import { bookName, classIconUrl, itemIconUrl, skillIconUrl } from "../lib/data";
import { bookHref } from "../lib/route";

export function ClassIcon({ icon, size }: { icon?: string; size: "sm" | "lg" }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`cls-icon cls-icon-${size}`}>
      {icon && !broken && <img alt="" src={classIconUrl(icon)} onError={() => setBroken(true)} />}
    </span>
  );
}

export function SkillIcon({ file }: { file: string }) {
  const [broken, setBroken] = useState(false);
  return file && !broken ? (
    <img className="icon" alt="" loading="lazy" decoding="async" src={skillIconUrl(file)} onError={() => setBroken(true)} />
  ) : (
    <span className="icon" />
  );
}

/** Game icon of a spellbook, amulet or other item; an empty slot when the wiki has none. */
export function ItemIcon({ icon, className = "item-icon" }: { icon?: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  return icon && !broken ? (
    <img className={className} alt="" loading="lazy" decoding="async" src={itemIconUrl(icon)} onError={() => setBroken(true)} />
  ) : (
    <span className={className} />
  );
}

/** Book name with its icon, linking to the page that says where to get it. */
export function BookLink({ data, id, short }: { data: ChronicleData; id: number; short?: boolean }) {
  const name = bookName(data, id);
  return (
    <a className="book-link" href={bookHref(data.slug, id)} title={name}>
      <ItemIcon icon={data.bi?.[id]} />
      <span>{short ? name.replace(/^[^:]+:\s*/, "") : name}</span>
    </a>
  );
}
