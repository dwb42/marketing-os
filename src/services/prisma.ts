import { PrismaClient } from "@prisma/client";
import { loadEnv } from "../config/env.js";

loadEnv();

// Singleton PrismaClient. Vermeidet Connection-Flooding bei tsx-watch-Neustarts.
declare global {
  // eslint-disable-next-line no-var
  var __mos_prisma__: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__mos_prisma__ ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") {
  globalThis.__mos_prisma__ = prisma;
}
