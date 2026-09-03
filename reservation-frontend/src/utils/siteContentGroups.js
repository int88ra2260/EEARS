/**
 * 各文案大區塊內的小分組（依翻譯鍵規則匹配，先匹配先歸類）
 */

const GROUPS = {
  home: [
    {
      id: 'hero',
      label: 'Hero 主視覺',
      description: '首頁最上方標題、說明與主要行動按鈕',
      match: (k) => k.startsWith('homePage.hero'),
    },
    {
      id: 'quick-entry',
      label: '快速入口',
      description: '快速任務面板與 Bento 功能入口',
      match: (k) => k.startsWith('homePage.quick')
        || k.startsWith('homePage.bento')
        || k === 'homePage.quickPanelTitle'
        || k === 'homePage.quickActionsTitle',
    },
    {
      id: 'core-tasks',
      label: '核心任務',
      description: '學生常用任務卡片文案',
      match: (k) => k.startsWith('homePage.coreTasks') || k.startsWith('homePage.task'),
    },
    {
      id: 'open-sessions',
      label: '近期活動區',
      description: '首頁活動列表區塊標題與按鈕',
      match: (k) => k.startsWith('homePage.activities')
        || k.startsWith('homePage.activity')
        || k === 'homePage.viewAllActivities',
    },
    {
      id: 'steps',
      label: '使用流程',
      description: '四步驟說明',
      match: (k) => k.startsWith('homePage.steps') || /^homePage\.step\d$/.test(k),
    },
    {
      id: 'announcements',
      label: '最新公告',
      description: '公告區標題、空狀態與列表文案',
      match: (k) => k.startsWith('homePage.announcements')
        || k.startsWith('homePage.announcement')
        || k === 'homePage.pinnedBadge'
        || k === 'homePage.viewAllAnnouncements'
        || k === 'homePage.readMore'
        || k === 'homePage.noAnnouncements',
    },
    {
      id: 'student-services',
      label: '學生服務',
      description: '問卷、學習有伴、規定與公告入口',
      match: (k) => k.startsWith('homePage.studentServices') || k.startsWith('homePage.service'),
    },
    {
      id: 'home-faq',
      label: '首頁 FAQ 區塊',
      description: '首頁常見問題摘要（非 FAQ 頁）',
      match: (k) => k.startsWith('homePage.faq'),
    },
    {
      id: 'footer',
      label: '頁尾連結',
      description: '全站頁尾導覽文字',
      match: (k) => k.startsWith('homePage.footer'),
    },
    {
      id: 'notice',
      label: '重要通知橫幅',
      description: '問卷提醒等頂部通知',
      match: (k) => k.startsWith('home.notice'),
    },
    {
      id: 'rules-banner',
      label: '活動規定提醒',
      description: '不補蓋章、不開放候補等橫幅',
      match: (k) => k.startsWith('home.rule'),
    },
    {
      id: 'usage-modal',
      label: '使用說明彈窗',
      description: '預約系統使用說明與違規提醒',
      match: (k) => k.startsWith('home.usage') || k === 'home.noted',
    },
    {
      id: 'calendar',
      label: '日曆與活動元件',
      description: '活動列表、日曆提示與預約狀態',
      match: (k) => k.startsWith('home.event')
        || k.startsWith('home.calendar')
        || k === 'home.loading'
        || k === 'home.loadingEvents'
        || k === 'home.month'
        || k === 'home.list'
        || k === 'home.gotIt'
        || k === 'home.checkReservation'
        || k === 'home.faq'
        || k === 'home.activityIntro',
    },
    {
      id: 'other',
      label: '其他',
      description: '未歸入上述分類的欄位',
      match: () => true,
    },
  ],
  activities: [
    {
      id: 'page-intro',
      label: '頁面導言',
      description: '活動介紹頁開頭與流程說明',
      match: (k) => ['activitiesPage.title', 'activitiesPage.kicker', 'activitiesPage.overviewTitle',
        'activitiesPage.overviewLead', 'activitiesPage.bookFromCalendar', 'activitiesPage.flowLead',
        'activitiesPage.wordBridgeCta', 'page.activitiesLead', 'page.activityCategoryLead'].includes(k),
    },
    {
      id: 'catalog',
      label: '活動類型目錄',
      description: '四類活動總覽與時間表',
      match: (k) => k.startsWith('activitiesPage.catalog')
        || k.startsWith('activitiesPage.schedule')
        || k.startsWith('activitiesPage.table')
        || k === 'activitiesPage.calendarTitle'
        || k === 'activitiesPage.fitLabel'
        || k === 'activitiesPage.formatLabel'
        || k === 'activitiesPage.durationLabel',
    },
    {
      id: 'english-table',
      label: 'English Table',
      description: 'ET 活動說明與視覺標籤',
      match: (k) => k.startsWith('activities.et') || k.startsWith('activitiesPage.et')
        || k === 'activities.englishTable' || k.startsWith('activities.et'),
    },
    {
      id: 'english-club',
      label: 'English Club',
      description: 'EC 活動說明與視覺標籤',
      match: (k) => k.startsWith('activities.ec') || k.startsWith('activitiesPage.ec')
        || k === 'activities.englishClub',
    },
    {
      id: 'international-forum',
      label: 'International Forum',
      description: 'IF 活動說明與視覺標籤',
      match: (k) => k.startsWith('activities.if') || k.startsWith('activitiesPage.if')
        || k === 'activities.internationalForum',
    },
    {
      id: 'job-talk',
      label: 'Job Talk',
      description: 'JT 活動說明與視覺標籤',
      match: (k) => k.startsWith('activities.jt') || k.startsWith('activitiesPage.jt')
        || k === 'activities.jobTalk' || k === 'activities.jobTalkFull',
    },
    {
      id: 'list-page',
      label: '活動列表頁',
      description: '篩選、空狀態與列表通用文案',
      match: (k) => k.startsWith('activities.') && !k.startsWith('activitiesPage.'),
    },
    {
      id: 'other',
      label: '其他',
      description: '未歸入上述分類的欄位',
      match: () => true,
    },
  ],
  about: [
    {
      id: 'intro',
      label: '中心與系統介紹',
      description: 'EMI 中心與 EEARS 說明',
      match: (k) => k === 'aboutPage.centerIntro' || k === 'aboutPage.eearsIntro',
    },
    {
      id: 'teams',
      label: '團隊區塊說明',
      description: '師資與行政區塊導言',
      match: (k) => k.startsWith('aboutPage.faculty') || k.startsWith('aboutPage.admin')
        || k.startsWith('aboutPage.source') || k === 'aboutPage.viewOnCenterSite'
        || k === 'aboutPage.phoneExt',
    },
    {
      id: 'other',
      label: '其他',
      description: '未歸入上述分類的欄位',
      match: () => true,
    },
  ],
  contact: [
    {
      id: 'header',
      label: '頁面標題',
      description: '聯絡我們頁開頭',
      match: (k) => k === 'homePage.contactTitle' || k === 'homePage.contactKicker'
        || k === 'homePage.contactLead' || k === 'homePage.contactPageLink',
    },
    {
      id: 'details',
      label: '聯絡資訊',
      description: '地址、電話、Email 與服務時間',
      match: (k) => k.startsWith('homePage.contact') && !['homePage.contactTitle', 'homePage.contactKicker',
        'homePage.contactLead', 'homePage.contactPageLink'].includes(k),
    },
    {
      id: 'other',
      label: '其他',
      description: '未歸入上述分類的欄位',
      match: () => true,
    },
  ],
  legal: [
    {
      id: 'privacy',
      label: '隱私權政策',
      description: '隱私權全文各段落',
      match: (k) => k.startsWith('privacyPage.'),
    },
    {
      id: 'terms',
      label: '使用條款',
      description: '使用條款全文各段落',
      match: (k) => k.startsWith('termsPage.'),
    },
    {
      id: 'other',
      label: '其他',
      description: '未歸入上述分類的欄位',
      match: () => true,
    },
  ],
  rules_modal: [
    {
      id: 'legacy',
      label: '已下架彈窗文案',
      description: '舊活動規定彈窗已不再顯示於學生端',
      match: () => true,
    },
  ],
};

function resolveGroup(section, contentKey) {
  const rules = GROUPS[section] || [{ id: 'all', label: '全部', description: '', match: () => true }];
  return rules.find((g) => g.match(contentKey)) || rules[rules.length - 1];
}

export function groupTextItems(section, items = []) {
  const rules = GROUPS[section] || [{ id: 'all', label: '全部', description: '所有文案' }];
  const buckets = new Map(rules.map((g) => [g.id, { ...g, items: [] }]));

  items.forEach((item) => {
    const group = resolveGroup(section, item.contentKey);
    const bucket = buckets.get(group.id) || buckets.get('other');
    if (bucket) bucket.items.push(item);
  });

  return rules
    .map((g) => buckets.get(g.id))
    .filter((b) => b && b.items.length > 0);
}

export function previewTypographyClass(contentKey = '') {
  if (/heroTitle|overviewTitle|catalogTitle|scheduleTitle|stepsTitle|announcementsTitle|studentServicesTitle|faqTitle|title$/.test(contentKey)) {
    return 'scm-preview__title';
  }
  if (/Eyebrow|Kicker|Meta|kicker$/.test(contentKey)) {
    return 'scm-preview__kicker';
  }
  if (/Cta|Btn|Book|Link|Reserve|LearnMore|viewAll|readMore/i.test(contentKey)) {
    return 'scm-preview__cta';
  }
  if (/faq\dQ|Question|Step\d$/.test(contentKey)) {
    return 'scm-preview__heading';
  }
  return 'scm-preview__body';
}
