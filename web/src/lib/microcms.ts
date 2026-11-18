import { createClient } from 'microcms-js-sdk';
import { err, ok, type Result, ResultAsync } from 'neverthrow';

import { SITE_CONFIG } from '@/constants/site';
import { microCmsNewsListSchema, type NewsItem } from '@/schemas/news';

function getMicroCmsEnv(): Result<{ serviceDomain: string; apiKey: string }, Error> {
  const serviceDomain = import.meta.env.MICROCMS_SERVICE_DOMAIN;
  const apiKey = import.meta.env.MICROCMS_API_KEY;

  if (!serviceDomain || !apiKey) {
    return err(new Error('MICROCMS_SERVICE_DOMAIN または MICROCMS_API_KEY が未設定だよ'));
  }

  return ok({ serviceDomain, apiKey });
}

function fetchNewsPage(
  serviceDomain: string,
  apiKey: string,
  offset: number,
): ResultAsync<{ contents: NewsItem[]; totalCount: number }, Error> {
  const client = createClient({ serviceDomain, apiKey });

  return ResultAsync.fromPromise(
    client.getList<NewsItem>({
      endpoint: SITE_CONFIG.MICROCMS_ENDPOINT,
      queries: {
        limit: SITE_CONFIG.FETCH_PAGE_LIMIT,
        offset,
        orders: '-publishedAt',
      },
    }),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  ).andThen((rawResponse) => {
    const parsed = microCmsNewsListSchema.safeParse(rawResponse);
    if (!parsed.success) {
      return err(new Error(`microCMSレスポンス検証エラー: ${parsed.error.message}`));
    }

    return ok({
      contents: parsed.data.contents,
      totalCount: parsed.data.totalCount,
    });
  });
}

/**
 * 公開済みの全記事をページングしながらmicroCMSから取得する
 */
export async function fetchAllPublishedNews(): Promise<Result<NewsItem[], Error>> {
  const envResult = getMicroCmsEnv();
  if (envResult.isErr()) {
    return err(envResult.error);
  }

  const { serviceDomain, apiKey } = envResult.value;
  const allItems: NewsItem[] = [];
  let offset = 0;

  while (true) {
    const pageResult = await fetchNewsPage(serviceDomain, apiKey, offset);
    if (pageResult.isErr()) {
      return err(pageResult.error);
    }

    allItems.push(...pageResult.value.contents);
    offset += SITE_CONFIG.FETCH_PAGE_LIMIT;

    if (offset >= pageResult.value.totalCount) {
      break;
    }
  }

  return ok(allItems);
}
