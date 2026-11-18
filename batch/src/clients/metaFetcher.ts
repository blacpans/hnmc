import { ResultAsync } from 'neverthrow';

import { CONFIG } from '@/constants/config';

/**
 * HTML文字列からmeta descriptionまたはog:descriptionを抽出する
 */
export function extractMetaDescription(html: string): string {
  const nameFirst = html.match(
    /<meta[^>]+(?:name=["']description["']|property=["']og:description["'])[^>]+content=["']([^"']+)["']/i,
  );
  if (nameFirst?.[1]) {
    return nameFirst[1].slice(0, CONFIG.META_MAX_LENGTH).trim();
  }

  const contentFirst = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name=["']description["']|property=["']og:description["'])/i,
  );
  return contentFirst?.[1]?.slice(0, CONFIG.META_MAX_LENGTH).trim() ?? '';
}

/**
 * 著作権に配慮して元記事本文は保存せず、要約の材料としてメタ説明文のみを安全に取得する
 */
export function fetchPageMetaDescription(url: string): ResultAsync<string, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CONFIG.META_FETCH_TIMEOUT_MS);

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': CONFIG.USER_AGENT },
        });
        if (!res.ok) {
          return '';
        }
        const html = await res.text();
        return extractMetaDescription(html);
      } finally {
        clearTimeout(timer);
      }
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
}
