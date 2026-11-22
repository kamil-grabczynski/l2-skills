import { useEffect, useState } from "react";

/**
 * Hash routes:
 *   #/                       class picker (start page)
 *   #/<chronicle>            class picker for that chronicle
 *   #/<chronicle>/<class>    SP calculator for that class
 * Hash routing keeps browser Back working and needs no server configuration.
 */
export interface Route {
  slug: string | null;
  cls: string | null;
}

function parse(hash: string): Route {
  const [slug = null, cls = null] = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { slug, cls };
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
