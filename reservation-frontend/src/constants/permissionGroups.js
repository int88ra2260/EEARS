/**
 * 帳號管理 UI：權限分組與 system-only 標記（與後端 auth/permissionAssignmentPolicy.js 對齊）
 */
import { P } from './permissions';

/** 僅 role=admin 可於帳號管理指派／變更覆寫（與後端 SYSTEM_ONLY_ASSIGNMENT_KEYS 一致） */
export const SYSTEM_ONLY_ASSIGNMENT_KEYS = new Set([
  P.CAN_VIEW_AUDIT_LOGS,
  P.CAN_VIEW_INTERNAL_DIAGNOSTICS,
  P.CAN_MANAGE_SETTINGS,
  P.CAN_MANAGE_FEATURE_FLAGS,
]);

export function isSystemAdminActor(accessProfile) {
  return !!(accessProfile && accessProfile.role === 'admin');
}

export function isEventLeadAccountManager(accessProfile) {
  return isLeaderOnlyAccountManager(accessProfile);
}

/** 帳號管理僅限 ET Leader：活動行政、English Table／Job Talk 負責人 */
export function isLeaderOnlyAccountManager(accessProfile) {
  if (!accessProfile) return false;
  if (
    accessProfile.role === 'office_staff'
    && (accessProfile.staffLevel || 'event_lead') === 'event_lead'
  ) {
    return true;
  }
  if (
    accessProfile.role === 'teacher'
    && (accessProfile.teacherLevel === 'et_manager' || accessProfile.teacherLevel === 'jt_manager')
  ) {
    return true;
  }
  return false;
}

export function isPrivilegedManagedAccount(account) {
  if (!account) return false;
  return account.role === 'admin';
}

export function canActorManageAccount(accessProfile, account) {
  if (!account) return false;
  if (isSystemAdminActor(accessProfile)) return true;
  if (isLeaderOnlyAccountManager(accessProfile)) {
    return account.role === 'leader';
  }
  if (isPrivilegedManagedAccount(account)) return false;
  return true;
}

export function canActorAssignPermission(accessProfile, permissionKey) {
  if (isSystemAdminActor(accessProfile)) {
    return { assignable: true, reason: '' };
  }
  if (SYSTEM_ONLY_ASSIGNMENT_KEYS.has(permissionKey)) {
    return { assignable: false, reason: '此權限僅系統管理員可指派' };
  }
  return { assignable: true, reason: '' };
}

/** 每個權限：中文名、簡述、是否 system-only（僅供 UI 說明） */
export const PERMISSION_FIELD_META = {
  [P.CAN_MANAGE_ACCOUNTS]: {
    label: '帳號管理',
    description: '建立／編輯帳號、重設他人密碼等治理操作。',
    systemOnly: false,
  },
  [P.CAN_RESET_PASSWORDS]: {
    label: '重設他人密碼',
    description: '為其他使用者產生臨時密碼（不含密碼本體寫入日誌）。',
    systemOnly: false,
  },
  [P.CAN_VIEW_EVENTS_ADMIN]: {
    label: '活動後台檢視',
    description: '後台活動／報表相關檢視。',
    systemOnly: false,
  },
  [P.CAN_MANAGE_EVENTS]: {
    label: '活動管理',
    description: '建立與維護活動資料。',
    systemOnly: false,
  },
  [P.CAN_VIEW_RESERVATIONS]: {
    label: '預約名單檢視',
    description: '檢視預約與名單。',
    systemOnly: false,
  },
  [P.CAN_MANAGE_RESERVATIONS]: {
    label: '預約名單管理',
    description: '維護預約狀態與名單內容。',
    systemOnly: false,
  },
  [P.CAN_EXPORT_RESERVATIONS]: {
    label: '預約匯出',
    description: '匯出預約相關報表。',
    systemOnly: false,
  },
  [P.CAN_CHECKIN_STUDENTS]: {
    label: '簽到作業',
    description: '現場簽到與名單勾稽。',
    systemOnly: false,
  },
  [P.CAN_VIEW_ET_GROUPING]: {
    label: 'ET 能力分組檢視',
    description: '檢視 ET 場次能力分組與 GSE 快照。',
    systemOnly: false,
  },
  [P.CAN_MANAGE_ET_GROUPING]: {
    label: 'ET 能力分組管理',
    description: '產生、調整與發布 ET 能力分組。',
    systemOnly: false,
  },
  [P.CAN_MARK_ET_SESSION_TASKS]: {
    label: 'ET 場次任務勾選',
    description: 'Leader 於場後勾選學生任務完成情形。',
    systemOnly: false,
  },
  [P.CAN_EXPORT_ET_GROUPING]: {
    label: 'ET 分組成效匯出',
    description: '匯出分組、GSE 與任務完成報表。',
    systemOnly: false,
  },
  [P.CAN_VIEW_SURVEYS]: { label: '問卷檢視', description: '檢視問卷設定與清單。', systemOnly: false },
  [P.CAN_MANAGE_SURVEYS]: { label: '問卷管理', description: '建立與維護問卷。', systemOnly: false },
  [P.CAN_EXPORT_SURVEYS]: { label: '問卷匯出', description: '匯出問卷設定或結構。', systemOnly: false },
  [P.CAN_MANAGE_SURVEY_SETTINGS]: { label: '問卷設定管理', description: '問卷系統層設定。', systemOnly: false },
  [P.CAN_MANAGE_SURVEY_RULES]: { label: '問卷規則管理', description: '規則與邏輯維護。', systemOnly: false },
  [P.CAN_PUBLISH_SURVEYS]: { label: '問卷發布', description: '發布／上下架問卷。', systemOnly: false },
  [P.CAN_VIEW_SURVEY_RESPONSES]: { label: '問卷作答檢視', description: '檢視填答內容。', systemOnly: false },
  [P.CAN_EXPORT_SURVEY_RESPONSES]: { label: '問卷作答匯出', description: '匯出填答資料。', systemOnly: false },
  [P.CAN_VIEW_SURVEY_ANALYTICS]: { label: '問卷分析檢視', description: '問卷統計與分析。', systemOnly: false },
  [P.CAN_VIEW_SURVEY_HEALTH]: { label: '問卷資料健康', description: '資料品質與健康度。', systemOnly: false },
  [P.CAN_EXECUTE_SURVEY_REPAIRS]: { label: '問卷修復執行', description: '執行修復作業。', systemOnly: false },
  [P.CAN_MANAGE_SURVEY_ANSWER_MAPPING]: { label: '問卷答案映射', description: '答案對應表維護。', systemOnly: false },
  [P.CAN_VIEW_SURVEY_REPAIR_AUDIT]: { label: '問卷修復稽核', description: '修復紀錄與稽核。', systemOnly: false },
  [P.CAN_VIEW_CLASSES]: { label: '班級檢視', description: '班級與成員檢視。', systemOnly: false },
  [P.CAN_MANAGE_CLASSES]: { label: '班級管理', description: '班級資料維護。', systemOnly: false },
  [P.CAN_IMPORT_BESTEP]: { label: 'BESTEP 匯入', description: '匯入 BESTEP 資料。', systemOnly: false },
  [P.CAN_EXPORT_BESTEP]: { label: 'BESTEP 匯出', description: '匯出 BESTEP 資料。', systemOnly: false },
  [P.CAN_VIEW_ENGLISH_TEST_METRICS]: { label: '英檢總覽指標', description: '英檢儀表板聚合指標。', systemOnly: false },
  [P.CAN_VIEW_ENGLISH_TESTS]: { label: '英檢檢視', description: '英檢活動與報名檢視。', systemOnly: false },
  [P.CAN_MANAGE_ENGLISH_TESTS]: { label: '英檢管理', description: '英檢活動維護。', systemOnly: false },
  [P.CAN_REVIEW_ENGLISH_TEST_REGISTRATIONS]: { label: '培力英檢審核', description: '審核培力英檢報名。', systemOnly: false },
  [P.CAN_EXPORT_ENGLISH_TEST_DATA]: { label: '培力英檢匯出', description: '匯出英檢相關資料。', systemOnly: false },
  [P.CAN_VIEW_ENGLISH_TEST_TRACKING]: { label: '英檢追蹤／學習歷程（檢視）', description: '學習歷程與英檢追蹤唯讀。', systemOnly: false },
  [P.CAN_MANAGE_ENGLISH_TEST_TRACKING]: { label: '英檢追蹤／學習歷程（管理）', description: '匯入、刪除批次等治理操作。', systemOnly: false },
  [P.CAN_EXPORT_REPORTS]: { label: '報表下載', description: '一般報表與匯出。', systemOnly: false },
  [P.CAN_VIEW_ANALYTICS]: { label: '分析檢視', description: '營運分析檢視。', systemOnly: false },
  [P.CAN_VIEW_LEARNING_ANALYTICS]: { label: '學習成效分析（檢視）', description: '英語學習成效與增值評估儀表板。', systemOnly: false },
  [P.CAN_EXPORT_LEARNING_ANALYTICS]: { label: '學習成效分析（匯出）', description: '匯出學習成效分析資料。', systemOnly: false },
  [P.CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS]: { label: '學習成效分析設定', description: '管理技能向量與分析設定。', systemOnly: true },
  [P.CAN_RUN_LEARNING_ANALYTICS_MODEL]: { label: '學習成效模型執行', description: '執行學習成效進階估計並寫入模型紀錄。', systemOnly: true },
  [P.CAN_VIEW_BLACKLIST]: { label: '黑名單檢視', description: '黑名單檢視。', systemOnly: false },
  [P.CAN_MANAGE_BLACKLIST]: { label: '黑名單管理', description: '黑名單維護。', systemOnly: false },
  [P.CAN_RECORD_VIOLATIONS]: { label: '登記違規', description: '登記違規紀錄。', systemOnly: false },
  [P.CAN_MANAGE_VIOLATIONS]: { label: '違規管理', description: '違規案件維護。', systemOnly: false },
  [P.CAN_MANAGE_ANNOUNCEMENTS]: { label: '公告管理', description: '後台公告維護。', systemOnly: false },
  [P.CAN_MANAGE_SITE_CONTENT]: { label: '網站文案管理', description: '學生端靜態文案與 FAQ。', systemOnly: false },
  [P.CAN_MANAGE_SETTINGS]: {
    label: '系統設定',
    description: '系統參數與設定檔層級治理。',
    systemOnly: true,
  },
  [P.CAN_MANAGE_FEATURE_FLAGS]: {
    label: 'Feature Flags',
    description: '功能開關與實驗旗標。',
    systemOnly: true,
  },
  [P.CAN_VIEW_AUDIT_LOGS]: {
    label: '操作紀錄／稽核',
    description: '檢視稽核與操作紀錄。',
    systemOnly: true,
  },
  [P.CAN_VIEW_INTERNAL_DIAGNOSTICS]: {
    label: '系統診斷',
    description: '內部診斷與除錯資訊。',
    systemOnly: true,
  },
  [P.CAN_MANAGE_LEARNING_PARTNER_ADMIN]: {
    label: '學習有伴後台管理',
    description: '學習有伴管理端功能。',
    systemOnly: false,
  },
};

export const PERMISSION_GROUPS = [
  {
    id: 'events_reservations',
    title: '活動、預約與現場',
    blurb: '活動後台、預約與簽到等日常營運。',
    keys: [
      P.CAN_VIEW_EVENTS_ADMIN,
      P.CAN_MANAGE_EVENTS,
      P.CAN_VIEW_RESERVATIONS,
      P.CAN_MANAGE_RESERVATIONS,
      P.CAN_EXPORT_RESERVATIONS,
      P.CAN_CHECKIN_STUDENTS,
      P.CAN_VIEW_ET_GROUPING,
      P.CAN_MANAGE_ET_GROUPING,
      P.CAN_MARK_ET_SESSION_TASKS,
      P.CAN_EXPORT_ET_GROUPING,
    ],
  },
  {
    id: 'order_safety',
    title: '秩序與黑名單',
    blurb: '違規與黑名單相關權限。',
    keys: [
      P.CAN_VIEW_BLACKLIST,
      P.CAN_MANAGE_BLACKLIST,
      P.CAN_RECORD_VIOLATIONS,
      P.CAN_MANAGE_VIOLATIONS,
    ],
  },
  {
    id: 'announcements',
    title: '公告與前台內容',
    blurb: '後台公告與對外內容。',
    keys: [P.CAN_MANAGE_ANNOUNCEMENTS, P.CAN_MANAGE_SITE_CONTENT],
  },
  {
    id: 'surveys',
    title: '問卷',
    blurb: '問卷建立、填答、分析與修復。',
    keys: [
      P.CAN_VIEW_SURVEYS,
      P.CAN_MANAGE_SURVEYS,
      P.CAN_EXPORT_SURVEYS,
      P.CAN_MANAGE_SURVEY_SETTINGS,
      P.CAN_MANAGE_SURVEY_RULES,
      P.CAN_PUBLISH_SURVEYS,
      P.CAN_VIEW_SURVEY_RESPONSES,
      P.CAN_EXPORT_SURVEY_RESPONSES,
      P.CAN_VIEW_SURVEY_ANALYTICS,
      P.CAN_VIEW_SURVEY_HEALTH,
      P.CAN_EXECUTE_SURVEY_REPAIRS,
      P.CAN_MANAGE_SURVEY_ANSWER_MAPPING,
      P.CAN_VIEW_SURVEY_REPAIR_AUDIT,
    ],
  },
  {
    id: 'classes_bestep',
    title: '班級與 BESTEP',
    blurb: '班級資料與 BESTEP 匯入匯出。',
    keys: [P.CAN_VIEW_CLASSES, P.CAN_MANAGE_CLASSES, P.CAN_IMPORT_BESTEP, P.CAN_EXPORT_BESTEP],
  },
  {
    id: 'english_lj_reports',
    title: '英檢、學習歷程與報表',
    blurb: '英檢業務、學習歷程、分析與報表下載。',
    keys: [
      P.CAN_VIEW_ENGLISH_TEST_METRICS,
      P.CAN_VIEW_ENGLISH_TESTS,
      P.CAN_MANAGE_ENGLISH_TESTS,
      P.CAN_REVIEW_ENGLISH_TEST_REGISTRATIONS,
      P.CAN_EXPORT_ENGLISH_TEST_DATA,
      P.CAN_VIEW_ENGLISH_TEST_TRACKING,
      P.CAN_MANAGE_ENGLISH_TEST_TRACKING,
      P.CAN_VIEW_LEARNING_ANALYTICS,
      P.CAN_EXPORT_LEARNING_ANALYTICS,
      P.CAN_VIEW_ANALYTICS,
      P.CAN_EXPORT_REPORTS,
    ],
  },
  {
    id: 'accounts',
    title: '帳號與權限',
    blurb: '帳號治理與密碼重設（非 system-only；executive 可於政策內使用）。',
    keys: [P.CAN_MANAGE_ACCOUNTS, P.CAN_RESET_PASSWORDS],
  },
  {
    id: 'system_governance',
    title: '系統治理與稽核',
    blurb: '僅系統管理員可透過帳號覆寫指派此區權限。',
    keys: [
      P.CAN_VIEW_AUDIT_LOGS,
      P.CAN_VIEW_INTERNAL_DIAGNOSTICS,
      P.CAN_MANAGE_SETTINGS,
      P.CAN_MANAGE_FEATURE_FLAGS,
    ],
  },
  {
    id: 'other',
    title: '其他模組',
    blurb: '其餘獨立產品模組。',
    keys: [P.CAN_MANAGE_LEARNING_PARTNER_ADMIN],
  },
];

export function getPermissionGroupBuckets() {
  const assigned = new Set();
  PERMISSION_GROUPS.forEach((g) => {
    g.keys.forEach((k) => assigned.add(k));
  });
  const all = Object.values(P);
  const orphans = all.filter((k) => !assigned.has(k));
  return { groups: PERMISSION_GROUPS, orphans };
}

/** 供初始化 edit 狀態：穩定順序遍歷所有權限鍵 */
export function getFlatPermissionKeyOrder() {
  const { groups, orphans } = getPermissionGroupBuckets();
  const out = [];
  const seen = new Set();
  groups.forEach((g) => {
    g.keys.forEach((k) => {
      if (!seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    });
  });
  orphans.forEach((k) => {
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  });
  return out;
}

export function pickPermissionLabel(key) {
  return PERMISSION_FIELD_META[key]?.label || key;
}

export function pickPermissionDescription(key) {
  return PERMISSION_FIELD_META[key]?.description || '';
}
