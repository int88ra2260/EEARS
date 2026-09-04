import { useEffect } from 'react';

const DEFAULT_TITLE = 'EEARS｜中山大學全英語卓越教學中心';
const DEFAULT_TITLE_EN = 'EEARS | NSYSU Center for EMI Excellence';
const DEFAULT_DESC = '國立中山大學全英語卓越教學中心（EMI Center）英語增能活動預約系統，提供 English Table、English Club、International Forum 等活動預約與資訊查詢。';
const DEFAULT_DESC_EN = 'National Sun Yat-sen University Center for EMI Excellence — Reserve English Table, English Club, International Forum and more.';

const PAGE_META = {
  '/': { zh: { title: DEFAULT_TITLE, desc: DEFAULT_DESC }, en: { title: DEFAULT_TITLE_EN, desc: DEFAULT_DESC_EN } },
  '/activities': { zh: { title: '活動總覽 | EEARS', desc: 'English Table、English Club、International Forum、BESTEP 等活動介紹與預約。' }, en: { title: 'Activities | EEARS', desc: 'English Table, English Club, International Forum, BESTEP — intro and reservation.' } },
  '/announcements': { zh: { title: '最新公告 | EEARS', desc: 'EMI Center 最新公告與活動訊息。' }, en: { title: 'Announcements | EEARS', desc: 'EMI Center announcements and updates.' } },
  '/learning-resources': { zh: { title: '學習資源 | EEARS', desc: '練習遊戲、口說指南與英語學習素材。' }, en: { title: 'Learning Resources | EEARS', desc: 'Practice games, speaking guides, and English learning materials.' } },
  '/course-guide': { zh: { title: '修課說明 | EEARS', desc: '英文畢業標準、修課與認證規定說明。' }, en: { title: 'Course Guide | EEARS', desc: 'Graduation English standards, courses, and certification guide.' } },
  '/regulations-forms': { zh: { title: '法規表單 | EEARS', desc: '常見問題、隱私權政策與使用條款等規範入口。' }, en: { title: 'Regulations & Forms | EEARS', desc: 'FAQ, privacy policy, terms of use, and related forms.' } },
  '/my-reservations': { zh: { title: '我的預約 | EEARS', desc: '查詢或取消您的活動預約。' }, en: { title: 'My Reservations | EEARS', desc: 'Check or cancel your activity reservations.' } },
  '/survey': { zh: { title: '問卷 | EEARS', desc: '學期問卷與活動問卷。' }, en: { title: 'Survey | EEARS', desc: 'Semester and activity surveys.' } },
  '/faq': { zh: { title: '常見問題 | EEARS', desc: '預約、取消、違規與黑名單常見問題。' }, en: { title: 'FAQ | EEARS', desc: 'Reservation, cancellation, violations and FAQ.' } },
  '/about': {
    zh: { title: '關於我們 | EEARS', desc: '中心介紹、聯絡資訊與常見問題。' },
    en: { title: 'About | EEARS', desc: 'About the Center, contact information, and FAQ.' },
  },
  '/contact': { zh: { title: '聯絡我們 | EEARS', desc: 'EMI Center 聯絡方式與服務時間。' }, en: { title: 'Contact | EEARS', desc: 'EMI Center contact and hours.' } },
  '/privacy': { zh: { title: '隱私權政策 | EEARS', desc: 'EEARS 隱私權政策與個人資料保護說明。' }, en: { title: 'Privacy Policy | EEARS', desc: 'EEARS privacy policy and data protection.' } },
  '/terms': { zh: { title: '使用條款 | EEARS', desc: 'EEARS 使用條款與服務規範。' }, en: { title: 'Terms of Use | EEARS', desc: 'EEARS terms of use and service rules.' } },
  '/login': { zh: { title: '登入 | EEARS', desc: '管理員／教師登入。' }, en: { title: 'Login | EEARS', desc: 'Admin / teacher login.' } },
  '/admin': { zh: { title: '管理後台 | EEARS', desc: '活動與預約管理。' }, en: { title: 'Admin | EEARS', desc: 'Activity and reservation management.' } },
  '/403': { zh: { title: '403 禁止存取 | EEARS', desc: '' }, en: { title: '403 Forbidden | EEARS', desc: '' } },
  '/404': { zh: { title: '404 找不到頁面 | EEARS', desc: '' }, en: { title: '404 Not Found | EEARS', desc: '' } },
};

function getMetaForPath(pathname, isZh) {
  const exact = PAGE_META[pathname];
  if (exact) return isZh ? exact.zh : exact.en;
  if (pathname.startsWith('/activities/')) return isZh ? PAGE_META['/activities'].zh : PAGE_META['/activities'].en;
  if (pathname.startsWith('/announcements/')) return isZh ? PAGE_META['/announcements'].zh : PAGE_META['/announcements'].en;
  if (pathname.startsWith('/survey')) return isZh ? PAGE_META['/survey'].zh : PAGE_META['/survey'].en;
  if (pathname.startsWith('/admin')) return isZh ? PAGE_META['/admin'].zh : PAGE_META['/admin'].en;
  return isZh ? { title: DEFAULT_TITLE, desc: DEFAULT_DESC } : { title: DEFAULT_TITLE_EN, desc: DEFAULT_DESC_EN };
}

/**
 * 依路由與語系設定 document.title、html lang、meta description（SEO）
 */
export default function usePageMeta(pathname, lang) {
  const isZh = lang === 'zh';

  useEffect(() => {
    document.documentElement.lang = isZh ? 'zh-Hant' : 'en';
  }, [isZh]);

  useEffect(() => {
    const { title, desc } = getMetaForPath(pathname, isZh);
    document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && desc) metaDesc.setAttribute('content', desc);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && desc) ogDesc.setAttribute('content', desc);
  }, [pathname, isZh]);
}
