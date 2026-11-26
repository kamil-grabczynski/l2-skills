import { useEffect, useState } from "react";

/**
 * Hash routes:
 *   #/                       class picker (start page)
 *   #/<chronicle>            class picker for that chronicle
 *   #/<chronicle>/<class>    SP calculator for that class
 *   #/<chronicle>/skill/<id> page of one skill
 *   #/<chronicle>/book/<id>  page of one spellbook (amulet, ancient book…): where to get it
 * Hash routing keeps browser Back working and needs no server configuration.
 */
export interface Route {
  slug: string | null;
  cls: string | null;
  skill: string | null;
  book: string | null;
}

function parse(hash: string): Route {
  const [slug = null, cls = null, id = null] = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (cls === "skill" && id) return { slug, cls: null, skill: id, book: null };
  if (cls === "book" && id) return { slug, cls: null, skill: null, book: id };
  return { slug, cls, skill: null, book: null };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const hrefFor = (slug?: string | null, cls?: string | null) =>
  slug ? (cls ? `#/${slug}/${cls}` : `#/${slug}`) : "#/";

export const skillHref = (slug: string, id: number | string) => hrefFor(slug, `skill/${id}`);
export const bookHref = (slug: string, id: number | string) => hrefFor(slug, `book/${id}`);

export function navigate(slug?: string | null, cls?: string | null, replace = false) {
  const href = hrefFor(slug, cls);
  if (window.location.hash === href) return;
  if (replace) {
    history.replaceState(null, "", href);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = href;
  }
}
