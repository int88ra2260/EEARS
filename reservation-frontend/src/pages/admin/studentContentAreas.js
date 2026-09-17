/** 學生端內容中心 — 任務分區（對齊前台 Header 探索導覽） */

/**
 * @typedef {Object} StudentContentArea
 * @property {string} id
 * @property {string} label
 * @property {string} shortLabel
 * @property {string} description
 * @property {string} howTo
 * @property {string} previewPath
 * @property {string} previewLabel
 * @property {'site-content'|'page-content'|'media-library'} kind
 * @property {string} [pageTab]
 * @property {string[]} [siteSections] - 嵌入 site-content 時限定的文案區塊
 * @property {boolean} [headerMatch] - 對應前台 Header 探索選單
 * @property {boolean} [advanced]
 */

/** @type {StudentContentArea[]} */
export const STUDENT_CONTENT_AREAS = [
  // —— 對齊 Header：活動介紹／學習資源／修課說明／法規表單／關於我們 ——
  {
    id: 'activities',
    label: '管理活動介紹',
    shortLabel: '活動介紹',
    description: '活動介紹頁的標題、導言與各活動類型說明（English Table、Club、Job Talk 等）。',
    howTo: '在預覽畫面上點文字或卡片圖片即可修改；圖片會連接媒體庫。新活動類型的介紹會出現在「自訂活動類型介紹」。類型本身請到「活動類型設定」新增或停用。',
    previewPath: '/activities',
    previewLabel: '活動介紹',
    kind: 'site-content',
    siteSections: ['activities'],
    headerMatch: true,
  },
  {
    id: 'resources',
    label: '管理學習資源',
    shortLabel: '學習資源',
    description: '學習網站、小遊戲與導引連結的標題、網址與排序。',
    howTo: '新增或編輯連結後，可在右側預覽學生看到的列表。',
    previewPath: '/learning-resources',
    previewLabel: '學習資源',
    kind: 'page-content',
    pageTab: 'learning',
    headerMatch: true,
  },
  {
    id: 'course-guide',
    label: '管理修課說明',
    shortLabel: '修課說明',
    description: '依學年度整理的修課、抵免、認證與歷程說明（含圖文）。',
    howTo: '左側選大章節，右側用表單新增段落、清單或流程圖，不必寫程式。',
    previewPath: '/course-guide',
    previewLabel: '修課說明',
    kind: 'page-content',
    pageTab: 'courseGuide',
    headerMatch: true,
  },
  {
    id: 'regulations',
    label: '管理法規與表單',
    shortLabel: '法規表單',
    description: '法規群組與可下載的 PDF 表單。',
    howTo: '先選群組，再上傳 PDF 並填寫中英文標題。',
    previewPath: '/regulations-forms',
    previewLabel: '法規表單',
    kind: 'page-content',
    pageTab: 'regulations',
    headerMatch: true,
  },
  {
    id: 'about',
    label: '管理關於我們',
    shortLabel: '關於我們',
    description: '中心介紹、聯絡資訊，以及師資／行政團隊名單。',
    howTo: '分頁可改介紹文案、聯絡資訊（地址／電話／Email／時段），以及師資／行政名單。',
    previewPath: '/about',
    previewLabel: '關於我們',
    kind: 'site-content',
    siteSections: ['about', 'contact', 'staff_faculty', 'staff_admin'],
    headerMatch: true,
  },

  // —— 其他固定頁／工具（非 Header 主選單，但仍常改） ——
  {
    id: 'home',
    label: '改首頁與其他固定文案',
    shortLabel: '首頁／其他文案',
    description: '首頁、常見問題、隱私條款、護照與英檢提示等固定版面文字。',
    howTo: '在預覽畫面上點文字即可修改；常見問題則用列表新增與排序。聯絡資訊請到「關於我們」。',
    previewPath: '/',
    previewLabel: '首頁',
    kind: 'site-content',
    siteSections: [
      'home',
      'faq',
      'legal',
      'english_learning_passport',
      'english_test_registration',
    ],
  },
  {
    id: 'media',
    label: '管理媒體庫',
    shortLabel: '媒體庫',
    description: '上傳、搜尋、停用或刪除網站圖片，供修課說明等頁面共用。',
    howTo: '先上傳或挑選圖片，再到各內容頁引用。刪除前會檢查是否仍被使用。',
    previewPath: '/course-guide',
    previewLabel: '修課說明',
    kind: 'media-library',
  },
  {
    id: 'scroll-world',
    label: 'Scroll World（進階）',
    shortLabel: 'Scroll World',
    description: '實驗頁的段落文字與按鈕；場景影片維持固定。',
    howTo: '僅調整文字與連結；不確定用途時可略過此區。',
    previewPath: '/scrollworldtest',
    previewLabel: 'Scroll World',
    kind: 'page-content',
    pageTab: 'scrollWorld',
    advanced: true,
  },
];

/** 舊 area=copy → 首頁／其他文案 */
const AREA_ALIASES = {
  copy: 'home',
};

export function getStudentContentArea(id) {
  if (!id) return null;
  const resolved = AREA_ALIASES[id] || id;
  return STUDENT_CONTENT_AREAS.find((a) => a.id === resolved) || null;
}

export function resolveAreaFromLegacyPath(pathname, searchParams) {
  if (pathname.includes('/site-content')) return 'home';
  if (pathname.includes('/page-content')) {
    const tab = searchParams?.get('tab');
    if (tab === 'regulations') return 'regulations';
    if (tab === 'courseGuide' || tab === 'course-guide') return 'course-guide';
    if (tab === 'scrollWorld' || tab === 'scroll-world') return 'scroll-world';
    return 'resources';
  }
  return null;
}
