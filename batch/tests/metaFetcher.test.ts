import { describe, expect, it } from 'vitest';

import { extractMetaDescription } from '@/clients/metaFetcher';
import { CONFIG } from '@/constants/config';

describe('extractMetaDescription', () => {
  it('name="description" のメタタグから概要を抽出できること', () => {
    const html = '<html><head><meta name="description" content="Sample tech article summary"></head></html>';
    expect(extractMetaDescription(html)).toBe('Sample tech article summary');
  });

  it('property="og:description" のメタタグから概要を抽出できること', () => {
    const html = '<html><head><meta property="og:description" content="OGP description text"></head></html>';
    expect(extractMetaDescription(html)).toBe('OGP description text');
  });

  it('content属性が先に記述されている場合でも抽出できること', () => {
    const html = '<html><head><meta content="Reversed attribute order" name="description"></head></html>';
    expect(extractMetaDescription(html)).toBe('Reversed attribute order');
  });

  it('最大文字数を超える場合は切り詰められること', () => {
    const longText = 'a'.repeat(CONFIG.META_MAX_LENGTH + 100);
    const html = `<html><head><meta name="description" content="${longText}"></head></html>`;
    expect(extractMetaDescription(html)).toHaveLength(CONFIG.META_MAX_LENGTH);
  });

  it('該当するメタタグが存在しない場合は空文字を返すこと', () => {
    const html = '<html><head><title>Only Title</title></head></html>';
    expect(extractMetaDescription(html)).toBe('');
  });
});
