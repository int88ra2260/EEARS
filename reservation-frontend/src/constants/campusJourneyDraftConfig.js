/**
 * Campus Journey Draft — 學生從入學到畢業（Higgsfield Draft previz）
 * 素材：public/videos/campus-journey/
 */
const ASSET_BASE = '/videos/campus-journey';

export const CAMPUS_JOURNEY_SECTIONS = [
  {
    id: 'arrival',
    label: '入學',
    accent: '#2a5d9f',
    title: '踏進大學的第一天',
    body: '報到、拖著行李走進校門——大學生活從這裡開始。',
    diorama: null,
    clip: `${ASSET_BASE}/arrival.mp4`,
    still: `${ASSET_BASE}/arrival.webp`,
    scroll: 1.8,
    linger: 0.4,
    cta: {
      secondary: [
        { label: '活動預約', href: '/events' },
        { label: '關於我們', href: '/about' },
      ],
    },
  },
  {
    id: 'campus',
    label: '日常',
    accent: '#3D7C6E',
    title: '在校園裡慢慢長成自己',
    body: '教室、腳踏車道與樹蔭——日常一步步堆成大學的樣子。',
    diorama: null,
    clip: `${ASSET_BASE}/campus.mp4`,
    still: `${ASSET_BASE}/campus.webp`,
    scroll: 1.7,
    linger: 0.35,
    cta: {
      secondary: [
        { label: '修課說明', href: '/course-guide' },
        { label: '學習資源', href: '/learning-resources' },
      ],
    },
  },
  {
    id: 'community',
    label: '同伴',
    accent: '#5B6BB5',
    title: '找到一起練習、一起說話的人',
    body: '英語活動、社團攤位與新朋友——表達從對話開始。',
    diorama: null,
    clip: `${ASSET_BASE}/community.mp4`,
    still: `${ASSET_BASE}/community.webp`,
    scroll: 1.8,
    linger: 0.45,
    cta: {
      primary: { label: '立即預約', href: '/events' },
      secondary: [
        { label: '活動介紹', href: '/activities' },
      ],
    },
  },
  {
    id: 'growth',
    label: '成長',
    accent: '#2f6f4e',
    title: '每一次練習，都被看見',
    body: '圖書館深夜、英檢準備與學習歷程——能力一點一滴累積。',
    diorama: null,
    clip: `${ASSET_BASE}/growth.mp4`,
    still: `${ASSET_BASE}/growth.webp`,
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
    id: 'graduation',
    label: '畢業',
    accent: '#1c3d6e',
    title: '畢業不是結束，是啟程',
    body: '穿上學位服、回望校園——帶著累積的英語力與故事往前走。',
    diorama: null,
    clip: `${ASSET_BASE}/graduation.mp4`,
    still: `${ASSET_BASE}/graduation.webp`,
    scroll: 1.9,
    linger: 0.5,
    cta: {
      primary: { label: '探索英語中心', href: '/' },
      secondary: [
        { label: '關於我們', href: '/about' },
        { label: '最新公告', href: '/announcements' },
      ],
    },
  },
];

/** length = sections.length - 1（線性旅程，無循環 wrap） */
export const CAMPUS_JOURNEY_CONNECTORS = [
  `${ASSET_BASE}/conn1.mp4`,
  `${ASSET_BASE}/conn2.mp4`,
  `${ASSET_BASE}/conn3.mp4`,
  `${ASSET_BASE}/conn4.mp4`,
];

export const CAMPUS_JOURNEY_BRAND = {
  name: '中山大學全英語卓越教學中心',
  href: '/',
};
