'use strict';

const { ContractRegistryError } = require('./errors');

const BUSINESS_TIMEZONE = 'Asia/Taipei';
const TAIPEI_OFFSET_MINUTES = 8 * 60;

function fail(code, message) {
  throw new ContractRegistryError(code, message);
}

function isLeapYear(year) {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

function daysInMonth(year, month) {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1];
}

function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * 只接受 YYYY-MM-DD。不使用 Date 解析，因此 114-2、2026/3/1、2026-02-30 都會被拒絕。
 */
function parseCalendarDate(value) {
  if (typeof value !== 'string') {
    fail('INVALID_DATE_FORMAT', '日期必須是 YYYY-MM-DD 字串');
  }
  const text = value.trim();
  if (/^\d{3}-[12]$/.test(text)) {
    fail('INVALID_DATE_FORMAT', `學期代碼 ${text} 不是日期`);
  }
  if (text.includes('/')) {
    fail('INVALID_DATE_FORMAT', `不接受斜線日期：${text}`);
  }
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    fail('INVALID_DATE_FORMAT', `日期格式不合法：${text}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    fail('INVALID_DATE_FORMAT', `日曆上不存在的日期：${text}`);
  }
  return { year, month, day, text };
}

function formatCalendarDate(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addCalendarDays(dateText, delta) {
  const parsed = parseCalendarDate(dateText);
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + delta));
  return formatCalendarDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function formatTaipei(epochMs) {
  const shifted = new Date(epochMs + TAIPEI_OFFSET_MINUTES * 60 * 1000);
  const text = [
    formatCalendarDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate()),
    'T',
    pad(shifted.getUTCHours()),
    ':',
    pad(shifted.getUTCMinutes()),
    ':',
    pad(shifted.getUTCSeconds()),
    '+08:00',
  ].join('');
  return text;
}

function epochFromTaipeiParts(year, month, day, hour, minute, second) {
  return Date.UTC(year, month - 1, day, hour, minute, second) - TAIPEI_OFFSET_MINUTES * 60 * 1000;
}

/**
 * 完整 ISO 8601，必須有 Z 或 ±hh:mm。結果一律改寫成台灣時間，不讀取執行環境時區。
 */
function parseTimestamp(value) {
  if (typeof value !== 'string') {
    fail('INVALID_DATE_FORMAT', '時間必須是帶時區的 ISO 8601 字串');
  }
  const text = value.trim();
  if (text.includes('/') || text.includes(' ')) {
    fail('INVALID_DATE_FORMAT', `不接受的時間寫法：${text}`);
  }
  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) {
    fail('INVALID_DATE_FORMAT', `時間必須帶時區且含秒：${text}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    fail('INVALID_DATE_FORMAT', `日曆上不存在的時間：${text}`);
  }
  if (hour > 23 || minute > 59 || second > 59) {
    fail('INVALID_DATE_FORMAT', `時間欄位超出範圍：${text}`);
  }
  let offsetMinutes = 0;
  if (match[8] !== 'Z') {
    const sign = match[8].startsWith('-') ? -1 : 1;
    const offsetHour = Number(match[8].slice(1, 3));
    const offsetMinute = Number(match[8].slice(4, 6));
    if (offsetHour > 18 || offsetMinute > 59) {
      fail('INVALID_DATE_FORMAT', `時區偏移不合法：${text}`);
    }
    offsetMinutes = sign * (offsetHour * 60 + offsetMinute);
  }
  const epochMs = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60 * 1000;
  return {
    epochMs,
    text: formatTaipei(epochMs),
  };
}

function calendarDateToStartInstant(dateText) {
  const parsed = parseCalendarDate(dateText);
  return formatTaipei(epochFromTaipeiParts(parsed.year, parsed.month, parsed.day, 0, 0, 0));
}

function inclusiveEndToExclusiveInstant(endDate) {
  return calendarDateToStartInstant(addCalendarDays(endDate, 1));
}

function instantEpoch(timestamp) {
  return parseTimestamp(timestamp).epochMs;
}

function compareInstants(left, right) {
  const delta = instantEpoch(left) - instantEpoch(right);
  if (delta < 0) return -1;
  if (delta > 0) return 1;
  return 0;
}

function instantInHalfOpen(startInclusive, endExclusive, instant) {
  return compareInstants(instant, startInclusive) >= 0 && compareInstants(instant, endExclusive) < 0;
}

function assertHalfOpen(startInclusive, endExclusive) {
  parseTimestamp(startInclusive);
  parseTimestamp(endExclusive);
  if (compareInstants(startInclusive, endExclusive) >= 0) {
    fail('INVALID_TIME_RANGE', '開始必須早於結束（半開區間）');
  }
}

module.exports = {
  BUSINESS_TIMEZONE,
  parseCalendarDate,
  parseTimestamp,
  addCalendarDays,
  calendarDateToStartInstant,
  inclusiveEndToExclusiveInstant,
  compareInstants,
  instantInHalfOpen,
  assertHalfOpen,
  formatTaipei,
};
