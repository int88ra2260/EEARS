import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = ['p', 'br', 'div', 'span', 'strong', 'b', 'u', 'em', 'i'];
const ALLOWED_ATTR = ['style'];

export function looksLikeEmailHtml(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  return /^<[a-z!/]/i.test(s) || /<(p|br|div|span|strong|b|u|em|i)\b/i.test(s);
}

export function sanitizeEmailTemplateHtml(html) {
  if (html == null || html === '') return '';
  return DOMPurify.sanitize(String(html), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'img', 'a'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'href', 'src'],
  });
}

/** 純文字 → TipTap 可編輯 HTML；已是 HTML 則消毒後回傳 */
export function plainTextToEmailEditorHtml(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return '<p></p>';
  if (looksLikeEmailHtml(raw)) return sanitizeEmailTemplateHtml(raw);
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

export function emailHtmlToPlainText(html) {
  return String(html || '')
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 判斷編輯器 HTML 是否可視為「等同系統預設純文字」 */
export function emailBodiesEquivalent(a, b) {
  const na = emailHtmlToPlainText(plainTextToEmailEditorHtml(a || ''));
  const nb = emailHtmlToPlainText(plainTextToEmailEditorHtml(b || ''));
  return na === nb && !hasEmailFormatting(a) && !hasEmailFormatting(b);
}

function hasEmailFormatting(raw) {
  const s = String(raw || '');
  return /<(strong|b|u|em|i)\b/i.test(s) || /style\s*=/i.test(s);
}
