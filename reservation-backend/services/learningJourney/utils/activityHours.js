'use strict';

const ACTIVITY_HOURS = Object.freeze({
  ET: 0.5,
  EC: 1,
  IF: 1,
  JT: 1,
  'English Table': 0.5,
  'English Club': 1,
  'International Forum': 1,
  'Job Talk': 1,
});

function hoursForActivityType(activityType) {
  const t = String(activityType || '').trim();
  if (!t) return 0;
  if (ACTIVITY_HOURS[t] != null) return ACTIVITY_HOURS[t];
  const upper = t.toUpperCase();
  if (ACTIVITY_HOURS[upper] != null) return ACTIVITY_HOURS[upper];
  return 0;
}

/**
 * 解析 HH:MM / HH:MM:SS 為當日分鐘數；無效則 null。
 */
function parseTimeToMinutes(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = m[3] != null ? Number(m[3]) : 0;
  if (![hh, mm, ss].every((n) => Number.isFinite(n))) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
  return hh * 60 + mm + ss / 60;
}

function roundHours(hours) {
  return Math.round(Number(hours) * 100) / 100;
}

/**
 * 依 StartTime / EndTime 計算時數（小時）。
 * 若結束時間小於開始時間，視為跨日（+24h）。
 * 無法解析或時長 ≤ 0 時回傳 null（呼叫端可 fallback）。
 */
function hoursFromStartEndTime(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return null;
  let diffMinutes = end - start;
  if (diffMinutes < 0) diffMinutes += 24 * 60;
  if (diffMinutes <= 0) return null;
  return roundHours(diffMinutes / 60);
}

/**
 * 活動參與時數：
 * 1) meta.startTime / meta.endTime（EWL 等）
 * 2) meta.hours（若已預先寫入）
 * 3) activityType 固定對照表
 */
function hoursForActivityParticipation(activityType, meta = {}) {
  const m = meta && typeof meta === 'object' ? meta : {};
  const fromRange = hoursFromStartEndTime(
    m.startTime || m.StartTime,
    m.endTime || m.EndTime
  );
  if (fromRange != null && fromRange > 0) return fromRange;

  const preset = Number(m.hours);
  if (Number.isFinite(preset) && preset > 0) return roundHours(preset);

  return hoursForActivityType(activityType);
}

function hoursForCourse(credits) {
  const c = Number(credits);
  const effective = Number.isFinite(c) && c > 0 ? c : 3;
  return effective * 18;
}

module.exports = {
  hoursForActivityType,
  hoursForActivityParticipation,
  hoursFromStartEndTime,
  parseTimeToMinutes,
  hoursForCourse,
  ACTIVITY_HOURS,
};
