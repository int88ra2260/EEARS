/**
 * EEARS 功能權限鍵（第一階段：由 role + teacherLevel 映射，無 DB 欄位）
 * 未來可在 Teacher 增加 permissions JSON 後與此合併。
 */

const P = {
  // 帳號
  CAN_MANAGE_ACCOUNTS: 'can_manage_accounts',
  CAN_RESET_PASSWORDS: 'can_reset_passwords',

  // 活動與預約
  CAN_VIEW_EVENTS_ADMIN: 'can_view_events_admin',
  CAN_MANAGE_EVENTS: 'can_manage_events',
  CAN_VIEW_RESERVATIONS: 'can_view_reservations',
  CAN_MANAGE_RESERVATIONS: 'can_manage_reservations',
  CAN_EXPORT_RESERVATIONS: 'can_export_reservations',
  CAN_CHECKIN_STUDENTS: 'can_checkin_students',

  // 問卷
  CAN_VIEW_SURVEYS: 'can_view_surveys',
  CAN_MANAGE_SURVEYS: 'can_manage_surveys',
  CAN_EXPORT_SURVEYS: 'can_export_surveys',
  CAN_MANAGE_SURVEY_SETTINGS: 'can_manage_survey_settings',
  CAN_MANAGE_SURVEY_RULES: 'can_manage_survey_rules',
  CAN_PUBLISH_SURVEYS: 'can_publish_surveys',
  CAN_VIEW_SURVEY_RESPONSES: 'can_view_survey_responses',
  CAN_EXPORT_SURVEY_RESPONSES: 'can_export_survey_responses',
  CAN_VIEW_SURVEY_ANALYTICS: 'can_view_survey_analytics',
  CAN_VIEW_SURVEY_HEALTH: 'can_view_survey_health',
  CAN_EXECUTE_SURVEY_REPAIRS: 'can_execute_survey_repairs',
  CAN_MANAGE_SURVEY_ANSWER_MAPPING: 'can_manage_survey_answer_mapping',
  CAN_VIEW_SURVEY_REPAIR_AUDIT: 'can_view_survey_repair_audit',

  // 班級 / BESTEP
  CAN_VIEW_CLASSES: 'can_view_classes',
  CAN_MANAGE_CLASSES: 'can_manage_classes',
  CAN_IMPORT_BESTEP: 'can_import_bestep',
  CAN_EXPORT_BESTEP: 'can_export_bestep',

  // 英檢 / 培力英檢
  CAN_VIEW_ENGLISH_TEST_METRICS: 'can_view_english_test_metrics', // 儀表板待審筆數等聚合
  CAN_VIEW_ENGLISH_TESTS: 'can_view_english_tests',
  CAN_MANAGE_ENGLISH_TESTS: 'can_manage_english_tests',
  CAN_REVIEW_ENGLISH_TEST_REGISTRATIONS: 'can_review_english_test_registrations',
  CAN_EXPORT_ENGLISH_TEST_DATA: 'can_export_english_test_data',

  // 黑名單 / 違規
  CAN_VIEW_BLACKLIST: 'can_view_blacklist',
  CAN_MANAGE_BLACKLIST: 'can_manage_blacklist',
  CAN_RECORD_VIOLATIONS: 'can_record_violations',
  CAN_MANAGE_VIOLATIONS: 'can_manage_violations',

  // 分析 / 報表
  CAN_VIEW_ANALYTICS: 'can_view_analytics',
  CAN_EXPORT_REPORTS: 'can_export_reports',

  // 英語學習成效分析（EEARS-LVA）
  CAN_VIEW_LEARNING_ANALYTICS: 'can_view_learning_analytics',
  CAN_EXPORT_LEARNING_ANALYTICS: 'can_export_learning_analytics',
  CAN_MANAGE_LEARNING_ANALYTICS_SETTINGS: 'can_manage_learning_analytics_settings',
  CAN_RUN_LEARNING_ANALYTICS_MODEL: 'can_run_learning_analytics_model',

  // 系統
  CAN_MANAGE_SETTINGS: 'can_manage_settings',
  CAN_MANAGE_FEATURE_FLAGS: 'can_manage_feature_flags',

  // 公告（後台）
  CAN_MANAGE_ANNOUNCEMENTS: 'can_manage_announcements',

  // 學生端內容（文案、資源頁、修課說明等）
  CAN_MANAGE_SITE_CONTENT: 'can_manage_site_content',

  // 稽核 / 系統日誌
  CAN_VIEW_AUDIT_LOGS: 'can_view_audit_logs',

  // 英語學習歷程中心模組（讀取／管理分離；無 DB migration，僅程式鍵）
  CAN_VIEW_ENGLISH_TEST_TRACKING: 'can_view_english_test_tracking',
  CAN_MANAGE_ENGLISH_TEST_TRACKING: 'can_manage_english_test_tracking',

  // 診斷
  CAN_VIEW_INTERNAL_DIAGNOSTICS: 'can_view_internal_diagnostics',

  // 學習有伴（後台管理端）
  CAN_MANAGE_LEARNING_PARTNER_ADMIN: 'can_manage_learning_partner_admin',

  // 英語實踐歷程護照（English Learning Passport）
  CAN_VIEW_ENGLISH_LEARNING_PASSPORTS: 'can_view_english_learning_passports',
  CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS: 'can_manage_english_learning_passports',
  CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS: 'can_review_english_learning_submissions',
  CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS: 'can_export_english_learning_passports',
  CAN_MANAGE_ENGLISH_LEARNING_RULES: 'can_manage_english_learning_rules',

  // ET 能力分組與成效追蹤
  CAN_MANAGE_ET_GROUPING: 'can_manage_et_grouping',
  CAN_VIEW_ET_GROUPING: 'can_view_et_grouping',
  CAN_MARK_ET_SESSION_TASKS: 'can_mark_et_session_tasks',
  CAN_EXPORT_ET_GROUPING: 'can_export_et_grouping',
};

/** 所有權限鍵陣列（測試／文件用） */
const ALL_PERMISSION_KEYS = Object.freeze(Object.values(P));

module.exports = {
  P,
  ALL_PERMISSION_KEYS,
};
