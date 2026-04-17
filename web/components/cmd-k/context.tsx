"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface CmdkCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
}

const Ctx = createContext<CmdkCtx | null>(null);

export function CmdkProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <Ctx.Provider value={{ open, setOpen, toggle }}>{children}</Ctx.Provider>;
}

export function useCmdk(): CmdkCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCmdk must be used inside CmdkProvider");
  return ctx;
}
