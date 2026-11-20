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

const interactionEnvSchema = z.object({
  DISCORD_PUBLIC_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Ed25519公開鍵は64文字のHexだよ'),
  MICROCMS_SERVICE_DOMAIN: z.string().regex(/^[a-zA-Z0-9-]+$/),
  MICROCMS_API_KEY: z.string().min(1),
  MICROCMS_MANAGEMENT_API_KEY: z.string().min(1),
  MICROCMS_ENDPOINT: safeIdentifier.default('news'),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export type InteractionEnv = z.infer<typeof interactionEnvSchema>;

/**
 * Cron Trigger 用のバインディング環境変数を検証して返す
 */
export function parseWorkerEnv(rawEnv: unknown): Result<WorkerEnv, Error> {
  const parsed = workerEnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    return err(new Error(`${WORKER_MESSAGES.ENV_INVALID}: ${parsed.error.message}`));
  }

  return ok(parsed.data);
}

/**
 * Discord Interactions Endpoint 用のバインディング環境変数を検証して返す
 */
export function parseInteractionEnv(rawEnv: unknown): Result<InteractionEnv, Error> {
  const parsed = interactionEnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    return err(new Error(`${WORKER_MESSAGES.ENV_INVALID}: ${parsed.error.message}`));
  }

  return ok(parsed.data);
}
