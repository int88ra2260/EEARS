import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'strike',
  'ul',
  'ol',
  'li',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'span',
  'div',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'img',
  'hr',
  'sup',
  'sub',
  'colgroup',
  'col',
];

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'colspan',
  'rowspan',
  'style',
  'class',
];

/**
 * 判斷是否為富文字 HTML（相容舊純文字公告）
 */
export function isAnnouncementHtmlContent(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  return /^<[a-z!/]/i.test(s) || /<(p|br|div|span|h[1-6]|ul|ol|li|table|img|a|strong|em)\b/i.test(s);
}

/**
 * 前台／後台共用消毒
 */
export function sanitizeAnnouncementHtml(html) {
  if (html == null || html === '') return '';
  return DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    // 允許站內相對路徑（/uploads/...）與 http(s)
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  });
}

/**
 * 純文字 → 簡易 HTML（載入舊文到 TipTap）
 */
export function plainTextToAnnouncementHtml(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return '<p></p>';
  if (isAnnouncementHtmlContent(raw)) return sanitizeAnnouncementHtml(raw);
  return raw
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block
        .split('\n')
        .map((line) =>
          String(line)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        )
        .join('<br>');
      return `<p>${lines}</p>`;
    })
    .join('');
}

/**
 * 僅移除內文開頭與封面相同的那一張圖（常見「封面又貼進內文」），
 * 不刪除文中其他相同或不同的圖片。
 */
export function stripCoverImageFromHtml(html, coverUrl) {
  const src = String(coverUrl || '').trim();
  if (!html || !src) return html || '';
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const leading = new RegExp(
    `^(?:\\s*<p(?:\\s[^>]*)?>\\s*)?<img\\b(?=[^>]*\\bsrc=(["'])${escaped}\\1)[^>]*/?>(?:\\s*</p>)?\\s*`,
    'i'
  );
  return String(html).replace(leading, '').trim();
}


