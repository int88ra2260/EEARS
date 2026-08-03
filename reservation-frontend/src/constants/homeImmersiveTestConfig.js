/**
 * A 方案測試頁 — 四島敘事（質感對齊 B / scroll-world）
 * 僅供 /hometest，不影響正式首頁
 */
export const HOME_IMMERSIVE_JOURNEY = [
  {
    id: 'events',
    diorama: 'events',
    accent: '#D4564A',
    eyebrow: { zh: 'Activities', en: 'Activities' },
    label: { zh: '活動', en: 'Events' },
    title: { zh: '從預約到簽到，一站完成', en: 'From booking to check-in' },
    body: {
      zh: 'English Table、English Club、Job Talk——不用登入，就能預約並參與中心活動。',
      en: 'English Table, English Club, Job Talk — book and join without creating an account.',
    },
    tags: {
      zh: ['活動預約', '候補名單', '簽到管理'],
      en: ['Booking', 'Waitlist', 'Check-in'],
    },
    cta: { zh: '前往活動預約', en: 'Book an event', to: '/events' },
  },
  {
    id: 'courses',
    diorama: 'courses',
    accent: '#3D7C6E',
    eyebrow: { zh: 'Course Affairs', en: 'Course Affairs' },
    label: { zh: '課務', en: 'Courses' },
    title: { zh: '培力英檢與班級支持', en: 'BESTEP and class support' },
    body: {
      zh: '培力英檢報名與課務相關服務，協助你掌握學習進度與考試安排。',
      en: 'BESTEP registration and course support to keep your learning on track.',
    },
    tags: {
      zh: ['BESTEP', '班級概況', '課程編排'],
      en: ['BESTEP', 'Classes', 'Scheduling'],
    },
    cta: { zh: '英檢報名', en: 'English test registration', to: '/register/english-test' },
  },
  {
    id: 'learning',
    diorama: 'learning',
    accent: '#5B6BB5',
    eyebrow: { zh: 'Learning Journey', en: 'Learning Journey' },
    label: { zh: '學習', en: 'Learning' },
    title: { zh: '學習歷程與英語護照', en: 'Learning journey & passport' },
    body: {
      zh: '英語學習護照與學習資源，把每一次參與累積成看得見的成長。',
      en: 'The English Learning Passport turns every activity into visible progress.',
    },
    tags: {
      zh: ['Learning Journey', '學習有伴', '英語護照'],
      en: ['Learning Journey', 'Partners', 'Passport'],
    },
    cta: {
      zh: '英語學習護照',
      en: 'English Learning Passport',
      to: '/student/english-learning-passport',
    },
  },
  {
    id: 'other',
    diorama: 'other',
    accent: '#8A6BB5',
    eyebrow: { zh: 'And More', en: 'And More' },
    label: { zh: '其他', en: 'More' },
    title: { zh: '問卷、公告與更多服務', en: 'Surveys, news, and more' },
    body: {
      zh: '活動問卷、中心公告與常見問題，讓你隨時掌握最新資訊。',
      en: 'Surveys, announcements, and FAQs so you always know what’s next.',
    },
    tags: {
      zh: ['問卷系統', '公告週報', '延伸服務'],
      en: ['Surveys', 'News', 'Support'],
    },
    cta: { zh: '查看公告', en: 'Announcements', to: '/announcements' },
  },
];

export const HOME_IMMERSIVE_QUICK_LINKS = [
  {
    to: '/my-reservations',
    titleKey: 'homePage.quickMyReservation',
    descKey: 'homePage.quickMyReservationDesc',
  },
  {
    to: '/survey/choice',
    titleKey: 'homePage.quickSurvey',
    descKey: 'homePage.quickSurveyDesc',
  },
  {
    to: '/student/english-learning-passport',
    titleKey: 'homePage.quickPassport',
    descKey: 'homePage.quickPassportDesc',
  },
  {
    to: '/faq',
    titleKey: 'homePage.quickRules',
    descKey: 'homePage.quickRulesDesc',
  },
];
