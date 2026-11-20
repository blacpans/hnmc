import { errAsync, okAsync } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import { type InteractionEnv } from '@/schemas/env';
import { handleDiscordInteraction, type InteractionDeps } from '@/services/interactionService';

const mockEnv: InteractionEnv = {
  DISCORD_PUBLIC_KEY: 'a'.repeat(64),
  MICROCMS_SERVICE_DOMAIN: 'test-domain',
  MICROCMS_API_KEY: 'test-patch-key',
  MICROCMS_MANAGEMENT_API_KEY: 'test-mgmt-key',
  MICROCMS_ENDPOINT: 'news',
};

function createInteractionRequest(body: unknown): Request {
  return new Request('https://worker.example.com/interactions', {
    method: 'POST',
    headers: {
      'x-signature-ed25519': 'sig',
      'x-signature-timestamp': '12345',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('handleDiscordInteraction', () => {
  it('署名検証に失敗した場合は 401 を返すこと', async () => {
    const deps: InteractionDeps = {
      verifySignature: async () => false,
      publishArticle: () => okAsync(undefined),
      fetchFn: vi.fn(),
    };
    const ctx = { waitUntil: vi.fn() };

    const res = await handleDiscordInteraction(createInteractionRequest({ type: 1 }), mockEnv, ctx, deps);
    expect(res.status).toBe(401);
  });

  it('PING (type: 1) に対して { type: 1 } を返すこと', async () => {
    const deps: InteractionDeps = {
      verifySignature: async () => true,
      publishArticle: () => okAsync(undefined),
      fetchFn: vi.fn(),
    };
    const ctx = { waitUntil: vi.fn() };

    const res = await handleDiscordInteraction(
      createInteractionRequest({ type: 1, application_id: 'app1', token: 'tok1' }),
      mockEnv,
      ctx,
      deps,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 1 });
  });

  it('ボタン押下 (type: 3) に対してモーダル (type: 9) を返すこと', async () => {
    const deps: InteractionDeps = {
      verifySignature: async () => true,
      publishArticle: () => okAsync(undefined),
      fetchFn: vi.fn(),
    };
    const ctx = { waitUntil: vi.fn() };

    const res = await handleDiscordInteraction(
      createInteractionRequest({
        type: 3,
        application_id: 'app1',
        token: 'tok1',
        data: { custom_id: 'publish_modal:article-123' },
      }),
      mockEnv,
      ctx,
      deps,
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { type: number; data: { custom_id: string } };
    expect(json.type).toBe(9);
    expect(json.data.custom_id).toBe('publish_submit:article-123');
  });

  it('モーダル送信 (type: 5) に対して即座に type: 5 を返し、非同期で記事公開とFollowup送信を行うこと', async () => {
    const publishArticle = vi.fn(() => okAsync(undefined));
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const deps: InteractionDeps = {
      verifySignature: async () => true,
      publishArticle,
      fetchFn,
    };

    const tasks: Promise<unknown>[] = [];
    const ctx = { waitUntil: (promise: Promise<unknown>) => tasks.push(promise) };

    const res = await handleDiscordInteraction(
      createInteractionRequest({
        type: 5,
        application_id: 'app1',
        token: 'tok1',
        data: {
          custom_id: 'publish_submit:article-123',
          components: [{ components: [{ custom_id: 'comment_input', value: '神記事！' }] }],
        },
      }),
      mockEnv,
      ctx,
      deps,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 5 });

    await Promise.all(tasks);
    expect(publishArticle).toHaveBeenCalledWith(mockEnv, 'article-123', '神記事！');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/app1/tok1',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('公開処理が失敗した場合でも Discord Followup でエラー内容を通知すること', async () => {
    const publishArticle = vi.fn(() => errAsync(new Error('403 Forbidden')));
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const deps: InteractionDeps = {
      verifySignature: async () => true,
      publishArticle,
      fetchFn,
    };

    const tasks: Promise<unknown>[] = [];
    const ctx = { waitUntil: (promise: Promise<unknown>) => tasks.push(promise) };

    await handleDiscordInteraction(
      createInteractionRequest({
        type: 5,
        application_id: 'app1',
        token: 'tok1',
        data: {
          custom_id: 'publish_submit:article-999',
          components: [{ components: [{ custom_id: 'comment_input', value: '' }] }],
        },
      }),
      mockEnv,
      ctx,
      deps,
    );

    await Promise.all(tasks);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://discord.com/api/v10/webhooks/app1/tok1',
      expect.objectContaining({
        body: expect.stringContaining('公開に失敗したよ'),
      }),
    );
  });
});
