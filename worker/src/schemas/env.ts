import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import { WORKER_MESSAGES } from '@/constants/messages';

const safeIdentifier = z.string().min(1).regex(/^[a-zA-Z0-9_.-]+$/);

const workerEnvSchema = z.object({
  GITHUB_TOKEN: z.string().min(1),
  GITHUB_OWNER: safeIdentifier,
  GITHUB_REPO: safeIdentifier,
  GITHUB_WORKFLOW_ID: safeIdentifier,
  GITHUB_REF: safeIdentifier.default('main'),
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

/**
 * Cloudflare Workers のバインディング環境変数を検証して返す
 */
export function parseWorkerEnv(rawEnv: unknown): Result<WorkerEnv, Error> {
  const parsed = workerEnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    return err(new Error(`${WORKER_MESSAGES.ENV_INVALID}: ${parsed.error.message}`));
  }

  return ok(parsed.data);
}
