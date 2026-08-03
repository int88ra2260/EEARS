const BLOCK_TYPES = new Set([
  'hero',
  'richText',
  'image',
  'gallery',
  'audio',
  'video',
  'callout',
  'cta',
  'wordBridgeChallenge',
  'spacer',
  'quote',
  'divider',
  'eventsHighlight',
  'announcementCard',
  'columns',
  'embed',
  'poll',
  'quiz',
]);

const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1']);

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'blockquote', 'span',
]);

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeRichHtml(html) {
  if (!html) return '';
  let out = String(html);
  out = out.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  out = out.replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/javascript:/gi, '');
  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return '';
    if (t === 'a') {
      return match.replace(/href\s*=\s*("|')?\s*javascript:[^"'\s>]*/gi, 'href="#"');
    }
    return match;
  });
  return out.trim();
}

function normalizeThemeIds(raw) {
  if (Array.isArray(raw)) return raw.map((id) => String(id).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw.split(/[,;\s]+/).map((id) => id.trim()).filter(Boolean);
  }
  return [];
}

function legacyToBlocks(row) {
  const plain = row.get ? row.get({ plain: true }) : row;
  const blocks = [];
  blocks.push({
    id: 'hero-1',
    type: 'hero',
    props: {
      kicker: 'EEARS Weekly',
      title: plain.title || '',
      subtitle: plain.headline || '',
      imageUrl: '',
      imageAlt: '',
    },
  });
  if (plain.editorial) {
    const parts = String(plain.editorial)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    const html = parts.length
      ? parts.map((p) => `<p>${escapeHtml(p)}</p>`).join('')
      : `<p>${escapeHtml(plain.editorial)}</p>`;
    blocks.push({ id: 'richtext-1', type: 'richText', props: { html } });
  }
  if (plain.learningTip) {
    blocks.push({
      id: 'callout-1',
      type: 'callout',
      props: { variant: 'tip', title: '學習一點', body: plain.learningTip },
    });
  }
  const themeIds = normalizeThemeIds(plain.wordBridgeThemeIds);
  blocks.push({
    id: 'challenge-1',
    type: 'wordBridgeChallenge',
    props: { level: plain.wordBridgeLevel || 'A2', themeIds },
  });
  blocks.push({
    id: 'cta-1',
    type: 'cta',
    props: { label: '前往活動預約', href: '/events', variant: 'primary' },
  });
  return blocks;
}

function defaultBlocksTemplate({ title = '', headline = '' } = {}) {
  return [
    {
      id: 'hero-1',
      type: 'hero',
      props: {
        kicker: 'EEARS Weekly',
        title: title || 'EEARS Weekly',
        subtitle: headline || '',
        imageUrl: '',
        imageAlt: '',
      },
    },
    {
      id: 'richtext-1',
      type: 'richText',
      props: { html: '<p>在此撰寫本週編輯台內容。</p>' },
    },
    {
      id: 'callout-1',
      type: 'callout',
      props: { variant: 'tip', title: '學習一點', body: '' },
    },
    {
      id: 'challenge-1',
      type: 'wordBridgeChallenge',
      props: { level: 'A2', themeIds: ['a2-campus', 'a2-homework', 'a2-weekend', 'a2-shopping'] },
    },
    {
      id: 'cta-1',
      type: 'cta',
      props: { label: '前往活動預約', href: '/events', variant: 'primary' },
    },
  ];
}

function sanitizeBlockProps(type, props) {
  const p = props && typeof props === 'object' ? { ...props } : {};
  switch (type) {
    case 'hero':
      return {
        kicker: String(p.kicker || '').slice(0, 80),
        title: String(p.title || '').slice(0, 200),
        subtitle: String(p.subtitle || '').slice(0, 500),
        imageUrl: String(p.imageUrl || '').slice(0, 500),
        imageAlt: String(p.imageAlt || '').slice(0, 255),
      };
    case 'richText':
      return { html: sanitizeRichHtml(p.html) };
    case 'image':
      return {
        url: String(p.url || '').slice(0, 500),
        alt: String(p.alt || '').slice(0, 255),
        caption: String(p.caption || '').slice(0, 500),
        width: p.width === 'medium' ? 'medium' : 'full',
      };
    case 'gallery': {
      const items = Array.isArray(p.items) ? p.items.slice(0, 8) : [];
      return {
        items: items.map((item) => ({
          url: String(item?.url || '').slice(0, 500),
          alt: String(item?.alt || '').slice(0, 255),
          caption: String(item?.caption || '').slice(0, 300),
        })).filter((item) => item.url),
      };
    }
    case 'audio':
      return {
        url: String(p.url || '').slice(0, 500),
        title: String(p.title || '').slice(0, 200),
        caption: String(p.caption || '').slice(0, 500),
      };
    case 'video':
      return {
        url: String(p.url || '').slice(0, 500),
        title: String(p.title || '').slice(0, 200),
        caption: String(p.caption || '').slice(0, 500),
        provider: p.provider === 'youtube' ? 'youtube' : 'file',
      };
    case 'callout':
      return {
        variant: ['info', 'tip', 'warning'].includes(p.variant) ? p.variant : 'info',
        title: String(p.title || '').slice(0, 200),
        body: String(p.body || '').slice(0, 2000),
      };
    case 'cta':
      return {
        label: String(p.label || '了解更多').slice(0, 120),
        href: String(p.href || '/').slice(0, 500),
        variant: p.variant === 'outline' ? 'outline' : 'primary',
      };
    case 'wordBridgeChallenge': {
      const themeIds = normalizeThemeIds(p.themeIds);
      const level = VALID_LEVELS.has(p.level) ? p.level : 'A2';
      return { level, themeIds };
    }
    case 'spacer':
      return { size: ['sm', 'md', 'lg'].includes(p.size) ? p.size : 'md' };
    case 'quote':
      return {
        text: String(p.text || '').slice(0, 2000),
        attribution: String(p.attribution || '').slice(0, 200),
      };
    case 'divider':
      return { style: ['line', 'dots', 'space'].includes(p.style) ? p.style : 'line' };
    case 'eventsHighlight': {
      const eventIds = Array.isArray(p.eventIds)
        ? p.eventIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0).slice(0, 6)
        : [];
      return {
        title: String(p.title || '本週活動精選').slice(0, 120),
        eventIds,
      };
    }
    case 'announcementCard':
      return {
        announcementId: p.announcementId ? Number(p.announcementId) : null,
        slug: String(p.slug || '').slice(0, 180),
        showSummary: p.showSummary !== false,
      };
    case 'columns': {
      const sanitizeSlot = (slot) => {
        const s = slot && typeof slot === 'object' ? slot : {};
        const kind = s.kind === 'image' ? 'image' : 'richText';
        return {
          kind,
          html: kind === 'richText' ? sanitizeRichHtml(s.html) : '',
          url: kind === 'image' ? String(s.url || '').slice(0, 500) : '',
          alt: String(s.alt || '').slice(0, 255),
          caption: String(s.caption || '').slice(0, 500),
        };
      };
      return {
        ratio: ['40-60', '60-40', '50-50'].includes(p.ratio) ? p.ratio : '50-50',
        left: sanitizeSlot(p.left),
        right: sanitizeSlot(p.right),
      };
    }
    case 'embed': {
      let url = String(p.url || '').trim().slice(0, 500);
      if (url && !/^https:\/\//i.test(url)) url = '';
      return {
        url,
        title: String(p.title || '').slice(0, 200),
        height: Math.min(800, Math.max(200, Number(p.height) || 360)),
      };
    }
    case 'poll': {
      const options = Array.isArray(p.options) ? p.options.slice(0, 6) : [];
      return {
        question: String(p.question || '').slice(0, 300),
        options: options
          .map((opt, idx) => ({
            id: String(opt?.id || `opt-${idx + 1}`).slice(0, 32),
            label: String(opt?.label || '').slice(0, 200),
          }))
          .filter((opt) => opt.label),
        allowMultiple: !!p.allowMultiple,
        showResults: ['always', 'afterVote', 'never'].includes(p.showResults) ? p.showResults : 'afterVote',
      };
    }
    case 'quiz': {
      const questions = Array.isArray(p.questions) ? p.questions.slice(0, 10) : [];
      return {
        title: String(p.title || '').slice(0, 200),
        questions: questions
          .map((q, idx) => {
            const type = q.type === 'fill' ? 'fill' : 'choice';
            const options = type === 'choice' && Array.isArray(q.options)
              ? q.options.map((o) => String(o).slice(0, 120)).filter(Boolean).slice(0, 6)
              : [];
            return {
              id: String(q.id || `q-${idx + 1}`).slice(0, 32),
              type,
              prompt: String(q.prompt || '').slice(0, 500),
              options,
              correctAnswer: String(q.correctAnswer || '').slice(0, 200),
              audioUrl: String(q.audioUrl || '').slice(0, 500),
              explanation: String(q.explanation || '').slice(0, 500),
            };
          })
          .filter((q) => q.prompt && q.correctAnswer),
      };
    }
    default:
      return p;
  }
}

function normalizeBlocks(rawBlocks, fallbackRow) {
  if (Array.isArray(rawBlocks) && rawBlocks.length > 0) {
    return rawBlocks
      .filter((b) => b && BLOCK_TYPES.has(b.type))
      .map((b, index) => ({
        id: String(b.id || `${b.type}-${index + 1}`).slice(0, 64),
        type: b.type,
        props: sanitizeBlockProps(b.type, b.props),
      }));
  }
  if (fallbackRow) return legacyToBlocks(fallbackRow);
  return defaultBlocksTemplate();
}

function validateBlocks(blocks) {
  const errors = [];
  if (!Array.isArray(blocks) || blocks.length === 0) {
    errors.push('blocks 不可為空');
    return errors;
  }
  blocks.forEach((block, i) => {
    if (!BLOCK_TYPES.has(block.type)) {
      errors.push(`區塊 ${i + 1} 類型不支援`);
    }
    if (block.type === 'wordBridgeChallenge') {
      const ids = normalizeThemeIds(block.props?.themeIds);
      if (ids.length !== 4) errors.push('語彙挑戰區塊須選 4 個主題');
    }
    if (block.type === 'richText' && !String(block.props?.html || '').trim()) {
      errors.push(`區塊 ${i + 1} 富文本內容不可為空`);
    }
    if (block.type === 'quote' && !String(block.props?.text || '').trim()) {
      errors.push(`區塊 ${i + 1} 引用內容不可為空`);
    }
    if (block.type === 'announcementCard') {
      const hasId = block.props?.announcementId;
      const hasSlug = String(block.props?.slug || '').trim();
      if (!hasId && !hasSlug) errors.push(`區塊 ${i + 1} 請選擇公告`);
    }
    if (block.type === 'embed' && !String(block.props?.url || '').trim()) {
      errors.push(`區塊 ${i + 1} 請填寫嵌入網址`);
    }
    if (block.type === 'poll') {
      if (!String(block.props?.question || '').trim()) errors.push(`區塊 ${i + 1} 請填寫投票問題`);
      const opts = Array.isArray(block.props?.options) ? block.props.options : [];
      if (opts.length < 2) errors.push(`區塊 ${i + 1} 投票至少需要 2 個選項`);
    }
    if (block.type === 'quiz') {
      const qs = Array.isArray(block.props?.questions) ? block.props.questions : [];
      if (!qs.length) errors.push(`區塊 ${i + 1} 小測驗至少需要 1 題`);
    }
  });
  return errors;
}

function extractFromBlocks(blocks) {
  const hero = blocks.find((b) => b.type === 'hero');
  const challenge = blocks.find((b) => b.type === 'wordBridgeChallenge');
  const tip = blocks.find((b) => b.type === 'callout' && b.props?.variant === 'tip');
  const rich = blocks.find((b) => b.type === 'richText');

  const headline = hero?.props?.subtitle || null;
  const title = hero?.props?.title || null;
  let editorial = null;
  if (rich?.props?.html) {
    editorial = String(rich.props.html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
  const learningTip = tip?.props?.body || null;
  const wordBridgeLevel = challenge?.props?.level || 'A2';
  const wordBridgeThemeIds = normalizeThemeIds(challenge?.props?.themeIds);

  return {
    headline,
    title,
    editorial,
    learningTip,
    wordBridgeLevel,
    wordBridgeThemeIds,
  };
}

function extractModalTeaser(blocks) {
  const hero = blocks.find((b) => b.type === 'hero');
  const tip = blocks.find((b) => b.type === 'callout');
  return {
    headline: hero?.props?.subtitle || '',
    learningTip: tip?.props?.body || '',
  };
}

function stripBlocksForPublic(blocks) {
  return blocks.map((block) => {
    if (block.type !== 'quiz') return block;
    return {
      ...block,
      props: {
        ...block.props,
        questions: (block.props?.questions || []).map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          audioUrl: q.audioUrl,
        })),
      },
    };
  });
}

module.exports = {
  BLOCK_TYPES,
  VALID_LEVELS,
  sanitizeRichHtml,
  normalizeThemeIds,
  legacyToBlocks,
  defaultBlocksTemplate,
  normalizeBlocks,
  validateBlocks,
  extractFromBlocks,
  extractModalTeaser,
  sanitizeBlockProps,
  stripBlocksForPublic,
};
