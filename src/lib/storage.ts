import { useCallback, useEffect, useState } from "react";
import type { OffMap } from "../types";

/** localStorage can throw (private mode, blocked site data) - every access is guarded. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** State mirrored to localStorage. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = readJson<Partial<T> | null>(key, null);
    return stored && typeof initial === "object" && !Array.isArray(initial)
      ? { ...initial, ...stored }
      : ((stored as T | null) ?? initial);
  });
  useEffect(() => writeJson(key, value), [key, value]);
  return [value, setValue] as const;
}

const EMPTY: OffMap = {};

/**
 * Excluded skill levels for one chronicle + class. Read synchronously on key change so switching
 * class never renders a frame with another class's selection.
 */
export function useSelection(key: string | null) {
  const [byKey, setByKey] = useState<Record<string, OffMap>>({});
  const off = key ? (byKey[key] ?? readJson<OffMap>(key, EMPTY)) : EMPTY;

  // the updater must stay pure (StrictMode runs it twice), so storage is written in an effect
  const update = useCallback(
    (fn: (cur: OffMap) => OffMap) => {
      if (!key) return;
      setByKey((all) => ({ ...all, [key]: fn(all[key] ?? readJson<OffMap>(key, EMPTY)) }));
    },
    [key],
  );

  const changed = key ? byKey[key] : undefined;
  useEffect(() => {
    if (!key || !changed) return;
    if (Object.keys(changed).length) writeJson(key, changed);
    else removeKey(key);
  }, [key, changed]);

  return [off, update] as const;
}
