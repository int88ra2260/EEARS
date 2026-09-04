import { SCOPE } from './scopes';

export const ACCOUNT_ACTION_MENU_POPPER = {
  strategy: 'fixed',
  placement: 'bottom-end',
  modifiers: [
    { name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } },
    { name: 'flip', options: { fallbackPlacements: ['top-end', 'bottom-start'] } },
  ],
};

export const ROLE_OPTIONS = [
  { value: 'all', label: '全部角色' },
  { value: 'admin', label: '系統管理員' },
  { value: 'teacher', label: '老師' },
  { value: 'office_staff', label: '行政職員' },
  { value: 'leader', label: '英語桌帶班（ET Leader）' },
  { value: 'worker', label: '工讀生' },
];

export const TEACHER_LEVEL_OPTIONS = [
  { value: 'regular', label: '一般老師' },
  { value: 'executive', label: '執行長' },
  { value: 'et_manager', label: 'English Table 負責人' },
  { value: 'if_manager', label: 'International Forum 負責人' },
  { value: 'jt_manager', label: 'Job Talk 負責人' },
];

export const STAFF_LEVEL_OPTIONS = [
  { value: 'event_lead', label: '活動行政' },
  { value: 'curriculum_lead', label: '課務行政' },
  { value: 'bestep_lead', label: '培力英檢行政' },
  { value: 'deputy_manager', label: '副理' },
];

export const WORKER_LEVEL_OPTIONS = [
  { value: 'event_ops', label: '活動相關' },
  { value: 'bestep_ops', label: '培力相關' },
  { value: 'content_editor', label: '小編' },
  { value: 'passport_ops', label: '實踐歷程檔案' },
];

export const WORKER_LEVEL_SUMMARY = {
  event_ops: {
    description: '負責活動預約、簽到、違規與 ET 分組檢視／匯出（不含帳號與系統設定）。',
    permissions: [
      '活動列表與管理',
      '預約與簽到',
      '合規與違規',
      'ET 分組檢視／匯出',
      '變更密碼',
    ],
  },
  bestep_ops: {
    description: '負責培力英檢報名審核、追蹤與 BESTEP 匯入匯出（不含帳號與系統設定）。',
    permissions: [
      '英檢報名與審核',
      '英檢追蹤',
      'BESTEP 匯入',
      'BESTEP 匯出',
      '變更密碼',
    ],
  },
  content_editor: {
    description: '負責公告、週報與學生端內容編輯（不含系統設定）。',
    permissions: ['公告與週報', '學生端內容', '變更密碼'],
  },
  passport_ops: {
    description: '負責英語實踐歷程護照檢視、管理、審核與匯出（不含規則設定）。',
    permissions: [
      '實踐歷程護照檢視',
      '實踐歷程護照管理',
      '繳交審核',
      '匯出',
      '變更密碼',
    ],
  },
};

export const STAFF_LEVEL_SUMMARY = {
  event_lead: {
    description: '負責活動預約、合規違規、護照、公告週報、學生端內容；帳號管理僅限 ET Leader。',
    permissions: [
      '活動列表（完整）',
      '簽到參與統計',
      '合規與違規',
      '英語實踐歷程護照（含規則設定）',
      '公告與週報',
      '學生端內容',
      'ET Leader 帳號管理',
      '變更密碼',
    ],
  },
  curriculum_lead: {
    description: '負責班級、BESTEP 匯入匯出與課務相關名單。',
    permissions: ['班級檢視', '班級管理', 'BESTEP 匯入', 'BESTEP 匯出', '名單作業'],
  },
  bestep_lead: {
    description: '負責培力英檢、英語學習歷程中心、公告週報與學生端內容；帳號區僅可自行變更密碼。',
    permissions: [
      '英檢與培力（全部）',
      '英語學習歷程中心',
      '公告與週報',
      '學生端內容',
      '變更密碼',
    ],
  },
  deputy_manager: {
    description: '跨活動預約、英檢培力、公告週報、學生端內容與帳號治理（不含 admin／執行長）。',
    permissions: [
      '活動預約（全部）',
      '英檢與培力（全部）',
      '公告與週報',
      '學生端內容',
      '帳號管理（不含 admin／執行長）',
    ],
  },
};

export const TEACHER_LEVEL_FILTER_OPTIONS = [
  { value: 'all', label: '全部老師層級' },
  ...TEACHER_LEVEL_OPTIONS,
];

export const STAFF_LEVEL_FILTER_OPTIONS = [
  { value: 'all', label: '全部行政職務' },
  ...STAFF_LEVEL_OPTIONS,
];

export const WORKER_LEVEL_FILTER_OPTIONS = [
  { value: 'all', label: '全部工讀職務' },
  ...WORKER_LEVEL_OPTIONS,
];

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: '全部狀態' },
  { value: 'active', label: '啟用' },
  { value: 'inactive', label: '停用' },
];

export const MUST_RESET_FILTER_OPTIONS = [
  { value: 'all', label: '全部密碼狀態' },
  { value: 'true', label: '須改密碼' },
  { value: 'false', label: '不須改密碼' },
];

export const SYSTEM_OVERRIDE_FILTER_OPTIONS = [
  { value: 'all', label: '全部覆寫' },
  { value: 'has', label: '含系統層級覆寫' },
  { value: 'none', label: '不含系統層級覆寫' },
];

export const ROLE_BADGE_DEFAULT = { bg: 'light', text: 'dark' };

export const ROLE_BADGE_SOFT = {
  admin: { bg: 'danger-subtle', text: 'danger-emphasis' },
  teacher: { bg: 'success-subtle', text: 'success-emphasis' },
  office_staff: { bg: 'info-subtle', text: 'info-emphasis' },
  leader: { bg: 'warning-subtle', text: 'warning-emphasis' },
  worker: { bg: 'primary-subtle', text: 'primary-emphasis' },
};

export const TEACHER_LEVEL_TABLE_LABEL = {
  regular: '一般',
  executive: '執行長',
  et_manager: 'ET',
  if_manager: 'IF',
  jt_manager: 'JT',
};

export const STAFF_LEVEL_TABLE_LABEL = {
  event_lead: '活動',
  curriculum_lead: '課務',
  bestep_lead: '英檢',
  deputy_manager: '副理',
};

export const WORKER_LEVEL_TABLE_LABEL = {
  event_ops: '活動',
  bestep_ops: '培力',
  content_editor: '小編',
  passport_ops: '歷程',
};

export const PERM_OVERRIDE_MODES = [
  { value: 'inherit', label: '沿用', title: '沿用角色與職務的預設權限', activeVariant: 'secondary' },
  { value: 'allow', label: '加開', title: '即使預設未包含，也強制允許此功能', activeVariant: 'success' },
  { value: 'deny', label: '關閉', title: '即使預設包含，也強制關閉此功能', activeVariant: 'danger' },
];

export const SCOPE_LABELS = {
  [SCOPE.ALL]: '全部業務',
  [SCOPE.ENGLISH_TABLE]: 'English Table',
  [SCOPE.INTERNATIONAL_FORUM]: 'International Forum',
  [SCOPE.JOB_TALK]: 'Job Talk',
  [SCOPE.ENGLISH_CLUB]: 'English Club',
  [SCOPE.CLASS]: '班級與課務',
  [SCOPE.SURVEY_ENGLISH_TABLE]: 'English Table 問卷',
  [SCOPE.SURVEY_ENGLISH_CLUB]: 'English Club 問卷',
  [SCOPE.ENGLISH_TEST]: '培力英檢',
};

export const SCOPE_HINTS = {
  [SCOPE.ALL]: '可存取所有後台業務範圍；通常僅管理員、執行長或副理使用。',
  [SCOPE.ENGLISH_TABLE]: 'English Table 活動、預約與相關名單。',
  [SCOPE.INTERNATIONAL_FORUM]: 'International Forum 活動、預約與相關名單。',
  [SCOPE.JOB_TALK]: 'Job Talk 活動、預約與相關名單。',
  [SCOPE.ENGLISH_CLUB]: 'English Club 活動、預約與相關名單。',
  [SCOPE.CLASS]: '班級、課務與 BESTEP 匯入資料。',
  [SCOPE.SURVEY_ENGLISH_TABLE]: 'English Table 相關問卷與分析資料。',
  [SCOPE.SURVEY_ENGLISH_CLUB]: 'English Club 相關問卷與分析資料。',
  [SCOPE.ENGLISH_TEST]: '培力英檢報名、審核、匯出與追蹤資料。',
};

export const DEFAULT_FILTERS = {
  role: 'all',
  teacherLevel: 'all',
  staffLevel: 'all',
  workerLevel: 'all',
  status: 'all',
  mustResetPassword: 'all',
  systemOverride: 'all',
  search: '',
};

export const EMPTY_CREATE_FORM = {
  name: '',
  username: '',
  email: '',
  studentId: '',
  role: 'teacher',
  teacherLevel: 'regular',
  staffLevel: 'event_lead',
  workerLevel: 'event_ops',
  department: '',
  phone: '',
  password: '',
};
