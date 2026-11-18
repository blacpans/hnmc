import { err, ok, type Result, ResultAsync } from 'neverthrow';

import {
  type DraftNotificationParams,
  sendDraftNotification,
  sendErrorNotification,
} from '@/clients/discordClient';
import { generateJaSummary } from '@/clients/geminiClient';
import { fetchHnItem, fetchTopStoryIds } from '@/clients/hackerNewsClient';
import { fetchPageMetaDescription } from '@/clients/metaFetcher';
import { checkArticleExists, createDraftArticle } from '@/clients/microCmsClient';
import { CONFIG } from '@/constants/config';
import { MESSAGES } from '@/constants/messages';
import { type EnvConfig } from '@/schemas/env';
import { type GeminiSummary } from '@/schemas/gemini';
import { type HnItem } from '@/schemas/hn';
import { type MicroCmsDraftPayload } from '@/schemas/microcms';

export type SyncDependencies = {
  fetchTopStoryIds: () => ResultAsync<number[], Error>;
  fetchHnItem: (id: number) => ResultAsync<HnItem, Error>;
  fetchPageMetaDescription: (url: string) => ResultAsync<string, Error>;
  generateJaSummary: (
    apiKey: string,
    model: string,
    enTitle: string,
    metaDesc: string,
  ) => ResultAsync<GeminiSummary, Error>;
  checkArticleExists: (domain: string, apiKey: string, hnId: string) => ResultAsync<boolean, Error>;
  createDraftArticle: (domain: string, apiKey: string, payload: MicroCmsDraftPayload) => ResultAsync<string, Error>;
  sendDraftNotification: (webhookUrl: string, params: DraftNotificationParams) => ResultAsync<void, Error>;
  sendErrorNotification: (webhookUrl: string, detail: string) => ResultAsync<void, Error>;
};

export type SyncSummary = {
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  errors: string[];
};

export const defaultSyncDependencies: SyncDependencies = {
  fetchTopStoryIds,
  fetchHnItem,
  fetchPageMetaDescription,
  generateJaSummary,
  checkArticleExists,
  createDraftArticle,
  sendDraftNotification,
  sendErrorNotification,
};

function fetchSafeMeta(item: HnItem, deps: SyncDependencies): ResultAsync<string, Error> {
  if (!item.url) {
    return ResultAsync.fromSafePromise(Promise.resolve(''));
  }

  return deps.fetchPageMetaDescription(item.url).orElse(() => ok(''));
}

function saveDraftAndNotify(
  env: EnvConfig,
  item: HnItem,
  aiResult: GeminiSummary,
  deps: SyncDependencies,
): ResultAsync<string, Error> {
  const hnId = String(item.id);
  const articleUrl = item.url ?? `${CONFIG.HACKER_NEWS_ITEM_WEB_BASE}${hnId}`;
  const payload: MicroCmsDraftPayload = {
    hnId,
    title: item.title,
    jaTitle: aiResult.jaTitle,
    aiSummary: aiResult.summary,
    url: articleUrl,
    score: item.score ?? 0,
    comment: '',
  };

  return deps.createDraftArticle(env.MICROCMS_SERVICE_DOMAIN, env.MICROCMS_API_KEY, payload).andThen((contentId) =>
    deps
      .sendDraftNotification(env.DISCORD_WEBHOOK_URL, {
        serviceDomain: env.MICROCMS_SERVICE_DOMAIN,
        contentId,
        hnId,
        jaTitle: aiResult.jaTitle,
        originalTitle: item.title,
        aiSummary: aiResult.summary,
        articleUrl,
        score: item.score ?? 0,
      })
      .map(() => {
        console.log(MESSAGES.DRAFT_CREATED(aiResult.jaTitle, contentId));
        return contentId;
      }),
  );
}

function processNewItem(env: EnvConfig, item: HnItem, deps: SyncDependencies): ResultAsync<string, Error> {
  console.log(MESSAGES.AI_GENERATING(item.title));

  return fetchSafeMeta(item, deps)
    .andThen((metaDesc) => deps.generateJaSummary(env.GEMINI_API_KEY, env.GEMINI_MODEL, item.title, metaDesc))
    .andThen((aiResult) => saveDraftAndNotify(env, item, aiResult, deps));
}

function processSingleStory(
  env: EnvConfig,
  id: number,
  deps: SyncDependencies,
): ResultAsync<'created' | 'skipped', Error> {
  const hnId = String(id);
  console.log(MESSAGES.CHECKING_ARTICLE(hnId));

  return deps.checkArticleExists(env.MICROCMS_SERVICE_DOMAIN, env.MICROCMS_API_KEY, hnId).andThen((exists) => {
    if (exists) {
      console.log(MESSAGES.SKIP_ALREADY_EXISTS(hnId));
      return ok<'created' | 'skipped', Error>('skipped');
    }

    return deps.fetchHnItem(id).andThen((item) => processNewItem(env, item, deps).map(() => 'created' as const));
  });
}

async function processCandidateStories(
  env: EnvConfig,
  candidates: number[],
  deps: SyncDependencies,
): Promise<SyncSummary> {
  const summary: SyncSummary = { createdCount: 0, skippedCount: 0, failedCount: 0, errors: [] };
  let consecutiveFailures = 0;

  for (const id of candidates) {
    if (summary.createdCount >= CONFIG.MAX_ARTICLES_PER_RUN) {
      break;
    }

    const result = await processSingleStory(env, id, deps);
    if (result.isErr()) {
      const msg = MESSAGES.ARTICLE_FAILED(String(id), result.error.message);
      console.error(msg);
      summary.failedCount += 1;
      summary.errors.push(msg);
      consecutiveFailures += 1;

      if (consecutiveFailures >= CONFIG.MAX_CONSECUTIVE_FAILURES) {
        const abortMsg = MESSAGES.ABORT_CONSECUTIVE_FAILURES(consecutiveFailures);
        console.error(abortMsg);
        summary.errors.push(abortMsg);
        break;
      }
      continue;
    }

    consecutiveFailures = 0;
    if (result.value === 'created') {
      summary.createdCount += 1;
    } else {
      summary.skippedCount += 1;
    }
  }

  return summary;
}

/**
 * Hacker Newsのトレンド記事を取得し、AI要約・下書き登録・Discord通知を一括実行する
 */
export async function runSyncBatch(
  env: EnvConfig,
  deps: SyncDependencies = defaultSyncDependencies,
): Promise<Result<SyncSummary, Error>> {
  console.log(MESSAGES.BATCH_START);
  console.log(MESSAGES.FETCHING_TOP_STORIES);
  const topIdsResult = await deps.fetchTopStoryIds();
  if (topIdsResult.isErr()) {
    await deps.sendErrorNotification(env.DISCORD_WEBHOOK_URL, topIdsResult.error.message);
    return err(topIdsResult.error);
  }

  const candidates = topIdsResult.value.slice(0, CONFIG.MAX_CANDIDATE_SCAN);
  const summary = await processCandidateStories(env, candidates, deps);

  if (summary.failedCount > 0 && summary.createdCount === 0) {
    await deps.sendErrorNotification(env.DISCORD_WEBHOOK_URL, summary.errors.join('\n'));
  }

  console.log(MESSAGES.BATCH_COMPLETE);
  return ok(summary);
}
