'use strict';

const MARKING_GRACE_DAYS = 3;

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
  taskAppliesToBand,
  filterTasksForBand,
  parseEventEndDate,
  isMarkingWindowOpen,
  serializeTaskItem,
};
