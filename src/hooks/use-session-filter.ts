import { useCallback, useState } from "react";

const PREFIX = "buildesk-filter:";

function readSessionValue(key: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(`${PREFIX}${key}`);
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: string) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(`${PREFIX}${key}`, value);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Persist a single string filter for the browser tab session. */
export function useSessionFilter<T extends string>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [value, setValueState] = useState<T>(() => {
    const stored = readSessionValue(key);
    return stored !== null && stored.length > 0 ? (stored as T) : defaultValue;
  });

  const setValue = useCallback(
    (next: T) => {
      setValueState(next);
      writeSessionValue(key, next);
    },
    [key],
  );

  return [value, setValue];
}

/** Persist multiple string filters as one JSON object for the browser tab session. */
export function useSessionFilterState<T extends Record<string, string>>(
  key: string,
  defaults: T,
): [T, (patch: Partial<T> | ((prev: T) => Partial<T>)) => void] {
  const [state, setState] = useState<T>(() => {
    const stored = readSessionValue(key);
    if (!stored) return defaults;
    try {
      const parsed = JSON.parse(stored) as Partial<T>;
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  });

  const setPatch = useCallback(
    (patch: Partial<T> | ((prev: T) => Partial<T>)) => {
      setState((prev) => {
        const next = {
          ...prev,
          ...(typeof patch === "function" ? patch(prev) : patch),
        };
        writeSessionValue(key, JSON.stringify(next));
        return next;
      });
    },
    [key],
  );

  return [state, setPatch];
}
