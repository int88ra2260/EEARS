'use strict';

/**
 * 班級課堂加分：活動時數／計點換算（單一來源）
 * 與 learningJourney/utils/activityHours 對齊；班級明細與配置庫存共用。
 */
const {
  hoursForActivityType,
  ACTIVITY_HOURS,
} = require('../services/learningJourney/utils/activityHours');

/** 每半小時 1 點 → 時數 × 2。115-1 起 ET 為 45 分鐘，1 場 = 0.75 時 = 1.5 點。 */
const POINTS_PER_HOUR = 2;
/** 此日（含）之後的 English Table 以 45 分鐘計。對應學期 115-1 起。之後可改由後台設定。 */
const ENGLISH_TABLE_45_MIN_FROM = '2026-08-01';
const ENGLISH_TABLE_45_MIN_HOURS = 0.75;

function roundHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function hoursToPoints(hours) {
  const points = roundHours(hours) * POINTS_PER_HOUR;
  return Math.round(points * 10) / 10;
}

/** 允許負時數（後台加扣），四捨五入到 2 位小數（45 分鐘 = 0.75）。 */
function roundSignedHours(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(Math.abs(n) * 100) / 100;
  return n < 0 ? -rounded : rounded;
}

function signedHoursToPoints(hours) {
  const points = roundSignedHours(hours) * POINTS_PER_HOUR;
  return Math.round(points * 10) / 10;
}

/**
 * 學生配置 + 後台調整。display 給老師看的本班已歸屬，負值顯示為 0。
 */
function combineClassCredit(allocatedHours, adjustmentHours) {
  const allocated = roundHours(allocatedHours);
  const adjustment = roundSignedHours(adjustmentHours);
  const effective = roundSignedHours(allocated + adjustment);
  const displayHours = roundHours(Math.max(0, effective));
  return {
    allocatedHours: allocated,
    adjustmentHours: adjustment,
    effectiveHours: effective,
    displayHours,
    displayPoints: hoursToPoints(displayHours),
    adjustmentPoints: signedHoursToPoints(adjustment),
  };
}

function isEnglishTableType(eventType) {
  const t = String(eventType || '').trim();
  if (!t) return false;
  if (t === 'ET' || t === 'English Table') return true;
  return t.toLowerCase() === 'english_table';
}

/**
 * @param {string} eventType
 * @param {{ use45MinEnglishTable?: boolean, eventDate?: string }} [options]
 */
function hoursForEventType(eventType, options = {}) {
  const eventDate = options.eventDate ? String(options.eventDate).slice(0, 10) : '';
  const use45 = options.use45MinEnglishTable === true
    || (eventDate && eventDate >= ENGLISH_TABLE_45_MIN_FROM);
  if (isEnglishTableType(eventType) && use45) return ENGLISH_TABLE_45_MIN_HOURS;
  return hoursForActivityType(eventType);
}

module.exports = {
  POINTS_PER_HOUR,
  ENGLISH_TABLE_45_MIN_FROM,
  ENGLISH_TABLE_45_MIN_HOURS,
  ACTIVITY_HOURS,
  roundHours,
  roundSignedHours,
  hoursToPoints,
  signedHoursToPoints,
  combineClassCredit,
  hoursForEventType,
  hoursForActivityType,
};
