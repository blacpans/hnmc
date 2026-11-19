import { ResultAsync } from 'neverthrow';

import { WORKER_MESSAGES } from '@/constants/messages';
import { type WorkerEnv } from '@/schemas/env';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const USER_AGENT = 'hnmc-cron-worker/1.0';

export type FetchLike = typeof fetch;

/**
 * GitHub REST API の workflow_dispatch エンドポイントを叩いて Actions を起動する
 */
export function dispatchWorkflow(env: WorkerEnv, fetchFn: FetchLike = fetch): ResultAsync<void, Error> {
  const url = `${GITHUB_API_BASE}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW_ID}/dispatches`;
  console.log(WORKER_MESSAGES.DISPATCH_START(env.GITHUB_OWNER, env.GITHUB_REPO, env.GITHUB_WORKFLOW_ID));

  return ResultAsync.fromPromise(
    (async () => {
      const res = await fetchFn(url, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: env.GITHUB_REF }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(WORKER_MESSAGES.DISPATCH_FAILED(res.status, errorText));
      }

      console.log(WORKER_MESSAGES.DISPATCH_SUCCESS);
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
}

/**
 * 起動失敗時に Discord へアラート通知を送信し、サイレント失敗を防ぐ
 */
export function notifyDispatchError(
  webhookUrl: string,
  detail: string,
  fetchFn: FetchLike = fetch,
): ResultAsync<void, Error> {
  const payload = {
    embeds: [
      {
        title: WORKER_MESSAGES.ERROR_EMBED_TITLE,
        description: `${WORKER_MESSAGES.ERROR_EMBED_DESCRIPTION}\n\`\`\`\n${detail.slice(0, 1500)}\n\`\`\``,
        color: 0xef4444,
      },
    ],
  };

  return ResultAsync.fromPromise(
    (async () => {
      const res = await fetchFn(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Discord通知送信エラー (${res.status})`);
      }
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
}
