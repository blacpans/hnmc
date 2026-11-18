import { ResultAsync } from 'neverthrow';
import { type z } from 'zod';

/**
 * 外部APIからJSONを取得し、Zodスキーマで厳格に検証してResultAsyncで返す
 */
export function fetchJsonWithSchema<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): ResultAsync<T, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const res = await fetch(url, init);
      if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(`HTTP ${res.status} (${url}): ${bodyText}`);
      }

      const rawJson: unknown = await res.json();
      const parsed = schema.safeParse(rawJson);
      if (!parsed.success) {
        throw new Error(`レスポンスの形式が不正だよ (${url}): ${parsed.error.message}`);
      }

      return parsed.data;
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
}
