import { describe, expect, it, vi } from 'vitest';

import { parseWorkerEnv } from '@/schemas/env';
import { dispatchWorkflow, type FetchLike, notifyDispatchError } from '@/services/dispatchService';

describe('parseWorkerEnv', () => {
  it('必須パラメータが揃っている場合に正常に検証できること', () => {
    const result = parseWorkerEnv({
      GITHUB_TOKEN: 'github_pat_123',
      GITHUB_OWNER: 'blacpans',
      GITHUB_REPO: 'hnmc',
      GITHUB_WORKFLOW_ID: 'sync-hn.yml',
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.GITHUB_REF).toBe('main');
    }
  });

  it('オーナー名に不正な文字が含まれている場合はエラーを返すこと', () => {
    const result = parseWorkerEnv({
      GITHUB_TOKEN: 'github_pat_123',
      GITHUB_OWNER: 'blacpans/evil',
      GITHUB_REPO: 'hnmc',
      GITHUB_WORKFLOW_ID: 'sync-hn.yml',
    });

    expect(result.isErr()).toBe(true);
  });
});

describe('dispatchWorkflow', () => {
  it('GitHub workflow_dispatch API を正しいヘッダーとボディで呼び出せること', async () => {
    const mockFetch = vi.fn<FetchLike>(async () => new Response(null, { status: 204 }));
    const envResult = parseWorkerEnv({
      GITHUB_TOKEN: 'github_pat_test',
      GITHUB_OWNER: 'blacpans',
      GITHUB_REPO: 'hnmc',
      GITHUB_WORKFLOW_ID: 'sync-hn.yml',
      GITHUB_REF: 'main',
    });

    if (envResult.isErr()) {
      throw envResult.error;
    }

    const result = await dispatchWorkflow(envResult.value, mockFetch);

    expect(result.isOk()).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/blacpans/hnmc/actions/workflows/sync-hn.yml/dispatches',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ref: 'main' }),
      }),
    );
  });

  it('GitHub API がエラーを返した場合は Err を返すこと', async () => {
    const mockFetch = vi.fn<FetchLike>(async () => new Response('Unauthorized', { status: 401 }));
    const envResult = parseWorkerEnv({
      GITHUB_TOKEN: 'invalid_token',
      GITHUB_OWNER: 'blacpans',
      GITHUB_REPO: 'hnmc',
      GITHUB_WORKFLOW_ID: 'sync-hn.yml',
    });

    if (envResult.isErr()) {
      throw envResult.error;
    }

    const result = await dispatchWorkflow(envResult.value, mockFetch);
    expect(result.isErr()).toBe(true);
  });
});

describe('notifyDispatchError', () => {
  it('Discord Webhook へエラー通知を送信できること', async () => {
    const mockFetch = vi.fn<FetchLike>(async () => new Response(null, { status: 204 }));
    const result = await notifyDispatchError('https://discord.com/api/webhooks/1/a', 'HTTP 401', mockFetch);

    expect(result.isOk()).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
