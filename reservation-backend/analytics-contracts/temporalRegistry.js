'use strict';

const { ContractRegistryError } = require('./errors');

/**
 * Phase 2 的九個時間契約。ID 不改。
 * asOfQuerySupported 是「能不能指定歷史截止日並得到當時的數」，不是欄位名裡有沒有 As-of。
 * TC-ROSTER-BEST-ASOF-NOW 的現況是查詢當下的全部 valid 嘗試，指定截止日為 unsupported。
 * cutoffAt 不是 Data As Of。
 */
const TEMPORAL_CONTRACTS = Object.freeze([
  Object.freeze({
    temporalContractId: 'TC-OPS-DATE-SEMESTER',
    version: 'phase2.v1',
    displayName: '活動日落入行政學期區間（CAST）',
    analysisUnit: '預約列或活動',
    requiredBoundaries: ['eventSemesterRange'],
    optionalBoundaries: [],
    sourceTimeFields: ['events.date'],
    distinguishedTimes: ['event_time', 'academic_semester_date_range'],
    asOfPolicy: '查詢當下重算。營運總覽另有約 5 分鐘記憶體快取。沒有正式發布截止日。',
    asOfQuerySupported: false,
    observationWindowPolicy: 'SEMESTER_RANGES 的 start 與 end，日期經 CAST(TRIM(date) AS DATE)。',
    historicalRecalculationPolicy: '每次查詢重算，不凍結。',
    comparisonEligibility: '兩個區間都用同一 CAST 規則才可並排。不可與名單參與率或達標率並排。',
    limitations: ['not_roster_semester', 'not_exam_date', 'cutoff_at_not_applicable'],
  }),
  Object.freeze({
    temporalContractId: 'TC-OPS-DATE-STRING',
    version: 'phase2.v1',
    displayName: '活動日字串區間（名單參與）',
    analysisUnit: '傳入名單上的學生',
    requiredBoundaries: ['eventSemesterRange'],
    optionalBoundaries: [],
    sourceTimeFields: ['events.date'],
    distinguishedTimes: ['event_time'],
    asOfPolicy: '查詢當下。不支援指定歷史截止日。',
    asOfQuerySupported: false,
    observationWindowPolicy: 'e.date BETWEEN 字串起迄，沒有 CAST。與 TC-OPS-DATE-SEMESTER 不是同一刀。',
    historicalRecalculationPolicy: '每次查詢重算。',
    comparisonEligibility: '與 CAST 契約的人數不必相同。不可互換。',
    limitations: ['string_compare_not_cast'],
  }),
  Object.freeze({
    temporalContractId: 'TC-BESTEP-FILE-SEMESTER',
    version: 'phase2.v1',
    displayName: '培力檔案學期標籤',
    analysisUnit: '學生乘匯入時指定的學期字串',
    requiredBoundaries: ['fileSemester'],
    optionalBoundaries: ['assessmentDate'],
    sourceTimeFields: ['bestep_exam_scores.semester', 'bestep_attendance.examDate', 'bestep_exam_scores.importedAt'],
    distinguishedTimes: ['file_semester', 'assessment_date', 'import_time'],
    asOfPolicy: '讀取當下的成績表。沒有版本凍結。import_time 不得當成測驗日。',
    asOfQuerySupported: false,
    observationWindowPolicy: '檔案學期字串。通過率不用出席日。出席日只是列上的事實。',
    historicalRecalculationPolicy: '後匯入會改當下頁面，不保留舊通過率。',
    comparisonEligibility: '兩個檔案學期可並排，僅當接受加號已摺疊且規則未改。不可與名冊成對對帳。',
    limitations: ['import_time_is_not_assessment_time', 'plus_collapsed'],
  }),
  Object.freeze({
    temporalContractId: 'TC-ROSTER-LIFETIME-DEFAULT',
    version: 'phase2.v1',
    displayName: '名冊學期當分母、嘗試預設終身',
    analysisUnit: '名冊學生',
    requiredBoundaries: ['rosterSemester'],
    optionalBoundaries: ['policyKey', 'dateRange', 'academicYear'],
    sourceTimeFields: ['et_enrollment_snapshots.semesterId', 'et_exam_attempts.testDate'],
    distinguishedTimes: ['cohort_semester', 'assessment_date'],
    asOfPolicy: '內建政策 timeWindow=lifetime，不用名冊學期切考試日。指定截止日尚未實作。',
    asOfQuerySupported: false,
    observationWindowPolicy: '預設無上界。政策若改 date_range 或 academic_year 才濾考試日。學年窗不是 SEMESTER_RANGES。',
    historicalRecalculationPolicy: '新的 valid 嘗試會改變舊名冊的通過人數。',
    comparisonEligibility: '跨學期並排只表示終身累積、分母換了。不是各學期考試成果。政策鍵不同則不可比。',
    limitations: ['lifetime_default', 'not_this_sitting', 'policy_key_required_to_compare'],
  }),
  Object.freeze({
    temporalContractId: 'TC-ROSTER-BEST-ASOF-NOW',
    version: 'phase2.v1',
    displayName: '名冊分母、查詢當下的歷史最佳',
    analysisUnit: '名冊學生乘技能',
    requiredBoundaries: ['rosterSemester'],
    optionalBoundaries: [],
    sourceTimeFields: ['et_exam_attempts.testDate'],
    distinguishedTimes: ['cohort_semester', 'assessment_date', 'query_time'],
    asOfPolicy: '沒有 as-of 參數。名稱裡的 AS-OF 指的是查詢當下，不是可指定的歷史截止日。',
    asOfQuerySupported: false,
    observationWindowPolicy: '所有 status=valid 的 et 嘗試。技能之間可來自不同考次。',
    historicalRecalculationPolicy: '較高 rank 會改寫任何過去名冊的率。',
    comparisonEligibility: '不建議把歷年此率當成趨勢。不是單次測驗成果。',
    limitations: ['asof_query_unsupported', 'rewrites_when_newer_scores_arrive', 'not_single_sitting'],
  }),
  Object.freeze({
    temporalContractId: 'TC-EXAM-SESSION',
    version: 'phase2.v1',
    displayName: '同工具考試梯次',
    analysisUnit: '學生乘工具乘梯次乘技能',
    requiredBoundaries: ['instrument', 'snapshotVersion'],
    optionalBoundaries: [],
    sourceTimeFields: ['lj_analytic_exams.examDate', 'lj_analytic_exams.sessionDateStart', 'lj_analytic_exams.sessionDateEnd'],
    distinguishedTimes: ['exam_session', 'assessment_date', 'baseline_follow_up'],
    asOfPolicy: '數字寫在某個快照版本上。指定「截至某日重算梯次」未實作。',
    asOfQuerySupported: false,
    observationWindowPolicy: 'BESTEP 以考試日所屬學期併梯。其他工具 14 日內併梯。學測不在此契約。',
    historicalRecalculationPolicy: '換快照版本可能改變梯次。不是行政學期差。',
    comparisonEligibility: '只比較同一工具的相鄰梯。不可跨工具相減原始分。',
    limitations: ['same_instrument_only', 'gsat_excluded'],
  }),
  Object.freeze({
    temporalContractId: 'TC-EXPOSURE-BEFORE-EXAM',
    version: 'phase2.v1',
    displayName: '上一梯結束到本次考試的時數窗',
    analysisUnit: '一次考試格',
    requiredBoundaries: ['snapshotVersion'],
    optionalBoundaries: ['instrument'],
    sourceTimeFields: ['lj_analytic_exams.exposureWindowStart', 'lj_analytic_exams.examDate'],
    distinguishedTimes: ['event_time', 'assessment_date', 'baseline_follow_up'],
    asOfPolicy: '附屬於快照版本。不是全學期參與。',
    asOfQuerySupported: false,
    observationWindowPolicy: '上一梯 sessionEnd 到本次考試日。沒有上一梯時起點可為 null，該行為尚未在本登錄重算。',
    historicalRecalculationPolicy: '隨快照重建改變。',
    comparisonEligibility: '可描述考前窗時數。不可與全學期簽到率相減。',
    limitations: ['not_full_semester_participation'],
  }),
  Object.freeze({
    temporalContractId: 'TC-SNAPSHOT-VERSION',
    version: 'phase2.v1',
    displayName: '分析快照版本',
    analysisUnit: '快照列',
    requiredBoundaries: ['snapshotVersion'],
    optionalBoundaries: [],
    sourceTimeFields: ['lj_analytic_students.derivedAt', 'lj_analytic_students.snapshotVersion'],
    distinguishedTimes: ['snapshot_generated_at', 'metric_rule_version'],
    asOfPolicy: '版本字串裡的日期來自 cutoffAt，預設是重建開始的現在。來源查詢沒有用它過濾，因此不是 Data As Of。',
    asOfQuerySupported: false,
    observationWindowPolicy: '該版本寫入時，lj_student_events 裡該批學生的全部事件。',
    historicalRecalculationPolicy: '同一天、同一 build、sequence 固定為 1 會覆蓋同版。換日才是新版本字串。用今天的來源重算不等於舊版。',
    comparisonEligibility: '同一 snapshotVersion 內可做描述比較。不同版本只有規則段相同時才可比較覆蓋。不是正式發布。',
    limitations: ['generated_at_is_not_data_as_of', 'same_day_version_overwrite', 'not_official_publication'],
  }),
  Object.freeze({
    temporalContractId: 'TC-TRACE-ROLLING-30D',
    version: 'phase2.v1',
    displayName: '微學習滾動 30 日',
    analysisUnit: '軌跡事件',
    requiredBoundaries: ['rollingDays'],
    optionalBoundaries: ['gameId'],
    sourceTimeFields: ['learning_trace_events.createdAt'],
    distinguishedTimes: ['event_time'],
    asOfPolicy: '請求當下往回。前端目前寫死 30 日。',
    asOfQuerySupported: false,
    observationWindowPolicy: '滾動窗，不是行政學期，也不進分析快照。',
    historicalRecalculationPolicy: '每次請求重算。',
    comparisonEligibility: '不可與學期活動或快照時數直接比。',
    limitations: ['not_in_analytic_snapshot'],
  }),
]);

const BY_ID = new Map(TEMPORAL_CONTRACTS.map((row) => [row.temporalContractId, row]));

function listTemporalContracts() {
  return TEMPORAL_CONTRACTS.map((row) => ({
    ...row,
    requiredBoundaries: [...row.requiredBoundaries],
    optionalBoundaries: [...row.optionalBoundaries],
    sourceTimeFields: [...row.sourceTimeFields],
    distinguishedTimes: [...row.distinguishedTimes],
    limitations: [...row.limitations],
  }));
}

function getTemporalContract(temporalContractId) {
  const row = BY_ID.get(temporalContractId);
  if (!row) {
    throw new ContractRegistryError(
      'TEMPORAL_CONTRACT_NOT_FOUND',
      `未知的時間契約：${temporalContractId}`,
    );
  }
  return {
    ...row,
    requiredBoundaries: [...row.requiredBoundaries],
    optionalBoundaries: [...row.optionalBoundaries],
    sourceTimeFields: [...row.sourceTimeFields],
    distinguishedTimes: [...row.distinguishedTimes],
    limitations: [...row.limitations],
  };
}

module.exports = {
  TEMPORAL_CONTRACTS,
  listTemporalContracts,
  getTemporalContract,
};
