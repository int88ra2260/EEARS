/** 學生端內容中心 — 任務分區（業務語言） */

export const STUDENT_CONTENT_AREAS = [
  {
    id: 'copy',
    label: '改頁面上的字',
    shortLabel: '固定頁文案',
    description: '首頁、關於我們、聯絡資訊、FAQ、師資與活動規定等固定版面文字。',
    howTo: '在預覽畫面上點文字即可修改，存檔後學生端立刻更新。',
    previewPath: '/',
    previewLabel: '首頁',
    kind: 'site-content',
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

export function getStudentContentArea(id) {
  return STUDENT_CONTENT_AREAS.find((a) => a.id === id) || null;
}

export function resolveAreaFromLegacyPath(pathname, searchParams) {
  if (pathname.includes('/site-content')) return 'copy';
  if (pathname.includes('/page-content')) {
    const tab = searchParams?.get('tab');
    if (tab === 'regulations') return 'regulations';
    if (tab === 'courseGuide' || tab === 'course-guide') return 'course-guide';
    if (tab === 'scrollWorld' || tab === 'scroll-world') return 'scroll-world';
    return 'resources';
  }
  return null;
}
