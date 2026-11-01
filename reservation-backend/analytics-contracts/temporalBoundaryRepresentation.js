'use strict';

const { ContractRegistryError } = require('./errors');

const SAFETY = Object.freeze({
  allowSqlInterpolation: false,
  allowDynamicTableNames: false,
  allowDynamicColumnNames: false,
  allowSequelizeWhereDerivation: false,
  applyToExistingQueries: false,
});

function item(fields) {
  return {
    timezone: 'Asia/Taipei',
    startInclusive: null,
    endExclusive: null,
    ...fields,
  };
}

/**
 * 給以後的 SQL adapter 看的描述。這裡不產生 SQL、不寫欄位名進查詢。
 */
function toSafeQueryBoundaries(context) {
  if (!context || context.validationStatus !== 'valid') {
    throw new ContractRegistryError('MISSING_REQUIRED_BOUNDARY', '只能描述已驗證的時間上下文');
  }
  const boundaries = context.boundaries;
  const items = [];
  if (boundaries.eventSemesterRange) {
    items.push(item({
      fieldSemantic: 'event_time',
      startInclusive: boundaries.eventSemesterRange.startInclusive,
      endExclusive: boundaries.eventSemesterRange.endExclusive,
      precision: boundaries.eventSemesterRange.precision,
      sourceBoundaryType: boundaries.eventSemesterRange.sourceBoundaryType,
      comparisonMode: context.comparisonMode,
      legacyConfiguredEndInclusive: boundaries.eventSemesterRange.legacyEnd || null,
    }));
  }
  if (boundaries.fileSemester) {
    items.push(item({
      fieldSemantic: 'file_semester',
      precision: 'semester',
      sourceBoundaryType: 'cohort_semester_label',
      semesterId: boundaries.fileSemester.semesterId,
      note: 'semester_label_not_expanded_to_assessment_date',
    }));
  }
  if (boundaries.rosterSemester) {
    items.push(item({
      fieldSemantic: 'cohort_semester',
      precision: 'semester',
      sourceBoundaryType: 'cohort_semester_label',
      semesterId: boundaries.rosterSemester.semesterId,
      note: 'roster_label_is_not_a_score_cutoff',
    }));
  }
  if (boundaries.assessmentDate) {
    items.push(item({
      fieldSemantic: 'assessment_date',
      precision: boundaries.assessmentDate.precision,
      sourceBoundaryType: 'stated_assessment_date',
      statedValue: boundaries.assessmentDate.value,
    }));
  }
  if (boundaries.importTime) {
    items.push(item({
      fieldSemantic: 'import_time',
      precision: 'timestamp',
      sourceBoundaryType: 'stated_import_time',
      statedValue: boundaries.importTime.value,
    }));
  }
  if (boundaries.snapshotGeneratedAt) {
    items.push(item({
      fieldSemantic: 'snapshot_generation_time',
      precision: 'timestamp',
      sourceBoundaryType: 'snapshot_generated_at',
      statedValue: boundaries.snapshotGeneratedAt.value,
      note: 'generated_at_is_not_data_as_of',
    }));
  }
  if (boundaries.reportingPeriod) {
    items.push(item({
      fieldSemantic: 'event_time',
      startInclusive: boundaries.reportingPeriod.startInclusive,
      endExclusive: boundaries.reportingPeriod.endExclusive,
      precision: 'timestamp',
      sourceBoundaryType: 'explicit_window_end',
    }));
  }
  if (boundaries.baseline && boundaries.followUp) {
    items.push(item({
      fieldSemantic: 'baseline_follow_up',
      precision: 'date',
      sourceBoundaryType: 'stated_pair',
      baseline: boundaries.baseline.value,
      followUp: boundaries.followUp.value,
    }));
  }
  return Object.freeze({
    metricId: context.metricId,
    temporalContractId: context.temporalContractId,
    timezone: context.timezone,
    items: Object.freeze(items.map((row) => Object.freeze(row))),
    safety: SAFETY,
  });
}

module.exports = {
  toSafeQueryBoundaries,
};
