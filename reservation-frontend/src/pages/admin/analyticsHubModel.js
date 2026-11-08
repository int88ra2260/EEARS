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
    label: '高關注名單',
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
    id: 'bestep-analytics',
    label: 'BESTEP 數據分析',
    to: '/admin/english-test?tab=analytics',
    accessPath: '/admin/english-test',
    detail: '全中心的報名、出席紀錄與四技能。出席缺漏不是確認缺席。這不是班級頁，也不是學習成效快照。通過率尚未核定。',
    primary: true,
  },
  {
    id: 'classes',
    label: '班級列表',
    to: '/admin/classes',
    detail: '進入班級後可看該班 BESTEP。這裡不組班級網址，也不顯示個人成績。',
  },
];

const LEARNING_LINKS = [
  {
    id: 'overview',
    label: '學習成效概況',
    to: '/admin/learning-analytics/overview',
    detail: '分析快照的能力分布。不是學期名冊，也不是聽讀成對 KPI。',
    primary: true,
  },
  {
    id: 'kpi',
    label: '學期 B2 KPI',
    to: '/admin/learning-analytics/kpi-report',
    detail: '學期名冊的聽讀成對與說寫成對。不與分析快照人數相加。',
  },
  {
    id: 'students',
    label: '找學生',
    to: '/admin/learning-analytics/explore',
    detail: '依條件找學生，並可開啟個人學習紀錄。篩選留在這個工作區。',
  },
  {
    id: 'resources',
    label: '資源與開課',
    to: '/admin/learning-analytics/resources',
    detail: '參與覆蓋，以及課程、教師與活動觀察，是同一工作區的兩種模式。人數不是事件次數。',
  },
  {
    id: 'comparison',
    label: '群體與技能比較',
    to: '/admin/learning-analytics/cohorts',
    detail: '群體英檢覆蓋與四技能前後測。缺少技能資料不是沒有測驗。',
  },
];

function gateLink(accessProfile, link) {
  const path = link.accessPath || String(link.to).split('?')[0];
  const allowed = canAccessAdminRoute(accessProfile, path);
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
        title: 'BESTEP 數據分析',
        summary: '全中心的報名、出席紀錄與四技能在 BESTEP 數據分析。班級頁只代表該班，不能代替全中心。通過率尚未核定，不能當成官方達標率。',
        scope: '全中心與單一班級是不同母體。時間跟培力英檢學期與測驗資料走，不沿用營運頁的活動日期，也不是學習成效快照。',
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
