'use strict';

/**
 * 郵件模板正文：精簡 HTML（粗體／底線／顏色）偵測、消毒、純文字備援。
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'div', 'span',
  'strong', 'b', 'u', 'em', 'i',
]);

function looksLikeHtml(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  return /^<[a-z!/]/i.test(s) || /<(p|br|div|span|strong|b|u|em|i)\b/i.test(s);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeStyle(style) {
  if (!style) return '';
  const allowed = [];
  const parts = String(style).split(';');
  for (const part of parts) {
    const m = part.match(/^\s*([a-z-]+)\s*:\s*(.+)\s*$/i);
    if (!m) continue;
    const prop = m[1].toLowerCase();
    const val = m[2].trim();
    if (prop === 'color' && /^(#[0-9a-f]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-z]+)$/i.test(val)) {
      allowed.push(`color: ${val}`);
    }
    if (prop === 'text-decoration' && /underline/i.test(val)) {
      allowed.push('text-decoration: underline');
    }
    if (prop === 'font-weight' && /^(bold|[6-9]00)$/i.test(val)) {
      allowed.push(`font-weight: ${val}`);
    }
  }
  return allowed.join('; ');
}

/**
 * 極簡標籤消毒（無 DOMPurify 依賴）：只留允許標籤與安全 style／href。
 */
function sanitizeEmailHtml(html) {
  if (html == null || html === '') return '';
  let s = String(html);
  // 移除 script/style/iframe 等
  s = s.replace(/<\/?(script|style|iframe|object|embed|form|input|link|meta)[^>]*>/gi, '');
  // 移除 on* 事件
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // 過濾標籤
  s = s.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag, attrs = '') => {
    const name = String(tag).toLowerCase();
    const closing = full.startsWith('</');
    if (!ALLOWED_TAGS.has(name)) return '';
    if (closing) return `</${name}>`;
    if (name === 'br') return '<br>';
    let outAttrs = '';
    if (name === 'span' || name === 'p' || name === 'div') {
      const styleMatch = attrs.match(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
      if (styleMatch) {
        const cleaned = sanitizeStyle(styleMatch[2] || styleMatch[3] || '');
        if (cleaned) outAttrs += ` style="${cleaned}"`;
      }
    }
    return `<${name}${outAttrs}>`;
  });
  return s.trim();
}

function htmlToPlainText(html) {
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

function plainTextToEmailHtml(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return '<p></p>';
  if (looksLikeHtml(raw)) return sanitizeEmailHtml(raw);
  return raw
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block
        .split('\n')
        .map((line) => escapeHtml(line))
        .join('<br>');
      return `<p>${lines}</p>`;
    })
    .join('');
}

function wrapEmailDocument(innerHtml) {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="font-family:Arial,Helvetica,'Microsoft JhengHei',sans-serif;line-height:1.55;color:#222;max-width:640px;margin:0 auto;padding:16px">
${innerHtml}
</body>
</html>`;
}

module.exports = {
  looksLikeHtml,
  escapeHtml,
  sanitizeEmailHtml,
  htmlToPlainText,
  plainTextToEmailHtml,
  wrapEmailDocument,
};
