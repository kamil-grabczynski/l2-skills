import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

const LIMIT = 60;

interface Props<T> {
  label: string;
  placeholder: string;
  disabled?: boolean;
  /** matching items, best first, at most `limit` */
  search: (query: string, limit: number) => T[];
  itemKey: (item: T) => string | number;
  render: (item: T) => ReactNode;
  /** text when nothing matches */
  empty: (query: string) => string;
  onPick: (item: T) => void;
}

/** Text field with a list of matching items, usable with the mouse and the keyboard. */
export function Combobox<T>({ label, placeholder, disabled, search, itemKey, render, empty, onPick }: Props<T>) {
  const { t } = useTranslation();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const q = useDeferredValue(query.trim());
  const hits = useMemo(() => (q ? search(q, LIMIT) : []), [search, q]);
  const shown = open && q !== "";

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    if (!shown) return;
    box.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [shown, active]);

  const pick = (item: T | undefined) => {
    if (item === undefined) return;
    onPick(item);
    setQuery("");
    setOpen(false);
  };

  return (
    <div
      className="combo"
      ref={box}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <input
        type="search"
        role="combobox"
        autoComplete="off"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && hits[active] !== undefined ? `${listId}-${active}` : undefined}
        aria-label={label}
        placeholder={placeholder}
        disabled={disabled}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!hits.length) return;
            setOpen(true);
            setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(hits[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {shown && (
        <ul id={listId} role="listbox" aria-label={label}>
          {hits.map((item, i) => (
            <li
              key={itemKey(item)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                // keep the focus in the field until the item is picked
                e.preventDefault();
                if (e.button === 0) pick(item);
              }}
            >
              {render(item)}
            </li>
          ))}
          {!hits.length && <li className="none">{empty(q)}</li>}
          {hits.length === LIMIT && <li className="none">{t("common.searchMore")}</li>}
        </ul>
      )}
    </div>
  );
}
