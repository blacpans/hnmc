export const SITE_CONFIG = {
  TITLE: 'Hacker news Hot Trends',
  MICROCMS_ENDPOINT: 'news',
  DAYS_PER_PAGE: 10,
  FETCH_PAGE_LIMIT: 100,
  TIME_ZONE: 'Asia/Tokyo',
} as const;

export const UI_LABELS = {
  SUMMARY_BADGE: '🤖 AI 3行要約',
  COMMENT_BADGE: '💬 ひとこと',
  ORIGINAL_TITLE_PREFIX: '原題:',
  READ_ARTICLE: '元記事を読む ↗',
  VIEW_HN_DISCUSSION: 'HNの議論を見る',
  EMPTY_MESSAGE: 'まだ公開された記事がないよ！microCMSの管理画面で下書きを公開してみてね。',
  FETCH_ERROR_MESSAGE: '記事の取得中にエラーが発生したよ。しばらくしてから再度確認してね。',
  PREV_PAGE: '← 新しい10日分',
  NEXT_PAGE: '古い10日分 →',
  PAGE_TITLE_SUFFIX: (page: number) => `Page ${page}`,
} as const;
