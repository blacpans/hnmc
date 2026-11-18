import { type ResultAsync } from 'neverthrow';

import { CONFIG } from '@/constants/config';
import { type HnItem, hnItemSchema, hnTopStoriesSchema } from '@/schemas/hn';
import { fetchJsonWithSchema } from '@/utils/http';

/**
 * Hacker Newsのトップ記事ID一覧を取得する
 */
export function fetchTopStoryIds(): ResultAsync<number[], Error> {
  const url = `${CONFIG.HACKER_NEWS_API_BASE}/topstories.json`;
  return fetchJsonWithSchema(url, hnTopStoriesSchema);
}

/**
 * 指定されたIDのHacker News記事詳細を取得する
 */
export function fetchHnItem(id: number): ResultAsync<HnItem, Error> {
  const url = `${CONFIG.HACKER_NEWS_API_BASE}/item/${id}.json`;
  return fetchJsonWithSchema(url, hnItemSchema);
}
