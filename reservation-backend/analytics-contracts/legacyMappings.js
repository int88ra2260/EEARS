'use strict';

const { ContractRegistryError } = require('./errors');

/**
 * 既有入口到 Metric ID。mappingStatus 只有在 Phase 2 已對到函式時才是 verified。
 * 未逐式核對的 SQL 保持 partial 或 unmapped。不把多個出席率收成一筆。
 */
const LEGACY_MAPPINGS = Object.freeze([
  Object.freeze({
    legacyId: 'LM-OP-01',
    legacyApi: 'GET /api analytics reservation overview',
    legacyFunction: 'analyticsService.getReservationOverview',
    legacyDisplayName: '行政分析預約總覽',
    metricIds: [
      'ops.event.count',
      'ops.reservation.row_count',
      'ops.reservation.checkin_row_count',
      'ops.reservation.checkin_row_rate',
      'ops.capacity.reservation_over_seats',
      'ops.registration.legacy_has_cefr_b2',
    ],
    temporalContractIds: ['TC-OPS-DATE-SEMESTER', 'TC-BESTEP-FILE-SEMESTER'],
    mappingStatus: 'partial',
    notes: [
      '預約列與名額公式已讀到。活動場次計數在容量分解，未逐欄對完前端。',
      'hasCEFRB2 是 legacy，與培力四項達標不是同一指標。',
    ],
  }),
  Object.freeze({
    legacyId: 'LM-OP-KPI',
    legacyApi: 'analyticsService class overview via kpiService',
    legacyFunction: 'kpiService.getParticipationMetrics / getBestepAttendanceMetrics / getBestepPassMetrics',
    legacyDisplayName: '班級行政 KPI',
    metricIds: [
      'ops.roster.distinct_checkin_students',
      'ops.roster.distinct_checkin_rate',
      'ops.roster.avg_checkin_count',
      'bestep.file.attendance_lr_sw_avg',
      'ops.roster.bestep_pass_over_attendance',
    ],
    temporalContractIds: ['TC-OPS-DATE-STRING', 'TC-BESTEP-FILE-SEMESTER'],
    mappingStatus: 'verified',
    notes: [
      '參與率是名單人數，不是預約列。培力出席只認 LR／SW。通過率分母是出席人數較大者。',
    ],
  }),
  Object.freeze({
    legacyId: 'LM-BT-01',
    legacyApi: 'class BESTEP overview',
    legacyFunction: 'bestepClassService.buildClassBestepOverviewStatistics',
    legacyDisplayName: '班級培力四項等級',
    metricIds: [
      'bestep.file.skill_score',
      'bestep.file.skill_level',
      'bestep.file.skill_reached_b2',
      'bestep.file.four_skill_cefr_b2',
    ],
    temporalContractIds: ['TC-BESTEP-FILE-SEMESTER'],
    mappingStatus: 'verified',
    notes: ['讀 bestep_exam_scores.passed。不讀 et_exam_attempts。單科沒有獨立率欄。'],
  }),
  Object.freeze({
    legacyId: 'LM-BT-02',
    legacyApi: 'GET /english-test/registrations/stats/analytics',
    legacyFunction: 'english test registration stats',
    legacyDisplayName: '培力報名描述',
    metricIds: [],
    temporalContractIds: ['TC-BESTEP-FILE-SEMESTER'],
    mappingStatus: 'partial',
    notes: ['Phase 2 未重讀聚合 SQL。沒有發新的 Metric ID。不是分數達標。'],
  }),
  Object.freeze({
    legacyId: 'LM-BT-04',
    legacyApi: 'GET /admin/learning-partner/outcome',
    legacyFunction: 'learningPartnerOutcomeService',
    legacyDisplayName: '學習有伴成績差',
    metricIds: ['partner.score_gap'],
    temporalContractIds: ['TC-BESTEP-FILE-SEMESTER'],
    mappingStatus: 'verified',
    notes: ['定義物件已讀。載入 SQL 仍是部分驗證，但差距公式與 caveat 已對到。'],
  }),
  Object.freeze({
    legacyId: 'LM-LA-02',
    legacyApi: 'POST /api/admin/learning-analytics/kpi/report',
    legacyFunction: 'kpiReportService.runKpiReport',
    legacyDisplayName: '名冊成對 KPI',
    metricIds: ['roster.pair_pass.listening_reading', 'roster.pair_pass.speaking_writing'],
    temporalContractIds: ['TC-ROSTER-LIFETIME-DEFAULT'],
    mappingStatus: 'verified',
    notes: [
      '同一 Metric ID 下，both_cefr 與 sum_raw 靠 policyKey 區分，不是兩個 ID。',
      '內建預設鍵是同日雙科 CEFR，不是 200／560。這是 legacy 行為，不是核准政策。',
      'roster.pair_pass.both_pairs 沒有對應欄位。',
    ],
  }),
  Object.freeze({
    legacyId: 'LM-LJ-01',
    legacyApi: 'GET learning-journey semester b2-report',
    legacyFunction: 'b2ReportService.getSemesterB2Report',
    legacyDisplayName: '學期歷史最佳技能',
    metricIds: ['roster.best_skill_rank_b2', 'roster.best_skill_state'],
    temporalContractIds: ['TC-ROSTER-BEST-ASOF-NOW'],
    mappingStatus: 'verified',
    notes: ['不是成對達標，也不是培力檔四項。指定截止日未實作。'],
  }),
  Object.freeze({
    legacyId: 'LM-LA-03',
    legacyApi: 'GET/POST /api/admin/learning-analytics/b1-plus',
    legacyFunction: 'b1PlusWatch',
    legacyDisplayName: '接近 B2',
    metricIds: ['snapshot.near_b2_gse'],
    temporalContractIds: ['TC-SNAPSHOT-VERSION'],
    mappingStatus: 'verified',
    notes: ['路由名仍是 b1-plus。條件是 GSE 51–58。'],
  }),
  Object.freeze({
    legacyId: 'LM-LA-08',
    legacyApi: 'GET /api/admin/learning-analytics/skills',
    legacyFunction: 'lvaAdjustedGrowthService',
    legacyDisplayName: '技能成長',
    metricIds: ['snapshot.gse_raw_delta', 'snapshot.gse_adjusted_delta'],
    temporalContractIds: ['TC-EXAM-SESSION', 'TC-SNAPSHOT-VERSION'],
    mappingStatus: 'partial',
    notes: ['梯次窗已讀。頁面是否每格標示 GSE 鈍化尚未逐欄核對。'],
  }),
  Object.freeze({
    legacyId: 'LM-LA-10',
    legacyApi: 'learning analytics resources and LVA estimate policy',
    legacyFunction: 'lvaAnalyticsService.estimatePolicy',
    legacyDisplayName: '資源覆蓋與效果估計',
    metricIds: ['snapshot.resource_effect'],
    temporalContractIds: ['TC-SNAPSHOT-VERSION'],
    mappingStatus: 'verified',
    notes: ['causalClaimAllowed 在 API 組裝為 false。資源頁文案寫不做排名。'],
  }),
  Object.freeze({
    legacyId: 'LM-LA-SNAPSHOT',
    legacyApi: 'learning analytics overview and raw snapshot reads',
    legacyFunction: 'analyticRebuildService.buildAnalyticExamRows',
    legacyDisplayName: '分析快照考試格與品質帶',
    metricIds: ['snapshot.exam_cell_rank_b2', 'snapshot.skill_exposure', 'snapshot.evidence_quality'],
    temporalContractIds: ['TC-SNAPSHOT-VERSION', 'TC-EXPOSURE-BEFORE-EXAM'],
    mappingStatus: 'partial',
    notes: ['格子旗標已讀。學生層 b2plusRate 的分子定義仍是部分驗證，沒有另發 ID。'],
  }),
  Object.freeze({
    legacyId: 'LM-LA-13',
    legacyApi: 'POST /api/admin/learning-analytics/model-runs（頁面已改導）',
    legacyFunction: 'lva model run',
    legacyDisplayName: '模型執行與成長段',
    metricIds: ['snapshot.growth_episode'],
    temporalContractIds: ['TC-SNAPSHOT-VERSION'],
    mappingStatus: 'partial',
    notes: ['計數欄位存在。完整模型執行契約未在本階段重讀。'],
  }),
  Object.freeze({
    legacyId: 'LM-TRACE-30',
    legacyApi: 'learning trace micro-learning engagement',
    legacyFunction: 'MicroLearningEngagementPanel days=30',
    legacyDisplayName: '微學習近 30 日',
    metricIds: ['trace.micro_learning.30d'],
    temporalContractIds: ['TC-TRACE-ROLLING-30D'],
    mappingStatus: 'partial',
    notes: ['前端參數已讀。聚合 SQL 未逐式核對。'],
  }),
  Object.freeze({
    legacyId: 'LM-ET-GSE',
    legacyApi: 'ET grouping gse snapshot recompute script',
    legacyFunction: 'learning-journey-recompute-gse-episodes.js',
    legacyDisplayName: '分組 GSE 快照',
    metricIds: ['etgroup.gse_snapshot'],
    temporalContractIds: ['TC-SNAPSHOT-VERSION'],
    mappingStatus: 'partial',
    notes: ['腳本用途已讀。分組頁公式未逐式核對。'],
  }),
  Object.freeze({
    legacyId: 'LM-SURVEY',
    legacyApi: '/admin/survey-analytics',
    legacyFunction: 'survey analytics',
    legacyDisplayName: '問卷分析',
    metricIds: [],
    temporalContractIds: [],
    mappingStatus: 'unmapped',
    notes: ['不在 32 個 ID 裡。未刪頁。公式未驗證。'],
  }),
  Object.freeze({
    legacyId: 'LM-WEEKLY',
    legacyApi: 'GET /admin/weekly-reports/:id/analytics',
    legacyFunction: 'weekly report analytics',
    legacyDisplayName: '週報互動',
    metricIds: [],
    temporalContractIds: [],
    mappingStatus: 'unmapped',
    notes: ['不進分析快照。沒有 Metric ID。'],
  }),
  Object.freeze({
    legacyId: 'LM-SPEAKING',
    legacyApi: 'speaking diagnostic admin',
    legacyFunction: 'unknown',
    legacyDisplayName: '口說診斷',
    metricIds: [],
    temporalContractIds: [],
    mappingStatus: 'unmapped',
    notes: ['Phase 2 未找到進入 lj_student_events 的路徑。不標成無價值。'],
  }),
]);

const BY_ID = new Map(LEGACY_MAPPINGS.map((row) => [row.legacyId, row]));

function cloneMapping(row) {
  return {
    ...row,
    metricIds: [...row.metricIds],
    temporalContractIds: [...row.temporalContractIds],
    notes: [...row.notes],
  };
}

function listLegacyMappings(filters = {}) {
  return LEGACY_MAPPINGS.filter((row) => {
    if (filters.mappingStatus && row.mappingStatus !== filters.mappingStatus) return false;
    if (filters.metricId && !row.metricIds.includes(filters.metricId)) return false;
    return true;
  }).map(cloneMapping);
}

function getLegacyMapping(legacyId) {
  const row = BY_ID.get(legacyId);
  if (!row) {
    throw new ContractRegistryError('LEGACY_MAPPING_NOT_FOUND', `未知的 legacy 映射：${legacyId}`);
  }
  return cloneMapping(row);
}

function findLegacyMappingsByMetric(metricId) {
  return listLegacyMappings({ metricId });
}

module.exports = {
  LEGACY_MAPPINGS,
  listLegacyMappings,
  getLegacyMapping,
  findLegacyMappingsByMetric,
};
