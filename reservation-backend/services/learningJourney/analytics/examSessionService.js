'use strict';

const { EVENT_TYPES, SKILLS, EVENT_STATUS } = require('../../../constants/learningJourneyEventConstants');
const { semesterIdFromDate } = require('../../../utils/semesterConstants');

/** 非 BESTEP 工具：考試日相距超過此天數視為不同梯次 */
const EXAM_SESSION_WINDOW_DAYS = 14;

const INSTRUMENT_PRIORITY = ['BESTEP', 'TOEIC', 'IELTS', 'TOEFL', 'GEPT'];

const TEST_PHASE = Object.freeze({
  SINGLE: 'single',
  PRE_TEST: 'pre_test',
  POST_TEST: 'post_test',
});

function parseDateOnly(value) {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function daysBetween(a, b) {
  const da = parseDateOnly(a);
  const db = parseDateOnly(b);
  if (!da || !db) return Number.POSITIVE_INFINITY;
  const ms = new Date(db).getTime() - new Date(da).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function examEventDate(ev) {
  return parseDateOnly(ev?.eventDate || ev?.examDate);
}

function isScorableExamEvent(ev) {
  return ev
    && ev.skill
    && SKILLS.includes(ev.skill)
    && !ev.excludeFlag
    && ev.status !== EVENT_STATUS.REGISTERED_NO_SCORE
    && !ev.registeredNoScoreFlag
    && ev.rawScore != null;
}

/**
 * 依天數窗口聚合成梯次（非 BESTEP 工具）。
 */
function clusterExamDates(dates, windowDays = EXAM_SESSION_WINDOW_DAYS) {
  const sorted = [...new Set(dates.map(parseDateOnly).filter(Boolean))].sort();
  const clusters = [];
  for (const date of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last || daysBetween(last.end, date) > windowDays) {
      clusters.push({ start: date, end: date, dates: [date] });
    } else {
      last.end = date;
      last.dates.push(date);
    }
  }
  return clusters;
}

/**
 * BESTEP：同一學期內的分日應考（聽讀／口寫）合併為一梯。
 */
function clusterExamDatesBySemester(dates) {
  const bySemester = new Map();
  for (const date of dates.map(parseDateOnly).filter(Boolean)) {
    const semesterId = semesterIdFromDate(date) || `_unmapped:${date}`;
    if (!bySemester.has(semesterId)) bySemester.set(semesterId, []);
    bySemester.get(semesterId).push(date);
  }

  const semesterIds = [...bySemester.keys()];

  return semesterIds.map((semesterId) => {
    const clusterDates = [...new Set(bySemester.get(semesterId))].sort();
    return {
      start: clusterDates[0],
      end: clusterDates[clusterDates.length - 1],
      dates: clusterDates,
      semesterId: semesterId.startsWith('_unmapped:') ? null : semesterId,
    };
  }).sort((a, b) => a.start.localeCompare(b.start));
}

function clusterSessionsForInstrument(dates, instrument) {
  if (String(instrument).toUpperCase() === 'BESTEP') {
    return clusterExamDatesBySemester(dates);
  }
  return clusterExamDates(dates);
}

/**
 * 依學生＋工具建立檢定梯次（含各技能代表事件）。
 */
function buildInstrumentSessions(examEvents, instrument) {
  const filtered = (examEvents || []).filter(
    (ev) => String(ev.instrument || '').toUpperCase() === String(instrument).toUpperCase()
      && isScorableExamEvent(ev)
  );
  if (!filtered.length) return [];

  const clusters = clusterSessionsForInstrument(
    filtered.map((ev) => examEventDate(ev)),
    instrument
  );
  return clusters.map((cluster, index) => {
    const cells = [];
    for (const skill of SKILLS) {
      const inCluster = filtered
        .filter((ev) => ev.skill === skill && cluster.dates.includes(examEventDate(ev)))
        .sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)));
      if (inCluster.length) cells.push({ skill, event: inCluster[0] });
    }
    return {
      roundIndex: index + 1,
      instrument: String(instrument).toUpperCase(),
      sessionStart: cluster.start,
      sessionEnd: cluster.end,
      sessionDates: cluster.dates,
      semesterId: cluster.semesterId ?? null,
      cells,
    };
  });
}

function listInstruments(examEvents) {
  return [...new Set(
    (examEvents || [])
      .filter(isScorableExamEvent)
      .map((ev) => String(ev.instrument || '').toUpperCase())
      .filter(Boolean)
  )];
}

function pickPrimaryInstrument(examEvents) {
  const instruments = listInstruments(examEvents);
  if (!instruments.length) return null;

  const roundCounts = new Map();
  for (const instrument of instruments) {
    roundCounts.set(instrument, buildInstrumentSessions(examEvents, instrument).length);
  }

  for (const preferred of INSTRUMENT_PRIORITY) {
    if (instruments.includes(preferred) && roundCounts.get(preferred) > 0) return preferred;
  }

  return instruments.sort((a, b) => {
    const diff = (roundCounts.get(b) || 0) - (roundCounts.get(a) || 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  })[0];
}

function resolveTestPhase(roundIndex, totalRounds) {
  if (!roundIndex || totalRounds <= 0) return null;
  if (totalRounds === 1) return TEST_PHASE.SINGLE;
  if (roundIndex === 1) return TEST_PHASE.PRE_TEST;
  if (roundIndex === 2) return TEST_PHASE.POST_TEST;
  return `round_${roundIndex}`;
}

/** 匯出用中文標籤 */
function formatTestPhaseLabel(testPhase) {
  if (testPhase === TEST_PHASE.PRE_TEST) return '前測';
  if (testPhase === TEST_PHASE.POST_TEST) return '後測';
  if (testPhase === TEST_PHASE.SINGLE) return '單次';
  if (testPhase && String(testPhase).startsWith('round_')) {
    return `第${String(testPhase).replace('round_', '')}梯`;
  }
  return testPhase || null;
}

/**
 * 資源曝光窗口：
 * - 第 1 梯：考試日「之前」（不含當日）
 * - 第 2 梯起：上一梯結束日（含）～本技能考試日「之前」
 */
function assertInExposureWindow(examDate, resourceDate, windowStartDate) {
  if (!examDate || !resourceDate) return false;
  const res = parseDateOnly(resourceDate);
  const exam = parseDateOnly(examDate);
  if (!res || !exam || res >= exam) return false;
  if (!windowStartDate) return true;
  const start = parseDateOnly(windowStartDate);
  return start ? res >= start : true;
}

function sumResourceInExposureWindow(examDate, resources, windowStartDate) {
  let courseHours = 0;
  let activityHours = 0;
  let courseCount = 0;
  let activityCount = 0;

  for (const resource of resources || []) {
    if (![EVENT_TYPES.COURSE, EVENT_TYPES.ACTIVITY].includes(resource.eventType)) continue;
    if (!assertInExposureWindow(examDate, resource.eventDate, windowStartDate)) continue;
    const hours = Number(resource.hours) || 0;
    if (resource.eventType === EVENT_TYPES.COURSE) {
      courseHours += hours;
      courseCount += 1;
    } else if (resource.eventType === EVENT_TYPES.ACTIVITY) {
      activityHours += hours;
      activityCount += 1;
    }
  }

  return {
    courseHours,
    activityHours,
    resourceHours: courseHours + activityHours,
    courseCount,
    activityCount,
    exposureBeforeExamFlag: courseHours + activityHours > 0,
  };
}

function findRoundForExamDate(rounds, examDate) {
  const date = parseDateOnly(examDate);
  return rounds.find((round) => round.sessionDates.includes(date)) || null;
}

module.exports = {
  EXAM_SESSION_WINDOW_DAYS,
  TEST_PHASE,
  INSTRUMENT_PRIORITY,
  parseDateOnly,
  clusterExamDates,
  clusterExamDatesBySemester,
  clusterSessionsForInstrument,
  buildInstrumentSessions,
  listInstruments,
  pickPrimaryInstrument,
  resolveTestPhase,
  formatTestPhaseLabel,
  assertInExposureWindow,
  sumResourceInExposureWindow,
  findRoundForExamDate,
  isScorableExamEvent,
};
