'use strict';

/**
 * 合成情境只描述契約應如何拒絕或區分，不計算分數、不讀資料庫。
 * 人物與學號都是虛構代號。
 */
const GOLDEN_CASES = Object.freeze([
  Object.freeze({
    caseId: 'G01',
    title: '同一學生同一學期多次測驗',
    fixture: { person: 'SYN-A', rosterSemester: '114-2', attemptDates: ['2026-03-01', '2026-05-01'] },
    expect: {
      metricId: 'roster.pair_pass.listening_reading',
      temporalContractId: 'TC-ROSTER-LIFETIME-DEFAULT',
      note: '多次嘗試不是自動改成只留最近一次。正式比較還要政策鍵。',
    },
  }),
  Object.freeze({
    caseId: 'G02',
    title: '名冊學期與測驗日期不同',
    fixture: { person: 'SYN-B', rosterSemester: '114-2', testDate: '2025-10-01' },
    expect: {
      metricId: 'roster.pair_pass.listening_reading',
      limitation: 'lifetime_default',
      asOf: 'unsupported',
    },
  }),
  Object.freeze({
    caseId: 'G03',
    title: '聽讀與說寫不同日',
    fixture: { person: 'SYN-C', listeningDate: '2026-04-01', speakingDate: '2026-04-20' },
    expect: {
      metricIds: ['roster.pair_pass.listening_reading', 'roster.pair_pass.speaking_writing'],
      bothPairs: 'not_implemented',
    },
  }),
  Object.freeze({
    caseId: 'G04',
    title: '不同工具相同 CEFR 基底',
    fixture: { person: 'SYN-D', instruments: ['BESTEP', 'TOEIC'], cefr: 'B2' },
    expect: {
      comparison: 'undetermined',
      restriction: 'same_instrument_only',
    },
  }),
  Object.freeze({
    caseId: 'G05',
    title: 'B2 與 B2+ 正規化',
    fixture: { person: 'SYN-E', rawLevels: ['B2', 'B2+'] },
    expect: {
      metricId: 'bestep.file.skill_level',
      restriction: 'plus_collapsed',
    },
  }),
  Object.freeze({
    caseId: 'G06',
    title: '缺等級與未達標共用培力布林語意',
    fixture: { person: 'SYN-F', levels: ['B2', 'B2', 'B2', null] },
    expect: {
      metricId: 'bestep.file.four_skill_cefr_b2',
      restriction: 'missing_level_counts_as_fail',
    },
  }),
  Object.freeze({
    caseId: 'G07',
    title: '歷史最佳會被後來的較高成績改寫，且不能指定截止日',
    fixture: { person: 'SYN-G', asOf: '2026-01-31' },
    expect: {
      metricId: 'roster.best_skill_rank_b2',
      asOf: 'unsupported',
      restriction: 'not_single_sitting',
    },
  }),
  Object.freeze({
    caseId: 'G08',
    title: '活動日與匯入日不是同一個時間',
    fixture: { eventDate: '2026-04-02', importedAt: '2026-06-01' },
    expect: {
      eventContract: 'TC-OPS-DATE-SEMESTER',
      fileLimitation: 'import_time_is_not_assessment_time',
    },
  }),
  Object.freeze({
    caseId: 'G09',
    title: '同一活動多次預約與簽到',
    fixture: { person: 'SYN-H', reservationRows: 3, distinctStudents: 1 },
    expect: {
      rowMetric: 'ops.reservation.checkin_row_rate',
      personMetric: 'ops.roster.distinct_checkin_rate',
      comparison: 'incompatible',
    },
  }),
  Object.freeze({
    caseId: 'G10',
    title: '培力成績與 et 嘗試可能是不同來源',
    fixture: {
      person: 'SYN-I',
      sources: ['bestep_exam_scores', 'et_exam_attempts'],
    },
    expect: {
      fileMetric: 'bestep.file.four_skill_cefr_b2',
      etMetric: 'roster.pair_pass.listening_reading',
      fileSource: 'bestep_exam_scores',
      etSource: 'et_exam_attempts',
    },
  }),
  Object.freeze({
    caseId: 'G11',
    title: '快照產生時間不是資料截止',
    fixture: { snapshotVersion: 'global-20260401-v1', cutoffAtLabel: 'generated' },
    expect: {
      temporalContractId: 'TC-SNAPSHOT-VERSION',
      limitation: 'generated_at_is_not_data_as_of',
    },
  }),
  Object.freeze({
    caseId: 'G12',
    title: '未核准政策不能成為正式成果',
    fixture: { policyKey: 'pair-bothcefr-samedate-g24', legacyActive: true },
    expect: {
      metricId: 'roster.pair_pass.listening_reading',
      official: false,
    },
  }),
  Object.freeze({
    caseId: 'G13',
    title: '已發布與監測不是同一種結果',
    fixture: {
      monitoring: { usage: 'monitoring', value: 10 },
      frozen: { usage: 'official', value: 8 },
    },
    expect: {
      officialAllowed: false,
      valuesAreNotEquated: true,
    },
  }),
  Object.freeze({
    caseId: 'G14',
    title: '關聯分析不得宣稱因果',
    fixture: { metricId: 'partner.score_gap' },
    expect: {
      evidenceClassification: 'associational',
      causalClaimAllowed: false,
    },
  }),
  Object.freeze({
    caseId: 'G15',
    title: '未實作指標不得回報正式可用',
    fixture: { metricIds: ['ops.participation.streak', 'roster.pair_pass.both_pairs'] },
    expect: {
      implementationStatus: 'not_implemented',
      official: false,
    },
  }),
]);

function listGoldenCases() {
  return GOLDEN_CASES.map((row) => ({
    ...row,
    fixture: { ...row.fixture },
    expect: { ...row.expect },
  }));
}

module.exports = {
  GOLDEN_CASES,
  listGoldenCases,
};
