/**
 * Scroll World 測試頁 — 四主題場景設定
 * 素材：public/videos/scroll-world/（Step 6 encode 後）
 */
const ASSET_BASE = '/videos/scroll-world';

export const SCROLL_WORLD_SECTIONS = [
  {
    id: 'events',
    label: '活動',
    accent: '#D4564A',
    title: '預約中心活動，從這裡開始',
    body: '想參加中心活動，可直接預約時段、查看活動介紹，或查詢自己的預約紀錄；需要寫作輔導也可前往寫作工坊。',
    diorama: 'events',
    clip: `${ASSET_BASE}/events.mp4`,
    still: `${ASSET_BASE}/events.webp`,
    scroll: 1.8,
    linger: 0.4,
    cta: {
      primary: { label: '立即預約', href: '/events' },
      secondary: [
        { label: '寫作工坊', href: 'https://emicenter.siwan.nsysu.edu.tw/EWL/', external: true },
        { label: '活動介紹', href: '/activities' },
        { label: '查詢預約紀錄', href: '/my-reservations' },
      ],
    },
  },
  {
    id: 'courses',
    label: '修課',
    accent: '#3D7C6E',
    title: '選課與修課資訊一次找到',
    body: '查詢或加退選請使用學校選課系統；想了解英語相關修課安排與注意事項，可先閱讀修課說明。',
    diorama: 'courses',
    clip: `${ASSET_BASE}/courses.mp4`,
    still: `${ASSET_BASE}/courses.webp`,
    scroll: 1.7,
    linger: 0.35,
    cta: {
      secondary: [
        { label: '選課系統', href: 'https://selcrs.nsysu.edu.tw/', external: true },
        { label: '修課說明', href: '/course-guide' },
      ],
    },
  },
  {
    id: 'learning',
    label: '學習',
    accent: '#5B6BB5',
    title: '培力英檢與學習歷程',
    body: '報名培力英檢、累積實踐歷程檔案，並搭配學習資源持續精進英語能力——讓每一次練習都被看見。',
    diorama: 'learning',
    clip: `${ASSET_BASE}/learning.mp4`,
    still: `${ASSET_BASE}/learning.webp`,
    scroll: 1.8,
    linger: 0.45,
    cta: {
      primary: { label: '培力報名', href: '/register/english-test' },
      secondary: [
        { label: '實踐歷程檔案', href: '/student/english-learning-passport' },
        { label: '學習資源', href: '/learning-resources' },
      ],
    },
  },
  {
    id: 'other',
    label: '其他',
    accent: '#8A6BB5',
    title: '認識中心，掌握公告與表單',
    body: '想了解全英語卓越教學中心、查看最新公告，或下載法規與表單，都可從這裡進入。',
    diorama: 'other',
    clip: `${ASSET_BASE}/other.mp4`,
    still: `${ASSET_BASE}/other.webp`,
    scroll: 1.9,
    linger: 0.5,
    cta: {
      primary: { label: '關於我們', href: '/about' },
      secondary: [
        { label: '最新公告', href: '/announcements' },
        { label: '法規表單', href: '/regulations-forms' },
      ],
    },
  },
];

/** length = sections.length；最後一支為 other → events 循環 connector */
export const SCROLL_WORLD_CONNECTORS = [
  `${ASSET_BASE}/conn1.mp4`,
  `${ASSET_BASE}/conn2.mp4`,
  `${ASSET_BASE}/conn3.mp4`,
  `${ASSET_BASE}/conn4.mp4`,
];

export const SCROLL_WORLD_CONN_SCROLL = 1.1;

export const SCROLL_WORLD_BRAND = {
  name: 'EEARS World',
  href: '/',
};

/**
 * 交錯片段鏈：dive0, conn0, dive1, … diveN-1, connWrap(→dive0)
 * connectors[i] 連接 dive_i → dive_{i+1}；connectors[n-1] 為循環回第一島
 */
export function buildScrollWorldSegments(sections = SCROLL_WORLD_SECTIONS, connectors = SCROLL_WORLD_CONNECTORS) {
  const segments = [];
  const n = sections.length;

  sections.forEach((section, i) => {
    segments.push({
      key: `dive-${section.id}`,
      kind: 'dive',
      sectionIndex: i,
      sectionId: section.id,
      clip: section.clip || null,
      still: section.still || null,
      accent: section.accent,
      weight: section.scroll || 1.3,
      linger: section.linger || 0,
      diorama: section.diorama,
      wrap: false,
    });

    if (i < n - 1 && connectors[i]) {
      const next = sections[i + 1];
      segments.push({
        key: `conn-${i + 1}`,
        kind: 'conn',
        sectionIndex: i,
        sectionId: next?.id,
        clip: connectors[i],
        still: section.still || next?.still || null,
        accent: next?.accent || section.accent,
        weight: SCROLL_WORLD_CONN_SCROLL,
        linger: 0,
        diorama: null,
        wrap: false,
      });
    }
  });

  // 循環：最後一島 → 第一島（風格與中間 connectors 相同）
  if (n > 1 && connectors[n - 1]) {
    const last = sections[n - 1];
    const first = sections[0];
    segments.push({
      key: 'conn-wrap',
      kind: 'conn',
      sectionIndex: n - 1,
      sectionId: first.id,
      clip: connectors[n - 1],
      still: last.still || first.still || null,
      accent: first.accent || last.accent,
      weight: SCROLL_WORLD_CONN_SCROLL,
      linger: 0,
      diorama: null,
      wrap: true,
    });
  }

  return segments;
}
