import { type ResultAsync } from 'neverthrow';

import { CONFIG } from '@/constants/config';
import {
  microCmsCreateResponseSchema,
  type MicroCmsDraftPayload,
  microCmsListCheckSchema,
} from '@/schemas/microcms';
import { fetchJsonWithSchema } from '@/utils/http';

function buildBaseUrl(serviceDomain: string): string {
  return `https://${serviceDomain}.microcms.io/api/v1/${CONFIG.MICROCMS_ENDPOINT}`;
}

/**
 * 指定されたhnIdの記事がすでにmicroCMSに登録されているか確認する
 */
export function checkArticleExists(
  serviceDomain: string,
  apiKey: string,
  hnId: string,
): ResultAsync<boolean, Error> {
  const encodedFilter = encodeURIComponent(`hnId[equals]${hnId}`);
  const url = `${buildBaseUrl(serviceDomain)}?filters=${encodedFilter}&limit=1`;

  return fetchJsonWithSchema(url, microCmsListCheckSchema, {
    headers: { 'X-MICROCMS-API-KEY': apiKey },
  }).map((data) => data.totalCount > 0);
}

/**
 * microCMSへ下書き状態（status=draft）で記事を登録し、発行されたcontentIdを返す
 */
export function createDraftArticle(
  serviceDomain: string,
  apiKey: string,
  payload: MicroCmsDraftPayload,
): ResultAsync<string, Error> {
  const url = `${buildBaseUrl(serviceDomain)}?status=draft`;

  return fetchJsonWithSchema(url, microCmsCreateResponseSchema, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MICROCMS-API-KEY': apiKey,
    },
    body: JSON.stringify(payload),
  }).map((data) => data.id);
}
