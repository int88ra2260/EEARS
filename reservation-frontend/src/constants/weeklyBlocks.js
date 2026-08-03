export const WEEKLY_BLOCKS_VERSION = 1;

export const BLOCK_TYPE_META = {
  hero: { label: '封面 Hero', icon: 'fa-image' },
  richText: { label: '富文本段落', icon: 'fa-align-left' },
  image: { label: '單張圖片', icon: 'fa-image' },
  gallery: { label: '圖片廊', icon: 'fa-images' },
  audio: { label: '音檔', icon: 'fa-volume-up' },
  video: { label: '影片', icon: 'fa-video' },
  callout: { label: '提示框', icon: 'fa-lightbulb' },
  quote: { label: '引用', icon: 'fa-quote-left' },
  divider: { label: '分隔線', icon: 'fa-minus' },
  eventsHighlight: { label: '活動精選', icon: 'fa-calendar-alt' },
  announcementCard: { label: '公告卡片', icon: 'fa-bullhorn' },
  columns: { label: '雙欄版面', icon: 'fa-columns' },
  embed: { label: '嵌入內容', icon: 'fa-code' },
  poll: { label: '投票', icon: 'fa-poll' },
  quiz: { label: '小測驗', icon: 'fa-question-circle' },
  cta: { label: '行動按鈕', icon: 'fa-hand-pointer' },
  wordBridgeChallenge: { label: '語彙挑戰', icon: 'fa-puzzle-piece' },
  spacer: { label: '間距', icon: 'fa-arrows-alt-v' },
};

export const BLOCK_TYPE_ORDER = Object.keys(BLOCK_TYPE_META);

export function createBlockId(type) {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function defaultBlockProps(type) {
  switch (type) {
    case 'hero':
      return { kicker: 'EEARS Weekly', title: '', subtitle: '', imageUrl: '', imageAlt: '' };
    case 'richText':
      return { html: '<p>在此輸入內容</p>' };
    case 'image':
      return { url: '', alt: '', caption: '', width: 'full' };
    case 'gallery':
      return { items: [] };
    case 'audio':
      return { url: '', title: '', caption: '' };
    case 'video':
      return { url: '', title: '', caption: '', provider: 'file' };
    case 'callout':
      return { variant: 'tip', title: '學習一點', body: '' };
    case 'quote':
      return { text: '', attribution: '' };
    case 'divider':
      return { style: 'line' };
    case 'eventsHighlight':
      return { title: '本週活動精選', eventIds: [] };
    case 'announcementCard':
      return { announcementId: null, slug: '', showSummary: true };
    case 'columns':
      return {
        ratio: '50-50',
        left: { kind: 'richText', html: '<p>左欄內容</p>', url: '', alt: '', caption: '' },
        right: { kind: 'image', html: '', url: '', alt: '', caption: '' },
      };
    case 'embed':
      return { url: '', title: '', height: 360 };
    case 'poll':
      return {
        question: '本週你最想參加哪類活動？',
        options: [
          { id: 'opt-1', label: 'English Table' },
          { id: 'opt-2', label: 'English Club' },
        ],
        allowMultiple: false,
        showResults: 'afterVote',
      };
    case 'quiz':
      return {
        title: '本週小測驗',
        questions: [
          {
            id: 'q-1',
            type: 'choice',
            prompt: 'Which word means “library”?',
            options: ['Cafeteria', 'Library', 'Gym', 'Dorm'],
            correctAnswer: 'Library',
            audioUrl: '',
            explanation: 'Library = 圖書館',
          },
        ],
      };
    case 'cta':
      return { label: '前往活動預約', href: '/events', variant: 'primary' };
    case 'wordBridgeChallenge':
      return { level: 'A2', themeIds: [] };
    case 'spacer':
      return { size: 'md' };
    default:
      return {};
  }
}

export function createBlock(type) {
  return { id: createBlockId(type), type, props: defaultBlockProps(type) };
}

export function defaultBlocksTemplate({ title = '', headline = '' } = {}) {
  return [
    {
      id: createBlockId('hero'),
      type: 'hero',
      props: {
        kicker: 'EEARS Weekly',
        title: title || 'EEARS Weekly',
        subtitle: headline || '',
        imageUrl: '',
        imageAlt: '',
      },
    },
    { id: createBlockId('richText'), type: 'richText', props: { html: '<p>在此撰寫本週編輯台內容。</p>' } },
    { id: createBlockId('callout'), type: 'callout', props: { variant: 'tip', title: '學習一點', body: '' } },
    {
      id: createBlockId('wordBridgeChallenge'),
      type: 'wordBridgeChallenge',
      props: { level: 'A2', themeIds: ['a2-campus', 'a2-homework', 'a2-weekend', 'a2-shopping'] },
    },
    { id: createBlockId('cta'), type: 'cta', props: { label: '前往活動預約', href: '/events', variant: 'primary' } },
  ];
}

export function extractModalTeaser(blocks = []) {
  const hero = blocks.find((b) => b.type === 'hero');
  const tip = blocks.find((b) => b.type === 'callout');
  return {
    headline: hero?.props?.subtitle || '',
    learningTip: tip?.props?.body || '',
  };
}

export function youtubeEmbedUrl(url) {
  if (!url) return '';
  const str = String(url).trim();
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/i,
    /youtu\.be\/([^?&]+)/i,
    /youtube\.com\/embed\/([^?&]+)/i,
  ];
  for (const re of patterns) {
    const m = str.match(re);
    if (m?.[1]) return `https://www.youtube.com/embed/${m[1]}`;
  }
  return '';
}

function cloneBlocksWithNewIds(blocks) {
  return blocks.map((block) => ({
    ...block,
    id: createBlockId(block.type),
    props: block.props ? JSON.parse(JSON.stringify(block.props)) : {},
  }));
}

/** 套用版型範本（會重新產生 block id） */
export function applyWeeklyLayoutTemplate(templateId, { title = '', headline = '' } = {}) {
  const hero = (subtitle = headline) => ({
    id: createBlockId('hero'),
    type: 'hero',
    props: {
      kicker: 'EEARS Weekly',
      title: title || 'EEARS Weekly',
      subtitle,
      imageUrl: '',
      imageAlt: '',
    },
  });

  const templates = {
    standard: () => defaultBlocksTemplate({ title, headline }),
    minimal: () => cloneBlocksWithNewIds([
      hero(),
      { id: createBlockId('richText'), type: 'richText', props: { html: '<p>本週重點消息。</p>' } },
      { id: createBlockId('cta'), type: 'cta', props: { label: '前往活動預約', href: '/events', variant: 'primary' } },
    ]),
    'events-focus': () => cloneBlocksWithNewIds([
      hero('本週活動精選與名額提醒'),
      { id: createBlockId('richText'), type: 'richText', props: { html: '<p>歡迎參加本週英語中心活動。</p>' } },
      { id: createBlockId('eventsHighlight'), type: 'eventsHighlight', props: { title: '本週活動精選', eventIds: [] } },
      { id: createBlockId('callout'), type: 'callout', props: { variant: 'tip', title: '學習一點', body: '' } },
      { id: createBlockId('cta'), type: 'cta', props: { label: '立即預約', href: '/events', variant: 'primary' } },
    ]),
    'announcement-focus': () => cloneBlocksWithNewIds([
      hero('最新公告與中心消息'),
      { id: createBlockId('announcementCard'), type: 'announcementCard', props: { announcementId: null, slug: '', showSummary: true } },
      { id: createBlockId('richText'), type: 'richText', props: { html: '<p>補充說明與本週提醒。</p>' } },
      { id: createBlockId('cta'), type: 'cta', props: { label: '查看更多活動', href: '/events', variant: 'outline' } },
    ]),
    'challenge-focus': () => cloneBlocksWithNewIds([
      hero('本週語彙挑戰來了！'),
      { id: createBlockId('richText'), type: 'richText', props: { html: '<p>試試本週 Connections 風格挑戰。</p>' } },
      {
        id: createBlockId('wordBridgeChallenge'),
        type: 'wordBridgeChallenge',
        props: { level: 'A2', themeIds: ['a2-campus', 'a2-homework', 'a2-weekend', 'a2-shopping'] },
      },
      { id: createBlockId('callout'), type: 'callout', props: { variant: 'tip', title: '學習一點', body: '' } },
      { id: createBlockId('cta'), type: 'cta', props: { label: '預約英語活動', href: '/events', variant: 'primary' } },
    ]),
    magazine: () => cloneBlocksWithNewIds([
      hero(headline),
      {
        id: createBlockId('columns'),
        type: 'columns',
        props: {
          ratio: '50-50',
          left: { kind: 'richText', html: '<p>左欄：編輯台摘要</p>', url: '', alt: '', caption: '' },
          right: { kind: 'image', html: '', url: '', alt: '週報配圖', caption: '' },
        },
      },
      { id: createBlockId('divider'), type: 'divider', props: { style: 'line' } },
      { id: createBlockId('eventsHighlight'), type: 'eventsHighlight', props: { title: '本週活動', eventIds: [] } },
      { id: createBlockId('wordBridgeChallenge'), type: 'wordBridgeChallenge', props: { level: 'A2', themeIds: ['a2-campus', 'a2-homework', 'a2-weekend', 'a2-shopping'] } },
      { id: createBlockId('cta'), type: 'cta', props: { label: '前往活動預約', href: '/events', variant: 'primary' } },
    ]),
    'interaction-focus': () => cloneBlocksWithNewIds([
      hero('一起參與本週互動'),
      { id: createBlockId('richText'), type: 'richText', props: { html: '<p>投票、小測驗與語彙挑戰都在這一期。</p>' } },
      { id: createBlockId('poll'), type: 'poll', props: defaultBlockProps('poll') },
      { id: createBlockId('quiz'), type: 'quiz', props: defaultBlockProps('quiz') },
      {
        id: createBlockId('wordBridgeChallenge'),
        type: 'wordBridgeChallenge',
        props: { level: 'A2', themeIds: ['a2-campus', 'a2-homework', 'a2-weekend', 'a2-shopping'] },
      },
      { id: createBlockId('cta'), type: 'cta', props: { label: '預約活動', href: '/events', variant: 'primary' } },
    ]),
  };

  const builder = templates[templateId];
  if (!builder) return null;
  return cloneBlocksWithNewIds(builder());
}

export const WEEKLY_LAYOUT_TEMPLATE_OPTIONS = [
  { id: 'standard', label: '標準週報', description: 'Hero + 編輯台 + 提示 + 語彙挑戰' },
  { id: 'minimal', label: '精簡版', description: 'Hero + 短文 + CTA' },
  { id: 'events-focus', label: '活動週', description: '突出活動精選' },
  { id: 'announcement-focus', label: '公告週', description: '公告卡片 + 補充說明' },
  { id: 'challenge-focus', label: '挑戰週', description: '以語彙挑戰為主' },
  { id: 'magazine', label: '雜誌版', description: '雙欄 + 活動 + 挑戰' },
  { id: 'interaction-focus', label: '互動週', description: '投票 + 小測驗 + 語彙挑戰' },
];
