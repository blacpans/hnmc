import { describe, expect, it } from 'vitest';

import { formatToJstDateKey, groupNewsByDate, paginateDayGroups } from '@/lib/newsGrouping';
import { type NewsItem } from '@/schemas/news';

function createMockNews(id: string, publishedAt: string, score: number): NewsItem {
  return {
    id,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    publishedAt,
    hnId: id,
    title: `Title ${id}`,
    jaTitle: `日本語タイトル ${id}`,
    aiSummary: '・要約1\n・要約2\n・要約3',
    url: `https://example.com/${id}`,
    score,
  };
}

describe('formatToJstDateKey', () => {
  it('UTCの日時を日本時間(JST)の日付キーに変換できること', () => {
    // UTC 2026-11-18T15:30:00Z は JST 2026-11-19T00:30:00+09:00
    expect(formatToJstDateKey('2026-11-18T15:30:00.000Z')).toBe('2026-11-19');
  });
});

describe('groupNewsByDate', () => {
  it('同じ日の記事をグループ化し、日付降順かつ同日内スコア降順で並べること', () => {
    const items: NewsItem[] = [
      createMockNews('1', '2026-11-18T01:00:00Z', 100),
      createMockNews('2', '2026-11-19T01:00:00Z', 150),
      createMockNews('3', '2026-11-19T02:00:00Z', 300),
    ];

    const groups = groupNewsByDate(items);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.dateKey).toBe('2026-11-19');
    expect(groups[0]?.items.map((item) => item.id)).toEqual(['3', '2']);
    expect(groups[1]?.dateKey).toBe('2026-11-18');
  });
});

describe('paginateDayGroups', () => {
  it('1ページあたり最大10日分でページネーション分割できること', () => {
    const items: NewsItem[] = Array.from({ length: 12 }, (_, index) => {
      const day = String(index + 1).padStart(2, '0');
      return createMockNews(String(index + 1), `2026-11-${day}T03:00:00Z`, 100);
    });
    const groups = groupNewsByDate(items);

    const page1 = paginateDayGroups(groups, 1, 10);
    expect(page1.groups).toHaveLength(10);
    expect(page1.totalPages).toBe(2);
    expect(page1.hasPrev).toBe(false);
    expect(page1.hasNext).toBe(true);
    expect(page1.groups[0]?.dateKey).toBe('2026-11-12');

    const page2 = paginateDayGroups(groups, 2, 10);
    expect(page2.groups).toHaveLength(2);
    expect(page2.hasPrev).toBe(true);
    expect(page2.hasNext).toBe(false);
    expect(page2.groups[0]?.dateKey).toBe('2026-11-02');
  });
});
