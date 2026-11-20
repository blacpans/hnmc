import { okAsync, ResultAsync } from 'neverthrow';

import { type InteractionEnv } from '@/schemas/env';

export type FetchLike = typeof fetch;

function patchJson(
  url: string,
  apiKey: string,
  body: unknown,
  fetchFn: FetchLike,
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const res = await fetchFn(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-MICROCMS-API-KEY': apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`microCMS更新エラー (${res.status}): ${text}`);
      }
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
}

/**
 * 下書きコンテンツの comment フィールドを更新する
 */
export function updateDraftComment(
  env: InteractionEnv,
  contentId: string,
  comment: string,
  fetchFn: FetchLike = fetch,
): ResultAsync<void, Error> {
  const safeId = encodeURIComponent(contentId);
  const url = `https://${env.MICROCMS_SERVICE_DOMAIN}.microcms.io/api/v1/${env.MICROCMS_ENDPOINT}/${safeId}?status=draft`;

  return patchJson(url, env.MICROCMS_API_KEY, { comment }, fetchFn);
}

/**
 * microCMS Management API を用いて下書きコンテンツを公開状態（PUBLISH）に変更する
 */
export function publishContentStatus(
  env: InteractionEnv,
  contentId: string,
  fetchFn: FetchLike = fetch,
): ResultAsync<void, Error> {
  const safeId = encodeURIComponent(contentId);
  const url = `https://${env.MICROCMS_SERVICE_DOMAIN}.microcms-management.io/api/v1/contents/${env.MICROCMS_ENDPOINT}/${safeId}/status`;

  return patchJson(url, env.MICROCMS_MANAGEMENT_API_KEY, { status: ['PUBLISH'] }, fetchFn);
}

/**
 * Cloudflare Pages の Deploy Hook を叩いて静的サイトを再ビルドする
 */
export function triggerDeployHook(
  deployHookUrl: string,
  fetchFn: FetchLike = fetch,
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const res = await fetchFn(deployHookUrl, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Cloudflare Deploy Hookエラー (${res.status}): ${text}`);
      }
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
}

/**
 * ひとことコメントを反映（入力時のみ）した上で公開し、Deploy Hook が設定されていればビルドを起動する
 */
export function publishArticleWithComment(
  env: InteractionEnv,
  contentId: string,
  comment: string,
  fetchFn: FetchLike = fetch,
): ResultAsync<void, Error> {
  const trimmedComment = comment.trim();
  const updateStep = trimmedComment
    ? updateDraftComment(env, contentId, trimmedComment, fetchFn)
    : okAsync<void, Error>(undefined);

  return updateStep
    .andThen(() => publishContentStatus(env, contentId, fetchFn))
    .andThen(() =>
      env.CLOUDFLARE_DEPLOY_HOOK_URL
        ? triggerDeployHook(env.CLOUDFLARE_DEPLOY_HOOK_URL, fetchFn)
        : okAsync<void, Error>(undefined),
    );
}
