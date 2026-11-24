/**
 * 練習場的四棟建築。
 * position 是地面上的 [x, z]，數字愈大離中心愈遠。
 * size 是 [寬, 高, 深]。改完存檔，畫面會跟著變。
 */
const MAP_PRACTICE_BUILDINGS = [
  {
    id: 'events',
    name: '預約活動',
    summary: '學生從這裡選時段、看活動介紹。',
    href: '/events',
    color: '#2a5d9f',
    position: [-1.8, 1.15],
    size: [1.35, 1.05, 1.15],
  },
  {
    id: 'courses',
    name: '修課說明',
    summary: '英語相關的修課安排與注意事項。',
    href: '/course-guide',
    color: '#3d7c6e',
    position: [1.7, 1.05],
    size: [1.05, 1.45, 1.05],
  },
  {
    id: 'learning',
    name: '學習資源',
    summary: '培力英檢、練習與學習資源從這裡進去。',
    href: '/learning-resources',
    color: '#5b6bb5',
    position: [-1.45, -1.35],
    size: [1.2, 0.85, 1.2],
  },
  {
    id: 'about',
    name: '公告',
    summary: '最新公告、活動異動與中心消息。',
    href: '/announcements',
    color: '#8a6232',
    position: [1.55, -1.25],
    size: [1.15, 1.2, 0.9],
  },
];

export default MAP_PRACTICE_BUILDINGS;
