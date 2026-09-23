/**
 * 現場簽到 Kiosk：學號／姓名／預約簽到碼比對（掃碼槍通常送入 + Enter）
 */

import { parseCheckinScanPayload } from './checkinScanPayload';

export function normalizeStudentId(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function studentNameOf(reservation) {
  return String(reservation?.studentName || reservation?.name || '').trim();
}

function classifySingle(row) {
  if (!row) return { kind: 'none', pending: [], done: [], violations: [] };
  if (row.checkinStatus === '未簽到') {
    return { kind: 'exact_pending', pending: [row], done: [], violations: [] };
  }
  if (row.checkinStatus === '已簽到') {
    return { kind: 'exact_done', pending: [], done: [row], violations: [] };
  }
  if (row.checkinStatus === '已登記違規') {
    return { kind: 'exact_violation', pending: [], done: [], violations: [row] };
  }
  return { kind: 'none', pending: [], done: [], violations: [] };
}

/**
 * @param {Array<object>} reservations
 * @param {string} query
 * @returns {{
 *   kind: 'empty_query' | 'none' | 'exact_pending' | 'exact_done' | 'exact_violation' | 'ambiguous',
 *   pending: object[],
 *   done: object[],
 *   violations: object[],
 * }}
 */
export function matchCheckinQuery(reservations, query) {
  const raw = String(query || '').trim();
  if (!raw) {
    return { kind: 'empty_query', pending: [], done: [], violations: [] };
  }

  const list = Array.isArray(reservations) ? reservations : [];
  const scanned = parseCheckinScanPayload(raw);
  if (scanned.kind === 'booking_code') {
    const row = list.find((r) => Number(r.id) === scanned.reservationId);
    if (!row) return { kind: 'none', pending: [], done: [], violations: [] };
    return classifySingle(row);
  }

  const qNorm = normalizeStudentId(raw);
  const qLower = raw.toLowerCase();

  const exactById = list.filter((r) => normalizeStudentId(r.studentId) === qNorm);
  const pool = exactById.length
    ? exactById
    : list.filter((r) => {
      const sid = String(r.studentId || '').toLowerCase();
      const name = studentNameOf(r).toLowerCase();
      return sid.includes(qLower) || name.includes(qLower);
    });

  const pending = pool.filter((r) => r.checkinStatus === '未簽到');
  const done = pool.filter((r) => r.checkinStatus === '已簽到');
  const violations = pool.filter((r) => r.checkinStatus === '已登記違規');

  if (!pool.length) {
    return { kind: 'none', pending, done, violations };
  }

  if (exactById.length === 1) {
    return classifySingle(exactById[0]);
  }

  if (pending.length === 1 && done.length === 0 && violations.length === 0) {
    return { kind: 'exact_pending', pending, done, violations };
  }

  if (pending.length === 0 && done.length === 1 && violations.length === 0) {
    return { kind: 'exact_done', pending, done, violations };
  }

  if (pending.length === 0 && done.length === 0 && violations.length === 1) {
    return { kind: 'exact_violation', pending, done, violations };
  }

  return { kind: 'ambiguous', pending, done, violations };
}
