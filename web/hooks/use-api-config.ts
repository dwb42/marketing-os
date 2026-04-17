"use client";

import { useEffect, useState } from "react";
import { getApiBase, getToken, setApiBase, setToken, DEFAULT_API_BASE } from "@/lib/config";

export function useApiConfig() {
  const [apiBase, setApiBaseState] = useState<string>(DEFAULT_API_BASE);
  const [token, setTokenState] = useState<string>("");

  useEffect(() => {
    setApiBaseState(getApiBase());
    setTokenState(getToken());
  }, []);

  const update = (next: { apiBase?: string; token?: string }) => {
    if (next.apiBase !== undefined) {
      setApiBase(next.apiBase);
      setApiBaseState(next.apiBase || DEFAULT_API_BASE);
    }
    if (next.token !== undefined) {
      setToken(next.token);
      setTokenState(next.token);
    }
  };

  return { apiBase, token, update };
}
