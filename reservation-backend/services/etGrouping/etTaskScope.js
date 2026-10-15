'use strict';

const MARKING_GRACE_DAYS = 3;
const MARKING_EXTENSION_DEFAULT_DAYS = 2;
const MARKING_EXTENSION_MAX_DAYS = 7;

const B1_PLUS_BANDS = new Set(['ET-B1', 'ET-B2', 'ET-C1']);
const B2_PLUS_BANDS = new Set(['ET-B2', 'ET-C1']);

function normalizeBandCode(bandCode) {
  return String(bandCode || '').trim().toUpperCase();
}

function taskAppliesToBand(taskItem, bandCode) {
  const scope = String(taskItem.bandScope || taskItem.band_scope || 'ALL').toUpperCase();
  const band = normalizeBandCode(bandCode);
  if (!taskItem.isActive && taskItem.isActive !== undefined) return false;
  if (scope === 'ALL') return true;
  if (scope === 'ET-A2') return band === 'ET-A2' || band.startsWith('ET-A2');
  if (scope === 'B1_PLUS') return B1_PLUS_BANDS.has(band) || [...B1_PLUS_BANDS].some((code) => band.startsWith(code));
  if (scope === 'B2_PLUS') return B2_PLUS_BANDS.has(band) || [...B2_PLUS_BANDS].some((code) => band.startsWith(code));
  return band === scope || band.startsWith(scope);
}

function filterTasksForBand(taskItems = [], bandCode) {
  return taskItems
    .filter((item) => item.isActive !== false)
    .filter((item) => taskAppliesToBand(item, bandCode))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function parseEventEndDate(event) {
  if (!event?.date) return null;
  const endTime = event.endTime || '23:59';
  const iso = `${event.date}T${endTime}:00+08:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isMarkingWindowOpen(event, { now = new Date(), graceDays = MARKING_GRACE_DAYS } = {}) {
  const endAt = parseEventEndDate(event);
  if (!endAt) return true;
  const deadline = new Date(endAt.getTime() + graceDays * 24 * 60 * 60 * 1000);
  return now <= deadline;
}

function parseTimestamp(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function markingDeadlineMs(event, attendance, { graceDays = MARKING_GRACE_DAYS } = {}) {
  const endAt = parseEventEndDate(event);
  const graceMs = endAt ? endAt.getTime() + graceDays * 24 * 60 * 60 * 1000 : null;
  const extension = parseTimestamp(attendance?.markingOpenUntil);
  if (graceMs == null && !extension) return null;
  return Math.max(graceMs || 0, extension ? extension.getTime() : 0);
}

function isLeaderMarkingOpen(event, attendance, { now = new Date(), graceDays = MARKING_GRACE_DAYS } = {}) {
  const deadline = markingDeadlineMs(event, attendance, { graceDays });
  if (deadline == null) return true;
  return now.getTime() <= deadline;
}

function markingDaysLeft(event, attendance, { now = new Date(), graceDays = MARKING_GRACE_DAYS } = {}) {
  const graceOpen = isMarkingWindowOpen(event, { now, graceDays });
  const deadline = markingDeadlineMs(event, graceOpen ? null : attendance, { graceDays });
  if (deadline == null) return null;
  const remaining = deadline - now.getTime();
  if (remaining < 0) return 0;
  return Math.ceil(remaining / (24 * 60 * 60 * 1000));
}

function resolveMarkingExtensionUntil(until, {
  now = new Date(),
  maxDays = MARKING_EXTENSION_MAX_DAYS,
  defaultDays = MARKING_EXTENSION_DEFAULT_DAYS,
} = {}) {
  const fallback = new Date(now.getTime() + defaultDays * 24 * 60 * 60 * 1000);
  const parsed = until ? parseTimestamp(until) : fallback;
  if (!parsed) {
    throw Object.assign(new Error('補勾期限格式不正確'), { status: 400 });
  }
  if (parsed.getTime() <= now.getTime()) {
    throw Object.assign(new Error('補勾期限必須晚於現在'), { status: 400 });
  }
  const max = now.getTime() + maxDays * 24 * 60 * 60 * 1000;
  if (parsed.getTime() > max + 60 * 1000) {
    throw Object.assign(new Error(`補勾期限最多 ${maxDays} 天`), { status: 400 });
  }
  return parsed;
}

function serializeTaskItem(item) {
  return {
    id: item.id,
    templateId: item.templateId,
    code: item.code,
    label: item.label,
    description: item.description,
    bandScope: item.bandScope,
    sortOrder: item.sortOrder,
    isRequired: item.isRequired,
    isActive: item.isActive,
  };
}

module.exports = {
  MARKING_GRACE_DAYS,
  MARKING_EXTENSION_DEFAULT_DAYS,
  MARKING_EXTENSION_MAX_DAYS,
  taskAppliesToBand,
  filterTasksForBand,
  parseEventEndDate,
  isMarkingWindowOpen,
  isLeaderMarkingOpen,
  markingDaysLeft,
  resolveMarkingExtensionUntil,
  serializeTaskItem,
};
