import { describe, expect, it, vi } from 'vitest';

import { type InteractionEnv } from '@/schemas/env';
import { type FetchLike, publishArticleWithComment } from '@/services/microCmsPublishService';

const baseEnv: InteractionEnv = {
  DISCORD_PUBLIC_KEY: 'a'.repeat(64),
  MICROCMS_SERVICE_DOMAIN: 'test-domain',
  MICROCMS_API_KEY: 'test-patch-key',
  MICROCMS_MANAGEMENT_API_KEY: 'test-mgmt-key',
  MICROCMS_ENDPOINT: 'news',
  CLOUDFLARE_DEPLOY_HOOK_URL: 'https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/abc',
};

describe('publishArticleWithComment', () => {
  it('コメント更新・公開ステータス変更・Deploy Hook発火を順に実行できること', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => new Response(null, { status: 200 }));

    const result = await publishArticleWithComment(baseEnv, 'art-1', '最高！', fetchFn);

    expect(result.isOk()).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      'https://test-domain.microcms.io/api/v1/news/art-1?status=draft',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      'https://test-domain.microcms-management.io/api/v1/contents/news/art-1/status',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: ['PUBLISH'] }) }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      3,
      baseEnv.CLOUDFLARE_DEPLOY_HOOK_URL,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('コメントが空欄の場合はコメント更新をスキップし、公開とDeploy Hookのみ実行すること', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => new Response(null, { status: 200 }));

    const result = await publishArticleWithComment(baseEnv, 'art-2', '   ', fetchFn);

    expect(result.isOk()).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      'https://test-domain.microcms-management.io/api/v1/contents/news/art-2/status',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      baseEnv.CLOUDFLARE_DEPLOY_HOOK_URL,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
