import { buildServer } from "./api/server.js";
import { loadEnv } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { registerJob } from "./jobs/scheduler.js";
import { dailyPerformancePull } from "./jobs/daily-performance-pull.js";

async function main() {
  const env = loadEnv();
  registerJob(dailyPerformancePull);

  const app = await buildServer();
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    logger.error({ err }, "failed to start server");
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
