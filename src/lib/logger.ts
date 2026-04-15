import pino from "pino";
import { loadEnv } from "../config/env.js";

const env = loadEnv();

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "marketing-os" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
