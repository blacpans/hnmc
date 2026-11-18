import { errAsync, okAsync } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import { type EnvConfig } from '@/schemas/env';
import { runSyncBatch, type SyncDependencies } from '@/services/syncService';

const mockEnv: EnvConfig = {
  MICROCMS_SERVICE_DOMAIN: 'test-service',
  MICROCMS_API_KEY: 'test-api-key',
  GEMINI_API_KEY: 'test-gemini-key',
  DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc',
};

function createMockDependencies(overrides: Partial<SyncDependencies> = {}): SyncDependencies {
  return {
    fetchTopStoryIds: () => okAsync([101, 102]),
    fetchHnItem: (id) =>
      okAsync({
        id,
        title: `English Title ${id}`,
        url: `https://example.com/article-${id}`,
        score: 250,
      }),
    fetchPageMetaDescription: () => okAsync('Article meta description'),
    generateJaSummary: (_key, enTitle) =>
      okAsync({
        jaTitle: `日本語: ${enTitle}`,
        summary: '・要約1\n・要約2\n・要約3',
      }),
    checkArticleExists: () => okAsync(false),
    createDraftArticle: (_domain, _key, payload) => okAsync(`cms-${payload.hnId}`),
    sendDraftNotification: () => okAsync(undefined),
    sendErrorNotification: () => okAsync(undefined),
    ...overrides,
  };
}

describe('runSyncBatch', () => {
  it('未登録記事を取得・要約・下書き登録し、Discordへ通知できること', async () => {
    const sendDraftNotification = vi.fn(() => okAsync(undefined));
    const deps = createMockDependencies({ sendDraftNotification });

    const result = await runSyncBatch(mockEnv, deps);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.createdCount).toBe(2);
      expect(result.value.skippedCount).toBe(0);
      expect(result.value.failedCount).toBe(0);
    }
    expect(sendDraftNotification).toHaveBeenCalledTimes(2);
    expect(sendDraftNotification).toHaveBeenCalledWith(
      mockEnv.DISCORD_WEBHOOK_URL,
      expect.objectContaining({
        contentId: 'cms-101',
        serviceDomain: 'test-service',
      }),
    );
  });

  it('すでにmicroCMSに登録済みの記事はスキップされること', async () => {
    const createDraftArticle = vi.fn(() => okAsync('cms-id'));
    const deps = createMockDependencies({
      checkArticleExists: (_domain, _key, hnId) => okAsync(hnId === '101'),
      createDraftArticle,
    });

    const result = await runSyncBatch(mockEnv, deps);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.createdCount).toBe(1);
      expect(result.value.skippedCount).toBe(1);
    }
    expect(createDraftArticle).toHaveBeenCalledTimes(1);
  });

  it('メタデータ取得に失敗しても空文字にフォールバックして処理を継続すること', async () => {
    const generateJaSummary = vi.fn(() =>
      okAsync({ jaTitle: '翻訳済み', summary: '・要約1\n・要約2\n・要約3' }),
    );
    const deps = createMockDependencies({
      fetchTopStoryIds: () => okAsync([101]),
      fetchPageMetaDescription: () => errAsync(new Error('Timeout')),
      generateJaSummary,
    });

    const result = await runSyncBatch(mockEnv, deps);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.createdCount).toBe(1);
    }
    expect(generateJaSummary).toHaveBeenCalledWith(mockEnv.GEMINI_API_KEY, 'English Title 101', '');
  });

  it('トップ記事一覧の取得に失敗した際はDiscordへエラー通知を送ること', async () => {
    const sendErrorNotification = vi.fn(() => okAsync(undefined));
    const deps = createMockDependencies({
      fetchTopStoryIds: () => errAsync(new Error('HN API Down')),
      sendErrorNotification,
    });

    const result = await runSyncBatch(mockEnv, deps);

    expect(result.isErr()).toBe(true);
    expect(sendErrorNotification).toHaveBeenCalledWith(mockEnv.DISCORD_WEBHOOK_URL, 'HN API Down');
  });

  it('全記事の処理に失敗した際はDiscordへエラー通知を送ること', async () => {
    const sendErrorNotification = vi.fn(() => okAsync(undefined));
    const deps = createMockDependencies({
      fetchTopStoryIds: () => okAsync([101]),
      generateJaSummary: () => errAsync(new Error('Gemini Rate Limit')),
      sendErrorNotification,
    });

    const result = await runSyncBatch(mockEnv, deps);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.failedCount).toBe(1);
      expect(result.value.createdCount).toBe(0);
    }
    expect(sendErrorNotification).toHaveBeenCalledTimes(1);
  });
});
