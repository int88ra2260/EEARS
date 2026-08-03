'use strict';

const { SEMESTER_RANGES } = require('../../../utils/semesterConstants');

/**
 * 建立 events / reservations 查詢用的學期篩選 SQL。
 * 同時支援 semesters.code、et_semesters 日期區間與 semesterConstants 靜態區間，
 * 避免 events.semesterId 未填或 semesters 表缺列時查不到活動紀錄。
 */
function buildSemesterEventFilter(semesterId) {
  const sem = String(semesterId || '').trim();
  if (!sem) {
    return { join: '', where: '', replacements: {} };
  }

  const replacements = { semesterId: sem };
  const range = SEMESTER_RANGES[sem];
  if (range) {
    replacements.semesterStart = range.start;
    replacements.semesterEnd = range.end;
  }

  const join = `
    LEFT JOIN semesters event_semester ON e.semesterId = event_semester.id
    LEFT JOIN semesters requested_semester ON requested_semester.code = :semesterId
    LEFT JOIN et_semesters et_requested ON et_requested.id = :semesterId
  `;

  const dateClauses = [
    `(requested_semester.id IS NOT NULL
      AND e.date >= DATE_FORMAT(requested_semester.startDate, '%Y-%m-%d')
      AND e.date <= DATE_FORMAT(requested_semester.endDate, '%Y-%m-%d'))`,
    `(et_requested.id IS NOT NULL
      AND et_requested.startDate IS NOT NULL
      AND et_requested.endDate IS NOT NULL
      AND e.date >= et_requested.startDate
      AND e.date <= et_requested.endDate)`
  ];
  if (range) {
    dateClauses.push('(e.date >= :semesterStart AND e.date <= :semesterEnd)');
  }

  const where = `
    AND (
      event_semester.code = :semesterId
      OR e.semesterId = requested_semester.id
      OR ${dateClauses.join(' OR ')}
    )
  `;

  return { join, where, replacements };
}

function getSemesterDateRange(semesterId) {
  const sem = String(semesterId || '').trim();
  if (!sem) return null;
  return SEMESTER_RANGES[sem] || null;
}

function isEventDateInSemester(eventDate, semesterId) {
  const range = getSemesterDateRange(semesterId);
  const date = String(eventDate || '').trim().slice(0, 10);
  if (!range || !date) return false;
  return date >= range.start && date <= range.end;
}

module.exports = {
  buildSemesterEventFilter,
  getSemesterDateRange,
  isEventDateInSemester
};
