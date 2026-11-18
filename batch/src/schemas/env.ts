import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import { CONFIG } from '@/constants/config';
import { MESSAGES } from '@/constants/messages';

const envSchema = z.object({
  MICROCMS_SERVICE_DOMAIN: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9-]+$/, 'サービスドメインは英数字とハイフンのみ指定可能だよ'),
  MICROCMS_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Geminiモデル名は英数字と ._- のみ指定可能だよ')
    .default(CONFIG.DEFAULT_GEMINI_MODEL),
  DISCORD_WEBHOOK_URL: z.string().url(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * 実行時環境変数を厳格に検証して返す
 */
export function loadEnvConfig(rawEnv: Record<string, string | undefined>): Result<EnvConfig, Error> {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    return err(new Error(`${MESSAGES.ENV_INVALID}: ${parsed.error.message}`));
  }

  return ok(parsed.data);
}
