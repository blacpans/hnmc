import { SITE_CONFIG } from '@/constants/site';
import { type NewsItem } from '@/schemas/news';

export type DayGroup = {
  dateKey: string;
  displayDate: string;
  items: NewsItem[];
};

export type PaginatedDayGroups = {
  groups: DayGroup[];
  currentPage: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
};

/**
 * ISO日時文字列を日本時間 (Asia/Tokyo) の YYYY-MM-DD 形式に変換する
 */
export function formatToJstDateKey(isoDateString: string): string {
  const date = new Date(isoDateString);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE_CONFIG.TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

/**
 * YYYY-MM-DD を表示用フォーマット（例: 2026年11月19日 (木)）に変換する
 */
export function formatDisplayDate(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: SITE_CONFIG.TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

/**
 * 記事一覧を日本時間の日付ごとにグループ化し、日付降順・同日内スコア降順で整列する
 */
export function groupNewsByDate(items: NewsItem[]): DayGroup[] {
  const grouped = new Map<string, NewsItem[]>();

  for (const item of items) {
    const baseDate = item.publishedAt ?? item.createdAt;
    const dateKey = formatToJstDateKey(baseDate);
    const list = grouped.get(dateKey) ?? [];
    list.push(item);
    grouped.set(dateKey, list);
  }

  return Array.from(grouped.entries())
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([dateKey, dayItems]) => ({
      dateKey,
      displayDate: formatDisplayDate(dateKey),
      items: [...dayItems].sort((a, b) => b.score - a.score),
    }));
}

/**
 * 日付グループを指定した日数（デフォルト10日分）ごとにページ分割する
 */
export function paginateDayGroups(
  groups: DayGroup[],
  page: number,
  daysPerPage: number = SITE_CONFIG.DAYS_PER_PAGE,
): PaginatedDayGroups {
  const totalPages = Math.max(1, Math.ceil(groups.length / daysPerPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * daysPerPage;

  return {
    groups: groups.slice(startIndex, startIndex + daysPerPage),
    currentPage: safePage,
    totalPages,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
  };
}
