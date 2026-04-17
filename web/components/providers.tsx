"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { CmdkProvider } from "@/components/cmd-k/context";
import { CommandPalette } from "@/components/cmd-k/command-palette";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={client}>
        <CmdkProvider>
          {children}
          <CommandPalette />
          <KeyboardShortcuts />
        </CmdkProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
