import { describe, expect, it } from 'vitest';
import {
  isAnnouncementHtmlContent,
  plainTextToAnnouncementHtml,
  sanitizeAnnouncementHtml,
  stripCoverImageFromHtml,
} from './sanitizeAnnouncementHtml';

describe('sanitizeAnnouncementHtml (frontend)', () => {
  it('removes script tags', () => {
    const out = sanitizeAnnouncementHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).toContain('<p>ok</p>');
    expect(out).not.toMatch(/script/i);
  });

  it('detects html content', () => {
    expect(isAnnouncementHtmlContent('<p>x</p>')).toBe(true);
    expect(isAnnouncementHtmlContent('plain text only')).toBe(false);
  });

  it('converts plain text paragraphs', () => {
    const html = plainTextToAnnouncementHtml('第一段\n\n第二段');
    expect(html).toContain('<p>');
    expect(html).toContain('第一段');
  });

  it('strips only leading cover image, keeps later images', () => {
    const cover = 'https://example.com/cover.png';
    const other = 'https://example.com/other.png';
    const html = `<p><img src="${cover}" alt="c"></p><p>hi</p><img src="${other}" alt="o"><p><img src="${cover}" alt="again"></p>`;
    const out = stripCoverImageFromHtml(html, cover);
    expect(out).not.toMatch(new RegExp(`^\\s*<p>\\s*<img[^>]*${cover.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    expect(out).toContain(other);
    expect(out).toContain('hi');
    // 文中後半段相同封面圖應保留（僅剝開頭重複）
    expect(out).toContain(cover);
  });
});
