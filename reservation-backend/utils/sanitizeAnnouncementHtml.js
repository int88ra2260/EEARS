/**
 * 公告富文字 HTML 消毒（允許字型／顏色／對齊／表格／圖片等，剔除 script／事件）
 */

const ALLOWED_TAGS = new Set([
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
]);

const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'font-family',
  'font-size',
  'text-align',
  'text-decoration',
  'font-weight',
  'font-style',
  'width',
  'height',
  'max-width',
  'border',
  'border-collapse',
  'padding',
  'margin',
]);

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeStyle(styleValue) {
  if (!styleValue) return '';
  const parts = String(styleValue)
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  const kept = [];
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    let val = part.slice(idx + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    if (/expression|javascript:|url\s*\(\s*['"]?\s*javascript/i.test(val)) continue;
    if (prop === 'font-size' && !/^[\d.]+\s*(px|pt|em|rem|%)$/i.test(val)) continue;
    if ((prop === 'color' || prop === 'background-color') && !/^(#[0-9a-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[a-z]+)$/i.test(val)) {
      continue;
    }
    kept.push(`${prop}: ${val}`);
  }
  return kept.join('; ');
}

function sanitizeHref(href) {
  const raw = String(href || '').trim();
  if (!raw) return '';
  if (/^\s*javascript:/i.test(raw)) return '';
  if (/^\s*data:/i.test(raw) && !/^data:image\//i.test(raw)) return '';
  return raw;
}

function sanitizeSrc(src) {
  const raw = String(src || '').trim();
  if (!raw) return '';
  if (/^\s*javascript:/i.test(raw)) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/') || /^data:image\//i.test(raw)) return raw;
  return '';
}

function rebuildOpenTag(tag, attrsString) {
  const attrs = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"'=]+))/g;
  let m;
  const raw = String(attrsString || '');
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    const value = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] || '';
    if (name.startsWith('on')) continue;
    if (name === 'style') {
      const cleaned = sanitizeStyle(value);
      if (cleaned) attrs.push(`style="${escapeAttr(cleaned)}"`);
      continue;
    }
    if (tag === 'a' && name === 'href') {
      const href = sanitizeHref(value);
      if (href) {
        attrs.push(`href="${escapeAttr(href)}"`);
        attrs.push('rel="noopener noreferrer"');
        if (/^https?:\/\//i.test(href)) attrs.push('target="_blank"');
      }
      continue;
    }
    if (tag === 'a' && (name === 'target' || name === 'rel' || name === 'title')) continue;
    if (tag === 'img' && name === 'src') {
      const src = sanitizeSrc(value);
      if (src) attrs.push(`src="${escapeAttr(src)}"`);
      continue;
    }
    if (tag === 'img' && ['alt', 'width', 'height', 'title'].includes(name)) {
      attrs.push(`${name}="${escapeAttr(value)}"`);
      continue;
    }
    if (['th', 'td', 'col'].includes(tag) && ['colspan', 'rowspan', 'width'].includes(name)) {
      if (/^\d+$/.test(String(value).trim())) attrs.push(`${name}="${escapeAttr(value)}"`);
      continue;
    }
    if (name === 'class' && /^[a-z0-9_\-\s]+$/i.test(value)) {
      attrs.push(`class="${escapeAttr(value)}"`);
    }
  }
  return attrs.length ? `<${tag} ${attrs.join(' ')}>` : `<${tag}>`;
}

/**
 * @param {string} html
 * @returns {string}
 */
function sanitizeAnnouncementHtml(html) {
  if (html == null) return '';
  let out = String(html);
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tagName, attrs) => {
    const tag = String(tagName).toLowerCase();
    const isClose = /^<\//.test(match);
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (isClose) return `</${tag}>`;
    if (/\/>$/.test(match.trim()) && (tag === 'br' || tag === 'hr' || tag === 'img' || tag === 'col')) {
      const open = rebuildOpenTag(tag, attrs);
      return open.replace(/>$/, ' />');
    }
    return rebuildOpenTag(tag, attrs);
  });
  return out.trim();
}

/**
 * 判斷字串是否為富文字 HTML（舊純文字走另一條渲染路徑）
 * @param {string} raw
 */
function isAnnouncementHtmlContent(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  return /^<[a-z!/]/i.test(s) || /<(p|br|div|span|h[1-6]|ul|ol|li|table|img|a|strong|em)\b/i.test(s);
}

module.exports = {
  sanitizeAnnouncementHtml,
  isAnnouncementHtmlContent,
  ALLOWED_TAGS,
};
