export const CONFIG = {
  HACKER_NEWS_API_BASE: 'https://hacker-news.firebaseio.com/v0',
  HACKER_NEWS_ITEM_WEB_BASE: 'https://news.ycombinator.com/item?id=',
  GEMINI_API_BASE: 'https://generativelanguage.googleapis.com/v1beta/models',
  DEFAULT_GEMINI_MODEL: 'gemini-3.8-flash',
  MICROCMS_ENDPOINT: 'news',
  MAX_ARTICLES_PER_RUN: 5,
  MAX_CANDIDATE_SCAN: 20,
  META_FETCH_TIMEOUT_MS: 5000,
  META_MAX_LENGTH: 500,
  USER_AGENT: 'Mozilla/5.0 (compatible; HN-Curator-Bot/1.0)',
} as const;
