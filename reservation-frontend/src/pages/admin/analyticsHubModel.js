import { canAccessAdminRoute } from '../../constants/adminRouteAccess';
import { getAdminRoleHomeLabel, getAdminRoleHomePath } from '../../constants/adminNavigation';

export const ANALYTICS_HUB_PATH = '/admin/analytics';

const OPERATIONS_LINKS = [
  {
    id: 'overview',
    label: '活動營運總覽',
    to: '/admin/analytics/overview',
    detail: '活動供給、預約列、出席與行政例外。',
  },
  {
    id: 'risk',
    label: '高風險行政追蹤',
    to: '/admin/analytics/risk',
    detail: '既有行政例外清單。',
  },
  {
    id: 'reports',
    label: '營運報表下載',
    to: '/admin/reports',
    detail: '下載既有營運報表。',
  },
];

const BESTEP_LINKS = [
  {
    id: 'classes',
    label: '班級列表',
    to: '/admin/classes',
    detail: '從班級進入該班的報名、到考與四技能。這不是全校彙總。',
  },
];

const LEARNING_LINKS = [
  {
    id: 'resources',
    label: '資源覆蓋',
    to: '/admin/learning-analytics/resources',
    detail: '學生接觸過哪些學習資源。',
  },
  {
    id: 'students',
    label: '個人軌跡',
    to: '/admin/learning-analytics/students',
    detail: '有權限時查看參與歷程。',
  },
  {
    id: 'offerings',
    label: '課／師／活動',
    to: '/admin/learning-analytics/offerings',
    detail: '參與樣本與細項資料是否夠用。',
  },
  {
    id: 'overview',
    label: '能力總覽',
    to: '/admin/learning-analytics/overview',
    detail: '分析快照的分布。',
  },
];

function gateLink(accessProfile, link) {
  const allowed = canAccessAdminRoute(accessProfile, link.to);
  return {
    ...link,
    allowed,
    status: allowed ? '可進入' : '沒有權限',
  };
}

export function buildAnalyticsHub(accessProfile) {
  return {
    homePath: getAdminRoleHomePath(accessProfile),
    homeLabel: getAdminRoleHomeLabel(accessProfile),
    sections: [
      {
        id: 'operations',
        title: '中心營運分析',
        summary: '看活動供給、預約、出席與行政例外。報名資料的 B2 標記不是活動造成的語言能力提升，也不能當成學習成效。',
        links: OPERATIONS_LINKS.map((link) => gateLink(accessProfile, link)),
      },
      {
        id: 'bestep',
        title: 'BESTEP 測驗分析',
        summary: '報名、到考與四技能在班級頁。班級統計不是全校測驗分析。通過率尚未核定，不能當成官方達標率。',
        links: BESTEP_LINKS.map((link) => gateLink(accessProfile, link)),
      },
      {
        id: 'learning',
        title: '學習參與與歷程',
        summary: '資源接觸、參與歷程與可觀察的測驗變化。這是探索性分析，不能解讀成某個活動造成了進步。',
        links: LEARNING_LINKS.map((link) => gateLink(accessProfile, link)),
      },
      {
        id: 'quality',
        title: '資料品質與使用限制',
        summary: '這裡只說明限制。沒有品質分數，也不代表正式環境有即時診斷。',
        links: [],
        notes: [
          '未知出席不是缺席，也不是零分。',
          '總分 0 是已記錄的分數；沒有分數是缺失；尚未匯入是未觀察。',
          '三個 Shadow 預設關閉。此頁沒有即時診斷結果。',
          '班級通過率與調整後成長尚未核定。這是政策待決，不是系統故障。',
        ],
      },
    ],
  };
}
