'use strict';

const { ContractRegistryError } = require('./errors');

/**
 * 既有欄位只能對到這裡列出的語意。沒有對應就拒絕，不依欄位名稱猜。
 * importedAt 不會被放進 assessmentDate。cutoffAt 沒有對應。
 */
const LEGACY_FIELDS = Object.freeze({
  'events.date': Object.freeze({ key: 'eventTime', semantic: 'event_time', kind: 'calendar_date' }),
  'bestep_exam_scores.semester': Object.freeze({ key: 'fileSemester', semantic: 'file_semester', kind: 'semester_code' }),
  'bestep_exam_scores.importedAt': Object.freeze({ key: 'importTime', semantic: 'import_time', kind: 'timestamp' }),
  'bestep_attendance.examDate': Object.freeze({ key: 'assessmentDate', semantic: 'assessment_date', kind: 'calendar_date' }),
  'et_enrollment_snapshots.semesterId': Object.freeze({ key: 'rosterSemester', semantic: 'cohort_semester', kind: 'semester_code' }),
  'et_exam_attempts.testDate': Object.freeze({ key: 'assessmentDate', semantic: 'assessment_date', kind: 'calendar_date' }),
  'lj_analytic_exams.examDate': Object.freeze({ key: 'assessmentDate', semantic: 'assessment_date', kind: 'calendar_date' }),
  'lj_analytic_students.derivedAt': Object.freeze({ key: 'snapshotGeneratedAt', semantic: 'snapshot_generation_time', kind: 'timestamp' }),
  'lj_analytic_students.snapshotVersion': Object.freeze({ key: 'snapshotVersion', semantic: 'snapshot_version', kind: 'token' }),
});

function adaptLegacyTimeFields(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new ContractRegistryError('MISSING_REQUIRED_BOUNDARY', '沒有可對應的既有時間欄位');
  }
  const named = {};
  const fields = entries.map((entry) => {
    const spec = LEGACY_FIELDS[entry && entry.field];
    if (!spec) {
      throw new ContractRegistryError(
        'TEMPORAL_SEMANTIC_MISMATCH',
        `沒有明確對應、拒絕猜測的欄位：${entry && entry.field}`,
      );
    }
    named[spec.key] = {
      value: entry.value,
      semantic: spec.semantic,
      sourceField: entry.field,
    };
    return {
      sourceField: entry.field,
      semantic: spec.semantic,
      value: entry.value,
    };
  });
  return {
    fields,
    named,
    sqlGeneration: 'forbidden',
  };
}

module.exports = {
  LEGACY_FIELDS,
  adaptLegacyTimeFields,
};
