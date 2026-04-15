import { logger } from "../lib/logger.js";

// Minimale Job-Abstraktion. In Phase 1 nur Typen + Registry, kein echter
// Scheduler. In Phase 3 wird ein `node-cron`- oder BullMQ-Backend eingezogen,
// ohne dass sich die Job-Definitionen ändern.

export interface Job {
  id: string;
  description: string;
  run: () => Promise<void>;
}

const JOBS = new Map<string, Job>();

export function registerJob(job: Job): void {
  JOBS.set(job.id, job);
  logger.info({ jobId: job.id }, "job registered");
}

export function listJobs(): Job[] {
  return Array.from(JOBS.values());
}

export async function runJobNow(id: string): Promise<void> {
  const job = JOBS.get(id);
  if (!job) throw new Error(`Unknown job: ${id}`);
  logger.info({ jobId: id }, "running job");
  await job.run();
  logger.info({ jobId: id }, "job finished");
}
