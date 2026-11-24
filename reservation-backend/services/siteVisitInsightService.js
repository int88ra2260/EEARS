'use strict';

const { Op } = require('sequelize');
const SiteVisitBucket = require('../models/SiteVisitBucket');

const TAIWAN_TZ = 'Asia/Taipei';
const INTENT_KEYS = new Set(['reserve', 'announcements', 'class_credit']);
const LOGIN_ORDER_KEYS = new Set([
  'reserve_then_login',
  'login_then_reserve',
  'already_logged_in',
  'reserve_without_login',
  'login_without_reserve',
]);
const DEVICE_KEYS = new Set(['desktop', 'phone']);
const SCROLL_WORLD_KEYS = new Set(['shown', 'scrolled', 'closed_idle', 'left_idle']);

function taipeiNow(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TAIWAN_TZ,
    hour: '2-digit',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  let hour = Number(parts.hour);
  if (!Number.isFinite(hour) || hour === 24) hour = 0;
  return {
    statDate: `${parts.year}-${parts.month}-${parts.day}`,
    hour,
  };
}

function dateDaysAgo(statDate, days) {
  const [year, month, day] = statDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - (days - 1));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekdayIndex(statDate) {
  const [year, month, day] = String(statDate).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function normalizeEvents(body) {
  const raw = Array.isArray(body?.events) ? body.events : [];
  if (raw.length > 4) {
    const err = new Error('事件過多');
    err.status = 400;
    throw err;
  }
  const { statDate, hour } = taipeiNow();
  const events = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const type = String(item.type || '');
    if (type === 'visit_hour') {
      events.push({ bucketType: 'visit_hour', bucketKey: String(hour) });
      continue;
    }
    if (type === 'intent' && INTENT_KEYS.has(item.key)) {
      events.push({ bucketType: 'intent', bucketKey: item.key });
      continue;
    }
    if (type === 'login_order' && LOGIN_ORDER_KEYS.has(item.key)) {
      events.push({ bucketType: 'login_order', bucketKey: item.key });
      continue;
    }
    if (type === 'device' && DEVICE_KEYS.has(item.key)) {
      events.push({ bucketType: 'device', bucketKey: item.key });
      continue;
    }
    if (type === 'scroll_world' && SCROLL_WORLD_KEYS.has(item.key)) {
      events.push({ bucketType: 'scroll_world', bucketKey: item.key });
    }
  }
  return { statDate, events };
}

async function bump(statDate, bucketType, bucketKey) {
  const where = { statDate, bucketType, bucketKey };
  const existing = await SiteVisitBucket.findOne({ where });
  if (existing) {
    await existing.increment('visitCount');
    return;
  }
  try {
    await SiteVisitBucket.create({ ...where, visitCount: 1 });
  } catch (err) {
    if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    const row = await SiteVisitBucket.findOne({ where });
    if (row) await row.increment('visitCount');
  }
}

async function recordVisitInsights(body) {
  const { statDate, events } = normalizeEvents(body);
  for (const event of events) {
    await bump(statDate, event.bucketType, event.bucketKey);
  }
  return { accepted: events.length };
}

function emptySummary(since, days) {
  return {
    since,
    days,
    intents: { reserve: 0, announcements: 0, class_credit: 0 },
    loginOrders: {
      reserve_then_login: 0,
      login_then_reserve: 0,
      already_logged_in: 0,
      reserve_without_login: 0,
      login_without_reserve: 0,
    },
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
    weekdays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, count: 0 })),
    devices: { desktop: 0, phone: 0 },
    scrollWorld: { shown: 0, scrolled: 0, closed_idle: 0, left_idle: 0 },
  };
}

async function summarizeVisitInsights({ days = 30 } = {}) {
  const windowDays = Math.min(90, Math.max(1, Number(days) || 30));
  const { statDate } = taipeiNow();
  const since = dateDaysAgo(statDate, windowDays);
  const summary = emptySummary(since, windowDays);
  const rows = await SiteVisitBucket.findAll({
    where: { statDate: { [Op.gte]: since } },
  });
  rows.forEach((row) => {
    const plain = row.get ? row.get({ plain: true }) : row;
    const count = Number(plain.visitCount) || 0;
    if (plain.bucketType === 'intent' && Object.prototype.hasOwnProperty.call(summary.intents, plain.bucketKey)) {
      summary.intents[plain.bucketKey] += count;
    }
    if (plain.bucketType === 'login_order' && Object.prototype.hasOwnProperty.call(summary.loginOrders, plain.bucketKey)) {
      summary.loginOrders[plain.bucketKey] += count;
    }
    if (plain.bucketType === 'device' && Object.prototype.hasOwnProperty.call(summary.devices, plain.bucketKey)) {
      summary.devices[plain.bucketKey] += count;
    }
    if (plain.bucketType === 'scroll_world' && Object.prototype.hasOwnProperty.call(summary.scrollWorld, plain.bucketKey)) {
      summary.scrollWorld[plain.bucketKey] += count;
    }
    if (plain.bucketType === 'visit_hour') {
      const hour = Number(plain.bucketKey);
      if (hour >= 0 && hour <= 23) summary.hours[hour].count += count;
      const weekday = weekdayIndex(plain.statDate);
      if (summary.weekdays[weekday]) summary.weekdays[weekday].count += count;
    }
  });
  return summary;
}

module.exports = {
  recordVisitInsights,
  summarizeVisitInsights,
  normalizeEvents,
  taipeiNow,
};
