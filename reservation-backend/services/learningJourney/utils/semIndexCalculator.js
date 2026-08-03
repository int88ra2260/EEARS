'use strict';

const { compareSemester } = require('../../../utils/semesterConstants');
const { TIMING } = require('../../../constants/learningJourneyEventConstants');

function parseSemesterId(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{2,4})-(\d{1,2})$/);
  if (!match) return null;
  return { raw, year: Number(match[1]), term: Number(match[2]) };
}

function deriveEnrollmentTerm(enrollmentYear) {
  const y = Number(enrollmentYear);
  if (!Number.isFinite(y) || y <= 0) return null;
  return `${y}-1`;
}

/**
 * sem_index = 事件學期序 - 入學學期序（每學年 2 學期）
 * @param {string|null} enrollmentTerm e.g. 113-1
 * @param {string|null} eventTerm e.g. 114-2
 * @param {{ timing?: string }} [opts]
 * @returns {number|null}
 */
function computeSemIndex(enrollmentTerm, eventTerm, opts = {}) {
  const enroll = parseSemesterId(enrollmentTerm);
  const event = parseSemesterId(eventTerm);
  if (!enroll || !event) return null;
  const index = (event.year - enroll.year) * 2 + (event.term - enroll.term);
  if (index < 0 && opts.timing !== TIMING.ENTRY) return null;
  return index;
}

function termLabelFromSemIndex(enrollmentTerm, semIndex) {
  const enroll = parseSemesterId(enrollmentTerm);
  if (!enroll || semIndex == null) return null;
  const totalTerms = enroll.term - 1 + semIndex;
  const year = enroll.year + Math.floor(totalTerms / 2);
  const term = (totalTerms % 2) + 1;
  return `${year}-${term}`;
}

function compareSemesterIds(a, b) {
  return compareSemester(a, b);
}

module.exports = {
  parseSemesterId,
  deriveEnrollmentTerm,
  computeSemIndex,
  termLabelFromSemIndex,
  compareSemesterIds,
};
