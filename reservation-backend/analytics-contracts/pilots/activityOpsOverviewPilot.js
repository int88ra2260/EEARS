'use strict';

const { SEMESTER_RANGES } = require('../../../shared/semesterConfig');
const { ContractRegistryError } = require('../errors');
const { getMetricDefinition } = require('../metricRegistry');
const { buildTemporalContext } = require('../temporalContextBuilder');
const { halfOpenFromConfiguredSemester } = require('../semesterBoundaryAdapter');

const PILOT_ID = 'PILOT-OPS-OVERVIEW-RESERVATION';
const EVENT_TIME_FIELD = 'events.date';

/**
 * GET /api/analytics/overview?kind=reservation 的欄位說明。
 * 不讀資料庫，不重算數字，也不把未登錄欄位配到相近的 Metric ID。
 */
const FIELD_SPECS = Object.freeze([
  Object.freeze({
    responseField: 'semester',
    mappingStatus: 'unmapped',
    metricId: null,
    temporalContractId: null,
    reason: '查詢參數回顯，不是統計指標。',
  }),
  Object.freeze({
    responseField: 'totalReservations',
    mappingStatus: 'mapped',
    metricId: 'ops.reservation.row_count',
    temporalContractId: 'TC-OPS-DATE-SEMESTER',
    analysisUnit: 'reservation_row',
    timeField: EVENT_TIME_FIELD,
    populationDefinition: '活動日經 CAST 後落在學期含尾日區間的預約列。SQL 是 reservations INNER JOIN events，沒有再依簽到狀態刪列。',
  }),
  Object.freeze({
    responseField: 'totalEventCapacity',
    mappingStatus: 'unmapped',
    metricId: null,
    temporalContractId: null,
    reason: '登錄沒有單獨的名額指標。這個數字只是 bookingRate 的分母。',
  }),
  Object.freeze({
    responseField: 'bookingRate',
    mappingStatus: 'mapped',
    metricId: 'ops.capacity.reservation_over_seats',
    temporalContractId: 'TC-OPS-DATE-SEMESTER',
    analysisUnit: 'reservation_row_over_event_capacity',
    timeField: EVENT_TIME_FIELD,
    populationDefinition: '分子是預約列數，分母是區間內活動 maxCapacity 加總。百分比沿用既有服務，這裡不重算。',
  }),
  Object.freeze({
    responseField: 'attendanceRate',
    mappingStatus: 'mapped',
    metricId: 'ops.reservation.checkin_row_rate',
    temporalContractId: 'TC-OPS-DATE-SEMESTER',
    analysisUnit: 'reservation_row',
    timeField: EVENT_TIME_FIELD,
    populationDefinition: 'checkinStatus 為已簽到的預約列，除以全部預約列。分母含未簽到與已登記違規。不是不重複學生。',
  }),
  Object.freeze({
    responseField: 'violationRate',
    mappingStatus: 'unmapped',
    metricId: null,
    temporalContractId: null,
    reason: '登錄沒有違規率。不能改掛出席率或參與率。',
  }),
  Object.freeze({
    responseField: 'englishPassRate',
    mappingStatus: 'mapped',
    metricId: 'ops.registration.legacy_has_cefr_b2',
    temporalContractId: 'TC-BESTEP-FILE-SEMESTER',
    analysisUnit: 'registration_row',
    timeField: 'english_test_registrations.semester',
    populationDefinition: '該學期 english_test_registrations 列裡 hasCEFRB2 為肯定值的比例。時間是檔案學期標籤，不是活動日。',
  }),
  Object.freeze({
    responseField: 'capacityBreakdown',
    mappingStatus: 'unmapped',
    metricId: null,
    temporalContractId: null,
    reason: '巢狀物件同時有場次、類型與列數。整包不能對到一個 Metric ID。',
  }),
]);

const BY_FIELD = new Map(FIELD_SPECS.map((row) => [row.responseField, row]));

function fail(code, message) {
  throw new ContractRegistryError(code, message);
}

function temporalContextFor(spec, semesterId) {
  if (spec.temporalContractId === 'TC-OPS-DATE-SEMESTER') {
    return buildTemporalContext({
      metricId: spec.metricId,
      temporalContractId: spec.temporalContractId,
      source: PILOT_ID,
      boundaries: { eventSemesterRange: { semesterId } },
    });
  }
  if (spec.temporalContractId === 'TC-BESTEP-FILE-SEMESTER') {
    return buildTemporalContext({
      metricId: spec.metricId,
      temporalContractId: spec.temporalContractId,
      source: PILOT_ID,
      boundaries: { fileSemester: { semesterId } },
    });
  }
  return null;
}

function fieldDescriptor(spec, semesterId, legacyResult) {
  const metric = spec.metricId ? getMetricDefinition(spec.metricId) : null;
  return {
    responseField: spec.responseField,
    mappingStatus: spec.mappingStatus,
    metricId: spec.metricId,
    temporalContractId: spec.temporalContractId,
    analysisUnit: spec.analysisUnit || null,
    timeField: spec.timeField || null,
    populationDefinition: spec.populationDefinition || null,
    reason: spec.reason || null,
    officialUseAllowed: metric ? metric.officialUseAllowed : false,
    causalClaimAllowed: false,
    governanceStatus: metric ? metric.governanceStatus : null,
    temporalContext: spec.mappingStatus === 'mapped' ? temporalContextFor(spec, semesterId) : null,
    legacyValuePresent: legacyResult
      ? Object.prototype.hasOwnProperty.call(legacyResult, spec.responseField)
      : null,
  };
}

function listActivityOpsFieldMappings() {
  return FIELD_SPECS.map((row) => ({ ...row }));
}

function resolveResponseField(responseField) {
  const spec = BY_FIELD.get(responseField);
  if (!spec) {
    return {
      responseField,
      mappingStatus: 'unmapped',
      metricId: null,
      temporalContractId: null,
      reason: '回應欄位不在這支 API 的已知清單，不會依名稱猜指標。',
    };
  }
  return { ...spec };
}

function assertEventTimeField(timeField) {
  if (timeField !== EVENT_TIME_FIELD) {
    fail(
      'TEMPORAL_SEMANTIC_MISMATCH',
      `${timeField} 不能代替 ${EVENT_TIME_FIELD}。預約建立時間與活動日是不同欄位。`,
    );
  }
  return { timeField, interchangeableWithCreatedAt: false };
}

function describeMetricBinding(metricId, temporalContractId, semesterId) {
  const metric = getMetricDefinition(metricId);
  if (!metric.temporalContractIds.includes(temporalContractId)) {
    fail('UNSUPPORTED_TEMPORAL_CONTRACT', `${metricId} 不使用 ${temporalContractId}`);
  }
  const spec = FIELD_SPECS.find((row) => row.metricId === metricId && row.temporalContractId === temporalContractId);
  if (!spec) {
    fail('UNSUPPORTED_TEMPORAL_CONTRACT', `${metricId} 不是這支活動營運試點的欄位`);
  }
  return temporalContextFor(spec, semesterId);
}

function describeActivityOpsOverview(input) {
  const source = input || {};
  const semesterId = typeof source.semesterId === 'string' ? source.semesterId.trim() : '';
  if (!semesterId) {
    fail('MISSING_REQUIRED_BOUNDARY', '活動營運試點需要 semesterId');
  }
  const legacyRange = SEMESTER_RANGES[semesterId];
  if (!legacyRange) {
    fail('TEMPORAL_SEMANTIC_MISMATCH', `學期 ${semesterId} 不在 shared/semesterConfig.js，不以月曆補上`);
  }
  const halfOpen = halfOpenFromConfiguredSemester(semesterId);
  const legacyResult = source.legacyResult && typeof source.legacyResult === 'object'
    ? source.legacyResult
    : null;
  const requestedScope = source.populationScope || 'full_center';

  return {
    pilotId: PILOT_ID,
    businessQuestion: '指定行政學期內，以活動日篩選的預約營運數字各在數什麼。',
    legacyApi: 'GET /api/analytics/overview?semester={semester}&kind=reservation',
    legacyService: 'analyticsService.getReservationOverview',
    legacyController: 'analyticsController.getOverview',
    mountedAt: 'server.js 以 app.use("/api", analyticsRouter) 掛載',
    access: 'requireFullCenterAnalytics：admin 或 hasAdminRights。不是班級或學生名單。',
    semesterId,
    populationScope: 'full_center',
    populationNote: requestedScope === 'full_center'
      ? '這支路由沒有班級或學生名單篩選。'
      : `呼叫端傳入的母體 ${requestedScope} 沒有被拿來縮小這支 API。母體仍是全中心活動日區間。`,
    timeComparison: {
      legacyPredicate: 'CAST(TRIM(events.date) AS DATE) BETWEEN CAST(:start AS DATE) AND CAST(:end AS DATE)',
      legacyStartInclusive: legacyRange.start,
      legacyEndInclusive: legacyRange.end,
      contractStartInclusive: halfOpen.startInclusive,
      contractEndExclusive: halfOpen.endExclusive,
      timezone: halfOpen.timezone,
      createdAtUsed: false,
      mysqlEquivalenceVerified: false,
      compatibilityStatus: 'legacy_inclusive_cast_vs_half_open_unverified',
    },
    fields: FIELD_SPECS.map((spec) => fieldDescriptor(spec, semesterId, legacyResult)),
    verificationStatus: 'synthetic_contract_only',
    countsRecomputed: false,
    sqlExecuted: false,
  };
}

module.exports = {
  PILOT_ID,
  describeActivityOpsOverview,
  listActivityOpsFieldMappings,
  resolveResponseField,
  assertEventTimeField,
  describeMetricBinding,
};
