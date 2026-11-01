'use strict';

/**
 * 三個成績表的身分說明。這份登錄不讀資料庫，也不決定 D11 誰優先。
 * 無法從程式確認的項目標 UNKNOWN。
 */
const ASSESSMENT_SOURCES = Object.freeze({
  bestep_exam_scores: Object.freeze({
    sourceSystem: 'bestep_file',
    sourceTable: 'bestep_exam_scores',
    originClass: 'external_import',
    primaryKey: 'id',
    studentField: 'studentId',
    instrument: 'BESTEP',
    semesterField: 'semester',
    assessmentDateField: 'examDate',
    assessmentDateNullable: true,
    importBatchField: 'importBatchId',
    uniqueKey: Object.freeze(['studentId', 'semester']),
    skillColumns: Object.freeze(['listening', 'reading', 'speaking', 'writing']),
    knownLimits: Object.freeze([
      '唯一鍵是學號加檔案學期，不是考試日。同一學期再匯入會撞同一列。',
      '匯入時 normalizeCefrLevel 會去掉加號。資料庫裡的等級通常已不是原始字串。',
      '一列含四科，不是四筆來源主鍵。',
    ]),
  }),
  exam_attempts: Object.freeze({
    sourceSystem: 'exam_attempt',
    sourceTable: 'exam_attempts',
    originClass: 'mixed',
    primaryKey: 'id',
    studentField: 'studentId',
    studentPkField: 'studentPk',
    instrumentField: 'examVendor',
    sourceTypeField: 'sourceType',
    assessmentDateField: 'examDate',
    assessmentDateNullable: false,
    skillTable: 'exam_attempt_skill_scores',
    uniqueKey: Object.freeze(['dedupeKey']),
    projectionLink: 'rawPayload.bestepExamScoreId 或 sourceRef=bestep_exam_scores:{id}',
    knownLimits: Object.freeze([
      'syncBestepScoresToExamAttempts 會寫 sourceType=BESTEP、sourceRef 與 rawPayload.sync。',
      '考試日若原列沒有，同步程式會改看出席、匯入時間，最後才寫 1970-01-01。那不是這份 adapter 會重做的事。',
      'dedupeKey 只表示同步冪等，不是跨來源合併政策。',
      '技能分數在子表，一筆 attempt 對多個 skill。',
    ]),
  }),
  et_exam_attempts: Object.freeze({
    sourceSystem: 'et_exam_attempt',
    sourceTable: 'et_exam_attempts',
    originClass: 'mixed',
    primaryKey: 'id',
    studentField: 'studentId',
    instrumentFields: Object.freeze(['examType', 'testType']),
    assessmentDateFields: Object.freeze(['testDate', 'examDate']),
    importBatchField: 'importBatchId',
    skillTable: 'et_exam_attempt_skill_scores',
    uniqueKey: Object.freeze(['studentId', 'testType', 'testDate']),
    projectionLink: '程式裡沒有指向 bestep_exam_scores 的 sourceRef。rawPayload 是否偶而含來源鍵：UNKNOWN。',
    knownLimits: Object.freeze([
      'bestSkillService.getStudentBestSkillsWithSource 讀日期用 testDate || examDate。這不是對外正式測驗日期。',
      'examAttemptImportService 寫 testDate 與 et_exam_attempt_scores。examAttemptService.create 寫 examDate 與 et_exam_attempt_skill_scores。',
      'buildCanonicalAttemptWhere 用 COALESCE(examDate, testDate)，和歷史最佳的讀取順序相反。',
      '唯一鍵 studentId+testType+testDate。testDate 為 NULL 時能否存兩列：UNKNOWN，本模組不連線確認。',
      '沒有程式把 bestepExamScoreId 寫進這張表。adapter 只在 rawPayload 已有該鍵時才建立投影。',
      'KPI 與歷史最佳讀這張表，不讀 exam_attempts。這是現況，不是已核准的優先權。',
    ]),
  }),
});

function listAssessmentSources() {
  return Object.values(ASSESSMENT_SOURCES).map((row) => ({
    ...row,
    uniqueKey: [...row.uniqueKey],
    knownLimits: [...row.knownLimits],
  }));
}

module.exports = {
  ASSESSMENT_SOURCES,
  listAssessmentSources,
};
