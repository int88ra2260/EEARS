import { canAccessAdminRoute } from '../../constants/adminRouteAccess';
import { getAdminRoleHomeLabel, getAdminRoleHomePath } from '../../constants/adminNavigation';

export const ANALYTICS_HUB_PATH = '/admin/analytics';

const OPERATIONS_LINKS = [
  {
    id: 'overview',
    label: '活動營運總覽',
    to: '/admin/analytics/overview',
    detail: '活動供給、預約列、出席與行政例外。',
    primary: true,
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
    detail: '進入班級列表後，用該列的「查看 BESTEP 分析」開啟該班。這裡不組班級網址，也不顯示個人成績。',
    primary: true,
  },
];

const LEARNING_LINKS = [
  {
    id: 'resources',
    label: '資源覆蓋',
    to: '/admin/learning-analytics/resources',
    detail: '已掛學號的資源接觸。人數不是事件次數，接觸不是效果。',
    primary: true,
  },
  {
    id: 'students',
    label: '個人軌跡',
    to: '/admin/learning-analytics/students',
    detail: '個人歷程。沒有紀錄不能當成沒有參與。',
  },
  {
    id: 'offerings',
    label: '課／師／活動',
    to: '/admin/learning-analytics/offerings',
    detail: '課、師、活動的參與樣本與資料是否夠用。',
  },
  {
    id: 'overview',
    label: '能力總覽',
    to: '/admin/learning-analytics/overview',
    detail: '分析快照的能力分布。探索性觀察，不是因果。',
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
        scope: '統計單位是活動名額與預約列，時間用活動日期。預約筆數不是不重複學生數。',
        links: OPERATIONS_LINKS.map((link) => gateLink(accessProfile, link)),
      },
      {
        id: 'bestep',
        title: 'BESTEP 測驗分析',
        summary: '報名、到考與四技能在班級頁。班級統計不是全校測驗分析。通過率尚未核定，不能當成官方達標率。',
        scope: '統計單位是該班報名、出席與技能分。時間跟班級學期與測驗資料走，不沿用營運頁的活動日期。',
        links: BESTEP_LINKS.map((link) => gateLink(accessProfile, link)),
      },
      {
        id: 'learning',
        title: '學習參與與歷程',
        summary: '資源接觸、參與歷程與可觀察的測驗變化。這是探索性分析，不能解讀成某個活動造成了進步。',
        scope: '人數、事件與測驗觀察是不同單位。各來源的時間也不相同。接觸與成長都不是已確認的因果效果。',
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
