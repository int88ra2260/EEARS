/**
 * 學生端可從後台編輯的文案鍵白名單（依 section 前綴驗證）
 */
const SITE_CONTENT_SECTIONS = Object.freeze({
  home: {
    label: '首頁',
    prefixes: ['homePage.', 'home.notice', 'home.rule', 'home.usage'],
  },
  activities: {
    label: '活動介紹',
    prefixes: ['activitiesPage.', 'activities.', 'page.activitiesLead', 'page.activityCategoryLead'],
  },
  about: {
    label: '關於我們',
    prefixes: ['aboutPage.'],
  },
  contact: {
    label: '聯絡我們',
    prefixes: ['homePage.contact'],
  },
  legal: {
    label: '隱私權／使用條款',
    prefixes: ['privacyPage.', 'termsPage.'],
  },
  faq: {
    label: '常見問題',
    prefixes: [],
  },
  rules_modal: {
    label: '活動規定／FAQ 彈窗',
    prefixes: ['faq.'],
  },
  staff_faculty: {
    label: '師資名單',
    prefixes: [],
  },
  staff_admin: {
    label: '行政團隊',
    prefixes: [],
  },
});

const VALID_SECTIONS = Object.keys(SITE_CONTENT_SECTIONS);
const STAFF_SECTIONS = Object.freeze(['staff_faculty', 'staff_admin']);
const STRUCTURED_SECTIONS = Object.freeze(['faq', ...STAFF_SECTIONS]);

function isStaffSection(section) {
  return STAFF_SECTIONS.includes(section);
}

function staffGroupFromSection(section) {
  if (section === 'staff_faculty') return 'faculty';
  if (section === 'staff_admin') return 'admin';
  return null;
}

function isValidSection(section) {
  return VALID_SECTIONS.includes(section);
}

function isAllowedTextKey(section, contentKey) {
  if (!contentKey || typeof contentKey !== 'string') return false;
  const cfg = SITE_CONTENT_SECTIONS[section];
  if (!cfg || STRUCTURED_SECTIONS.includes(section)) return false;
  return cfg.prefixes.some((prefix) => contentKey.startsWith(prefix));
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,78}$/;

function isValidStaffSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

module.exports = {
  SITE_CONTENT_SECTIONS,
  VALID_SECTIONS,
  STAFF_SECTIONS,
  STRUCTURED_SECTIONS,
  isStaffSection,
  staffGroupFromSection,
  isValidSection,
  isAllowedTextKey,
  isValidStaffSlug,
};
