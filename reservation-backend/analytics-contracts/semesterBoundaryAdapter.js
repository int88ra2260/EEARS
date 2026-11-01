'use strict';

const { SEMESTER_RANGES } = require('../../shared/semesterConfig');
const { ContractRegistryError } = require('./errors');
const {
  BUSINESS_TIMEZONE,
  calendarDateToStartInstant,
  inclusiveEndToExclusiveInstant,
} = require('./temporalTime');

/**
 * 既有設定的 end 是含尾日。這裡只轉成半開區間，不改 shared/semesterConfig.js。
 * 不呼叫 getCurrentSemester，也不用月曆規則補不在表上的學期。
 */
function halfOpenFromConfiguredSemester(semesterId) {
  if (typeof semesterId !== 'string' || !/^\d{3}-[12]$/.test(semesterId)) {
    throw new ContractRegistryError('TEMPORAL_SEMANTIC_MISMATCH', '學期代碼格式必須是 114-2 這種標籤，不是日期');
  }
  const range = SEMESTER_RANGES[semesterId];
  if (!range) {
    throw new ContractRegistryError(
      'TEMPORAL_SEMANTIC_MISMATCH',
      `學期 ${semesterId} 不在 shared/semesterConfig.js，不以月曆推算補上`,
    );
  }
  return Object.freeze({
    semesterId,
    boundKind: 'half_open',
    legacyInclusivity: 'configured_end_date_inclusive',
    legacyStart: range.start,
    legacyEnd: range.end,
    startInclusive: calendarDateToStartInstant(range.start),
    endExclusive: inclusiveEndToExclusiveInstant(range.end),
    timezone: BUSINESS_TIMEZONE,
    precision: 'date',
    sourceBoundaryType: 'academic_semester',
    source: 'shared/semesterConfig.js',
  });
}

module.exports = {
  halfOpenFromConfiguredSemester,
};
