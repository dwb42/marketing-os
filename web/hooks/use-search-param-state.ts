"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Like useState, but the value is mirrored to a URL searchParam so it
 * survives reload and is shareable. Pass `defaultValue` for the "unset"
 * state — when the value equals defaultValue, the param is removed from
 * the URL to keep things clean.
 *
 * Values are strings only; convert at the call site if needed.
 */
export function useSearchParamState(
  key: string,
  defaultValue = "",
): [string, (v: string) => void] {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get(key) ?? defaultValue;
  const [value, setValue] = useState<string>(urlValue);

  // Sync state when URL changes externally (back/forward, cmd+click-reset).
  useEffect(() => {
    setValue(urlValue);
  }, [urlValue]);

  const update = useCallback(
    (next: string) => {
      setValue(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === defaultValue || next === "") {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [key, defaultValue, router, searchParams],
  );

  return [value, update];
}
