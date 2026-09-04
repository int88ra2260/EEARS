import HomePage from '../HomePage';
import ActivitiesPage from '../ActivitiesPage';
import AboutPage from '../AboutPage';
import EnglishLearningPassportPage from '../student/EnglishLearningPassportPage';
import LegalVisualPreview from './LegalVisualPreview';

/** 各文案區塊對應的學生端預覽頁面 */
export const VISUAL_SECTION_CONFIG = {
  home: {
    path: '/',
    layout: 'home',
    Component: HomePage,
    hint: '點擊首頁上的文字即可編輯；包含 Hero、公告、FAQ、聯絡與頁尾連結。',
  },
  activities: {
    path: '/activities',
    layout: 'public',
    Component: ActivitiesPage,
    hint: '點擊活動介紹頁上的標題、說明與表格文字即可編輯。',
  },
  about: {
    path: '/about',
    layout: 'about',
    Component: AboutPage,
    hint: '點擊關於我們頁面的介紹、聯絡與 FAQ 段落即可編輯（師資名單請至「師資名單」分頁）。',
  },
  contact: {
    path: '/about',
    layout: 'about',
    Component: AboutPage,
    hint: '聯絡資訊已整合至「關於我們」頁；點擊聯絡區塊文字即可編輯。',
  },
  legal: {
    path: '/privacy',
    layout: 'public',
    Component: LegalVisualPreview,
    hint: '切換隱私權／使用條款後，點擊段落文字即可編輯。',
  },
  english_learning_passport: {
    path: '/student/english-learning-passport',
    layout: 'public',
    Component: EnglishLearningPassportPage,
    hint: '點擊學生端護照頁上的文字或指南圖即可編輯；點擊圖片後可在右側上傳／挑選新圖。',
  },
};

export const VISUAL_TEXT_SECTIONS = Object.keys(VISUAL_SECTION_CONFIG);
