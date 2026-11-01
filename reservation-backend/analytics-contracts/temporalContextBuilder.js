'use strict';

const { ContractRegistryError } = require('./errors');
const { getMetricDefinition } = require('./metricRegistry');
const { getTemporalContract } = require('./temporalRegistry');
const { halfOpenFromConfiguredSemester } = require('./semesterBoundaryAdapter');
const {
  BUSINESS_TIMEZONE,
  parseCalendarDate,
  parseTimestamp,
  addCalendarDays,
  calendarDateToStartInstant,
  assertHalfOpen,
  compareInstants,
} = require('./temporalTime');

/**
 * 九個既有契約各自接受的邊界名稱。
 * TC-TRACE-ROLLING-30D 另外要求明確的 windowEnd：Phase 4A 寫的是「請求當下往回」，
 * 本模組不把那個當下補成現在。
 */
const CATALOG = Object.freeze({
  'TC-OPS-DATE-SEMESTER': Object.freeze({
    contextType: 'event_period',
    allowed: Object.freeze(['eventSemesterRange']),
    required: Object.freeze(['eventSemesterRange']),
    comparisonMode: 'cast_date',
  }),
  'TC-OPS-DATE-STRING': Object.freeze({
    contextType: 'event_period',
    allowed: Object.freeze(['eventSemesterRange']),
    required: Object.freeze(['eventSemesterRange']),
    comparisonMode: 'string_between',
  }),
  'TC-BESTEP-FILE-SEMESTER': Object.freeze({
    contextType: 'cohort_semester',
    allowed: Object.freeze(['fileSemester', 'assessmentDate', 'importTime']),
    required: Object.freeze(['fileSemester']),
  }),
  'TC-ROSTER-LIFETIME-DEFAULT': Object.freeze({
    contextType: 'cohort_semester',
    allowed: Object.freeze(['rosterSemester', 'policyKey', 'dateRange', 'academicYear']),
    required: Object.freeze(['rosterSemester']),
  }),
  'TC-ROSTER-BEST-ASOF-NOW': Object.freeze({
    contextType: 'cohort_semester',
    allowed: Object.freeze(['rosterSemester']),
    required: Object.freeze(['rosterSemester']),
  }),
  'TC-EXAM-SESSION': Object.freeze({
    contextType: 'exam_session',
    allowed: Object.freeze(['instrument', 'snapshotVersion', 'baseline', 'followUp']),
    required: Object.freeze(['instrument', 'snapshotVersion']),
  }),
  'TC-EXPOSURE-BEFORE-EXAM': Object.freeze({
    contextType: 'baseline_follow_up',
    allowed: Object.freeze(['snapshotVersion', 'instrument', 'baseline', 'followUp']),
    required: Object.freeze(['snapshotVersion']),
  }),
  'TC-SNAPSHOT-VERSION': Object.freeze({
    contextType: 'snapshot_generation',
    allowed: Object.freeze(['snapshotVersion', 'snapshotGeneratedAt']),
    required: Object.freeze(['snapshotVersion']),
  }),
  'TC-TRACE-ROLLING-30D': Object.freeze({
    contextType: 'reporting_period',
    allowed: Object.freeze(['rollingDays', 'windowEnd', 'gameId']),
    required: Object.freeze(['rollingDays', 'windowEnd']),
  }),
});

const FORBIDDEN = Object.freeze({
  semesterId: 'semesterId 不是通用時間參數，請用該契約的具名邊界',
  cutoffAt: 'cutoffAt 不是 Data As Of',
  dataAsOf: '沒有資料截止日，不能宣稱 As-of',
  asOfDate: 'AS_OF',
  generatedAt: 'generatedAt 不能代替具名的快照產生時間',
  importedAt: 'importedAt 不能直接當測驗日，請用 importTime',
  eventDate: 'eventDate 不能代替 eventSemesterRange',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return Object.freeze(value);
}

function fail(code, message) {
  throw new ContractRegistryError(code, message);
}

function requireObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('MISSING_REQUIRED_BOUNDARY', message);
  return value;
}

function semesterLabel(value, label) {
  const record = requireObject(value, `${label} 必須是 { semesterId }`);
  if (typeof record.semesterId !== 'string') {
    fail('MISSING_REQUIRED_BOUNDARY', `${label} 需要 semesterId`);
  }
  return {
    semesterId: record.semesterId,
    precision: 'semester',
    expandedToAssessmentDate: false,
  };
}

function explicitHalfOpen(value) {
  const record = requireObject(value, '半開區間必須是物件');
  if (record.boundKind !== 'half_open') {
    fail('AMBIGUOUS_TIME_PRECISION', '自訂期間必須宣告 boundKind=half_open，不把含尾日默認為半開');
  }
  assertHalfOpen(record.startInclusive, record.endExclusive);
  return {
    boundKind: 'half_open',
    startInclusive: parseTimestamp(record.startInclusive).text,
    endExclusive: parseTimestamp(record.endExclusive).text,
    timezone: BUSINESS_TIMEZONE,
    precision: 'timestamp',
    sourceBoundaryType: 'explicit_half_open',
  };
}

function normalizeEventRange(value) {
  const record = requireObject(value, 'eventSemesterRange 必須是物件');
  if (record.semesterId) {
    return {
      ...halfOpenFromConfiguredSemester(record.semesterId),
      semantic: 'event_time',
    };
  }
  return {
    ...explicitHalfOpen(record),
    semantic: 'event_time',
  };
}

function normalizeInstantOrDate(value, semantic) {
  if (typeof value === 'string') {
    if (value.includes('T')) {
      return {
        semantic,
        precision: 'timestamp',
        value: parseTimestamp(value).text,
      };
    }
    const date = parseCalendarDate(value);
    return {
      semantic,
      precision: 'date',
      value: date.text,
      startInclusive: calendarDateToStartInstant(date.text),
    };
  }
  const record = requireObject(value, `${semantic} 必須是日期或時間`);
  if (record.role === 'data_as_of') {
    fail('TEMPORAL_SEMANTIC_MISMATCH', '快照產生時間不能宣稱成資料截止日');
  }
  if (record.sourceField === 'bestep_exam_scores.importedAt' && semantic === 'assessment_date') {
    fail('TEMPORAL_SEMANTIC_MISMATCH', '匯入時間不能放進測驗日');
  }
  return normalizeInstantOrDate(record.value, semantic);
}

function normalizeToken(value, semantic) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('MISSING_REQUIRED_BOUNDARY', `${semantic} 不能是空字串`);
  }
  return { semantic, precision: 'token', value: value.trim() };
}

function normalizePair(boundaries) {
  const hasBaseline = Object.prototype.hasOwnProperty.call(boundaries, 'baseline');
  const hasFollowUp = Object.prototype.hasOwnProperty.call(boundaries, 'followUp');
  if (hasBaseline !== hasFollowUp) {
    fail('MISSING_REQUIRED_BOUNDARY', 'baseline 與 followUp 必須同時提供');
  }
  if (!hasBaseline) return null;
  const baseline = normalizeInstantOrDate(boundaries.baseline, 'baseline');
  const followUp = normalizeInstantOrDate(boundaries.followUp, 'follow_up');
  const left = baseline.startInclusive || baseline.value;
  const right = followUp.startInclusive || followUp.value;
  if (compareInstants(left, right) >= 0) {
    fail('INVALID_TIME_RANGE', 'baseline 必須早於 follow-up');
  }
  return { baseline, followUp };
}

function normalizeBoundaries(contractId, input) {
  const spec = CATALOG[contractId];
  const boundaries = input || {};
  if (!boundaries || typeof boundaries !== 'object' || Array.isArray(boundaries)) {
    fail('MISSING_REQUIRED_BOUNDARY', 'boundaries 必須是物件');
  }
  Object.keys(boundaries).forEach((key) => {
    if (FORBIDDEN[key]) {
      if (key === 'asOfDate') fail('AS_OF_NOT_SUPPORTED', '這個契約不支援指定歷史截止日');
      fail('TEMPORAL_SEMANTIC_MISMATCH', FORBIDDEN[key]);
    }
    if (!spec.allowed.includes(key)) {
      fail('TEMPORAL_SEMANTIC_MISMATCH', `契約 ${contractId} 不接受時間參數 ${key}`);
    }
  });
  spec.required.forEach((key) => {
    if (boundaries[key] == null || boundaries[key] === '') {
      fail('MISSING_REQUIRED_BOUNDARY', `缺少必要邊界 ${key}`);
    }
  });

  const normalized = {};
  if (boundaries.eventSemesterRange) {
    normalized.eventSemesterRange = normalizeEventRange(boundaries.eventSemesterRange);
  }
  if (boundaries.fileSemester) {
    normalized.fileSemester = {
      ...semesterLabel(boundaries.fileSemester, 'fileSemester'),
      semantic: 'file_semester',
    };
  }
  if (boundaries.rosterSemester) {
    normalized.rosterSemester = {
      ...semesterLabel(boundaries.rosterSemester, 'rosterSemester'),
      semantic: 'cohort_semester',
    };
  }
  if (boundaries.assessmentDate != null) {
    normalized.assessmentDate = normalizeInstantOrDate(boundaries.assessmentDate, 'assessment_date');
  }
  if (boundaries.importTime != null) {
    normalized.importTime = normalizeInstantOrDate(boundaries.importTime, 'import_time');
    if (normalized.importTime.semantic === 'assessment_date') {
      fail('TEMPORAL_SEMANTIC_MISMATCH', '匯入時間不能當成測驗日');
    }
  }
  if (boundaries.policyKey != null) {
    if (typeof boundaries.policyKey !== 'string' || boundaries.policyKey.trim() === '') {
      fail('MISSING_REQUIRED_BOUNDARY', 'policyKey 必須是非空字串');
    }
    normalized.policyKey = { semantic: 'policy_key', precision: 'token', value: boundaries.policyKey.trim() };
  }
  if (boundaries.academicYear != null) {
    if (typeof boundaries.academicYear !== 'string' || !/^\d{3}$/.test(boundaries.academicYear)) {
      fail('AMBIGUOUS_TIME_PRECISION', 'academicYear 只接受三碼學年標籤，不接受日期或學期');
    }
    normalized.academicYear = { semantic: 'academic_year', precision: 'year_label', value: boundaries.academicYear };
  }
  if (boundaries.dateRange != null) {
    normalized.dateRange = { ...explicitHalfOpen(boundaries.dateRange), semantic: 'assessment_date' };
  }
  if (boundaries.instrument != null) {
    const instrument = normalizeToken(boundaries.instrument, 'instrument');
    if (instrument.value.toUpperCase() === 'GSAT' || instrument.value === '學測') {
      fail('TEMPORAL_SEMANTIC_MISMATCH', '學測不在 TC-EXAM-SESSION');
    }
    normalized.instrument = instrument;
  }
  if (boundaries.snapshotVersion != null) {
    normalized.snapshotVersion = normalizeToken(boundaries.snapshotVersion, 'snapshot_version');
  }
  if (boundaries.snapshotGeneratedAt != null) {
    normalized.snapshotGeneratedAt = normalizeInstantOrDate(boundaries.snapshotGeneratedAt, 'snapshot_generation_time');
  }
  if (boundaries.rollingDays != null) {
    if (boundaries.rollingDays !== 30) {
      fail('TEMPORAL_SEMANTIC_MISMATCH', 'TC-TRACE-ROLLING-30D 只接受 rollingDays=30');
    }
    normalized.rollingDays = { semantic: 'rolling_days', precision: 'token', value: 30 };
  }
  if (boundaries.windowEnd != null) {
    const end = parseTimestamp(boundaries.windowEnd);
    const endDate = end.text.slice(0, 10);
    const startDate = addCalendarDays(endDate, -30);
    const startInstant = `${startDate}T${end.text.slice(11, 19)}+08:00`;
    assertHalfOpen(startInstant, end.text);
    normalized.reportingPeriod = {
      semantic: 'event_time',
      precision: 'timestamp',
      sourceBoundaryType: 'explicit_window_end',
      rollingDays: 30,
      startInclusive: startInstant,
      endExclusive: end.text,
      timezone: BUSINESS_TIMEZONE,
      anchoredToRequestTime: false,
    };
  }
  if (boundaries.gameId != null) {
    normalized.gameId = normalizeToken(boundaries.gameId, 'game_id');
  }
  const pair = normalizePair(boundaries);
  if (pair) {
    normalized.baseline = pair.baseline;
    normalized.followUp = pair.followUp;
  }
  return normalized;
}

function precisionFor(normalized) {
  let assessment = 'not_applicable';
  if (normalized.assessmentDate) assessment = normalized.assessmentDate.precision;
  else if (normalized.fileSemester || normalized.rosterSemester) assessment = 'semester';
  else if (normalized.instrument && !normalized.baseline) assessment = 'unknown';
  return {
    assessment,
    assessmentDateInvented: false,
  };
}

function buildTemporalContext(input) {
  const source = input || {};
  const metric = getMetricDefinition(source.metricId);
  const contract = getTemporalContract(source.temporalContractId);
  if (!metric.temporalContractIds.includes(contract.temporalContractId)) {
    fail('UNSUPPORTED_TEMPORAL_CONTRACT', `${metric.metricId} 不使用 ${contract.temporalContractId}`);
  }
  if (!CATALOG[contract.temporalContractId]) {
    fail('UNSUPPORTED_TEMPORAL_CONTRACT', contract.temporalContractId);
  }
  if (source.timezone && source.timezone !== BUSINESS_TIMEZONE) {
    fail('TEMPORAL_SEMANTIC_MISMATCH', `分析時區只接受 ${BUSINESS_TIMEZONE}`);
  }
  const copied = structuredClone(source.boundaries || {});
  const boundaries = normalizeBoundaries(contract.temporalContractId, copied);
  const spec = CATALOG[contract.temporalContractId];
  const context = {
    temporalContractId: contract.temporalContractId,
    metricId: metric.metricId,
    contextType: spec.contextType,
    comparisonMode: spec.comparisonMode || null,
    timezone: BUSINESS_TIMEZONE,
    source: typeof source.source === 'string' && source.source ? source.source : 'unspecified',
    boundaries,
    precision: precisionFor(boundaries),
    validationStatus: 'valid',
    claims: {
      asOf: false,
      dataAsOf: false,
      assessmentDateInvented: false,
      officialUseAllowed: false,
    },
  };
  const checked = validateTemporalContext(context);
  if (!checked.ok) {
    fail(checked.errors[0].code, checked.errors.map((item) => item.message).join('; '));
  }
  return deepFreeze(context);
}

function validateTemporalContext(context) {
  const errors = [];
  const push = (code, message) => errors.push({ code, message });
  if (!context || context.validationStatus !== 'valid') {
    push('MISSING_REQUIRED_BOUNDARY', '時間上下文尚未完成驗證');
  }
  if (context && context.timezone !== BUSINESS_TIMEZONE) {
    push('TEMPORAL_SEMANTIC_MISMATCH', '時區必須是 Asia/Taipei');
  }
  if (context && context.claims && (context.claims.asOf || context.claims.dataAsOf)) {
    push('AS_OF_NOT_SUPPORTED', '目前沒有任何契約可以宣稱資料截止日');
  }
  if (context && context.precision && context.precision.assessmentDateInvented) {
    push('AMBIGUOUS_TIME_PRECISION', '推估或學期首日不能當成測驗日');
  }
  const boundaries = (context && context.boundaries) || {};
  if (boundaries.eventSemesterRange) {
    try {
      assertHalfOpen(boundaries.eventSemesterRange.startInclusive, boundaries.eventSemesterRange.endExclusive);
    } catch (err) {
      push(err.code || 'INVALID_TIME_RANGE', err.message);
    }
  }
  if (boundaries.reportingPeriod) {
    try {
      assertHalfOpen(boundaries.reportingPeriod.startInclusive, boundaries.reportingPeriod.endExclusive);
    } catch (err) {
      push(err.code || 'INVALID_TIME_RANGE', err.message);
    }
  }
  if (boundaries.importTime && boundaries.importTime.semantic !== 'import_time') {
    push('TEMPORAL_SEMANTIC_MISMATCH', '匯入時間語意被改成別的時間');
  }
  if (boundaries.snapshotGeneratedAt && boundaries.snapshotGeneratedAt.semantic !== 'snapshot_generation_time') {
    push('TEMPORAL_SEMANTIC_MISMATCH', '快照產生時間不能代替資料截止日');
  }
  if (boundaries.assessmentDate && boundaries.fileSemester) {
    if (boundaries.assessmentDate.value === boundaries.fileSemester.semesterId) {
      push('AMBIGUOUS_TIME_PRECISION', '學期代碼不能當作測驗日');
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  CATALOG,
  buildTemporalContext,
  validateTemporalContext,
};
