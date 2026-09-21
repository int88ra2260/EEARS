'use strict';

const { Op } = require('sequelize');
const { LearningTraceEvent } = require('../models');
const { projectTraceToLearningJourney } = require('./learningTrace/learningTraceProjectionService');

const MICRO_LEARNING_GAME_IDS = ['word_bridge', 'listening_ladder', 'vocabulary_depth', 'vocabulary_size'];
const ALLOWED_GAME_IDS = new Set([
  ...MICRO_LEARNING_GAME_IDS,
  'activity_recommendation',
  'et_recommendation',
]);
const ALLOWED_EVENT_TYPES = new Set([
  'session_start',
  'session_complete',
  'funnel_impression',
  'funnel_click',
  'funnel_book_attempt',
]);
const CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const TRACE_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const CLIENT_SESSION_RE = /^[a-zA-Z0-9_-]{4,64}$/;
const VOCAB_DEPTH_ITEM_HEALTH = Object.freeze({
  minExposure: 10,
  minGroupExposure: 3,
  tooEasyCorrectRate: 0.9,
  tooHardCorrectRate: 0.3,
  lowDiscriminationSpread: 0.15,
  slowAvgResponseMs: 12000,
});
const CEFR_RANK = Object.freeze({ A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 });

function normalizeStudentId(value) {
  if (value == null || value === '') return null;
  const trimmed = String(value).trim();
  if (!/^\d{8,10}$/.test(trimmed)) {
    const err = new Error('學號格式不正確');
    err.status = 400;
    err.code = 'INVALID_STUDENT_ID';
    throw err;
  }
  return trimmed;
}

function parseOccurredAt(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    const err = new Error('occurredAt 格式不正確');
    err.status = 400;
    err.code = 'INVALID_OCCURRED_AT';
    throw err;
  }
  return date;
}

function clampNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function sanitizePayload(payload) {
  if (payload == null) return null;
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    const err = new Error('payload 必須為物件');
    err.status = 400;
    err.code = 'INVALID_PAYLOAD';
    throw err;
  }
  const json = JSON.stringify(payload);
  if (json.length > 32000) {
    const err = new Error('payload 過大');
    err.status = 400;
    err.code = 'PAYLOAD_TOO_LARGE';
    throw err;
  }
  return payload;
}

function validateTraceInput(body = {}) {
  const gameId = String(body.gameId || '').trim();
  const eventType = String(body.eventType || 'session_complete').trim();
  const traceId = String(body.traceId || '').trim();
  const clientSessionId = String(body.clientSessionId || '').trim();

  if (!ALLOWED_GAME_IDS.has(gameId)) {
    const err = new Error('不支援的 gameId');
    err.status = 400;
    err.code = 'INVALID_GAME_ID';
    throw err;
  }
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    const err = new Error('不支援的 eventType');
    err.status = 400;
    err.code = 'INVALID_EVENT_TYPE';
    throw err;
  }
  if (!TRACE_ID_RE.test(traceId)) {
    const err = new Error('traceId 格式不正確');
    err.status = 400;
    err.code = 'INVALID_TRACE_ID';
    throw err;
  }
  if (!CLIENT_SESSION_RE.test(clientSessionId)) {
    const err = new Error('clientSessionId 格式不正確');
    err.status = 400;
    err.code = 'INVALID_CLIENT_SESSION_ID';
    throw err;
  }

  const cefrLevel = body.cefrLevel != null ? String(body.cefrLevel).trim().toUpperCase() : null;
  if (cefrLevel && !CEFR_LEVELS.has(cefrLevel)) {
    const err = new Error('cefrLevel 格式不正確');
    err.status = 400;
    err.code = 'INVALID_CEFR_LEVEL';
    throw err;
  }

  const skillTags = Array.isArray(body.skillTags)
    ? body.skillTags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12)
    : null;

  return {
    traceId,
    gameId,
    eventType,
    clientSessionId,
    studentId: normalizeStudentId(body.studentId),
    occurredAt: parseOccurredAt(body.occurredAt),
    durationMs: clampNumber(body.durationMs, { min: 0, max: 6 * 60 * 60 * 1000 }),
    score: clampNumber(body.score, { min: 0, max: 10000 }),
    accuracy: clampNumber(body.accuracy, { min: 0, max: 1 }),
    cefrLevel: cefrLevel || null,
    skillTags,
    payload: sanitizePayload(body.payload),
  };
}

async function recordLearningTrace(body) {
  const input = validateTraceInput(body);
  const existing = await LearningTraceEvent.findOne({
    where: { traceId: input.traceId, eventType: input.eventType },
  });
  if (existing) {
    return { created: false, id: existing.id, traceId: existing.traceId, projected: false };
  }

  const row = await LearningTraceEvent.create({
    traceId: input.traceId,
    gameId: input.gameId,
    eventType: input.eventType,
    clientSessionId: input.clientSessionId,
    studentId: input.studentId,
    occurredAt: input.occurredAt,
    durationMs: input.durationMs,
    score: input.score,
    accuracy: input.accuracy,
    cefrLevel: input.cefrLevel,
    skillTags: input.skillTags,
    payload: input.payload,
  });

  let projected = null;
  if (input.eventType === 'session_complete' && input.studentId) {
    projected = await projectTraceToLearningJourney(row);
  }

  return {
    created: true,
    id: row.id,
    traceId: row.traceId,
    projected: projected?.created === true,
  };
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildDailySeries(rows, days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets.set(formatDateKey(d), 0);
  }
  rows.forEach((row) => {
    const key = formatDateKey(new Date(row.occurredAt));
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
  });
  return [...buckets.entries()].map(([date, sessions]) => ({ date, sessions }));
}

function pct(num, den) {
  if (!den) return 0;
  return Number((num / den).toFixed(4));
}

async function fetchCompletedSessionsForGame(gameId, since) {
  return LearningTraceEvent.findAll({
    where: {
      gameId,
      eventType: 'session_complete',
      occurredAt: { [Op.gte]: since },
    },
    attributes: [
      'id',
      'traceId',
      'clientSessionId',
      'studentId',
      'occurredAt',
      'durationMs',
      'accuracy',
      'cefrLevel',
      'payload',
    ],
    order: [['occurredAt', 'DESC']],
    limit: 5000,
  });
}

function summarizeEngagementRows(gameId, rows, days, since) {
  const uniqueSessions = new Set(rows.map((row) => row.clientSessionId)).size;
  const uniqueStudents = new Set(rows.map((row) => row.studentId).filter(Boolean)).size;
  const durations = rows.map((row) => Number(row.durationMs)).filter((n) => Number.isFinite(n) && n > 0);
  const avgDurationMs = durations.length
    ? Math.round(durations.reduce((sum, n) => sum + n, 0) / durations.length)
    : null;

  const levelCounts = {};
  rows.forEach((row) => {
    const level = row.cefrLevel || 'unknown';
    levelCounts[level] = (levelCounts[level] || 0) + 1;
  });

  const endReasonCounts = {};
  rows.forEach((row) => {
    const reason = row.payload?.endReason || row.payload?.stats?.endReason || 'unknown';
    endReasonCounts[reason] = (endReasonCounts[reason] || 0) + 1;
  });

  const mistakeBuckets = { '0-2': 0, '3-4': 0, '5+': 0 };
  rows.forEach((row) => {
    const mistakes = Number(
      row.payload?.totalMistakes ?? row.payload?.stats?.totalMistakes,
    );
    if (!Number.isFinite(mistakes)) return;
    if (mistakes <= 2) mistakeBuckets['0-2'] += 1;
    else if (mistakes <= 4) mistakeBuckets['3-4'] += 1;
    else mistakeBuckets['5+'] += 1;
  });

  const summary = {
    gameId,
    windowDays: days,
    since: since.toISOString(),
    totals: {
      completedSessions: rows.length,
      uniqueClientSessions: uniqueSessions,
      identifiedStudents: uniqueStudents,
      avgDurationMs,
    },
    cefrDistribution: Object.entries(levelCounts)
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => b.count - a.count),
    endReasonDistribution: Object.entries(endReasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    mistakeDistribution: Object.entries(mistakeBuckets)
      .map(([bucket, count]) => ({ bucket, count })),
    dailySessions: buildDailySeries(rows, Math.min(days, 30)),
    recentSamples: rows.slice(0, 8).map((row) => ({
      traceId: row.traceId,
      occurredAt: row.occurredAt,
      durationMs: row.durationMs,
      cefrLevel: row.cefrLevel,
      endReason: row.payload?.endReason || row.payload?.stats?.endReason || null,
      passedLevels: row.payload?.passedLevels || row.payload?.stats?.passedLevels || [],
    })),
    researchNote: '微學習軌跡為匿名或自願學號關聯之觀察資料，不作因果宣稱。',
  };

  if (gameId === 'vocabulary_depth') {
    summary.itemStats = summarizeVocabularyDepthItemStats(rows);
  }

  return summary;
}

function summarizeVocabularyDepthItemStats(rows) {
  const buckets = new Map();

  rows.forEach((row) => {
    const answerLog = Array.isArray(row.payload?.answerLog) ? row.payload.answerLog : [];
    const sessionLevel = normalizeCefrLevel(row.cefrLevel || row.payload?.estimatedLevel);
    answerLog.forEach((entry) => {
      const itemId = String(entry.itemId || entry.questionId || '').trim();
      if (!itemId) return;
      if (!buckets.has(itemId)) {
        buckets.set(itemId, {
          itemId,
          questionId: entry.questionId || itemId,
          level: entry.cefrLevel || entry.level || null,
          word: entry.word || null,
          itemType: entry.itemType || null,
          skillDimension: entry.skillDimension || null,
          componentProcess: entry.componentProcess || null,
          source: entry.source || null,
          reviewStatus: entry.reviewStatus || null,
          activityTags: Array.isArray(entry.activityTags) ? entry.activityTags : [],
          exposureCount: 0,
          correctCount: 0,
          responseMsTotal: 0,
          responseMsCount: 0,
          abilityGroups: new Map(),
        });
      }
      const bucket = buckets.get(itemId);
      bucket.exposureCount += 1;
      if (entry.isCorrect === true) bucket.correctCount += 1;
      const responseMs = Number(entry.responseMs);
      if (Number.isFinite(responseMs) && responseMs >= 0) {
        bucket.responseMsTotal += responseMs;
        bucket.responseMsCount += 1;
      }
      if (sessionLevel) {
        if (!bucket.abilityGroups.has(sessionLevel)) {
          bucket.abilityGroups.set(sessionLevel, {
            level: sessionLevel,
            exposureCount: 0,
            correctCount: 0,
          });
        }
        const group = bucket.abilityGroups.get(sessionLevel);
        group.exposureCount += 1;
        if (entry.isCorrect === true) group.correctCount += 1;
      }
    });
  });

  return [...buckets.values()]
    .map(buildVocabularyDepthItemStatsRow)
    .sort((a, b) => b.exposureCount - a.exposureCount || a.itemId.localeCompare(b.itemId))
    .slice(0, 100);
}

function normalizeCefrLevel(value) {
  const level = String(value || '').trim().toUpperCase();
  return CEFR_RANK[level] ? level : null;
}

function buildVocabularyDepthItemStatsRow(bucket) {
  const abilityGroupStats = [...bucket.abilityGroups.values()]
    .map((group) => ({
      level: group.level,
      exposureCount: group.exposureCount,
      correctCount: group.correctCount,
      correctRate: pct(group.correctCount, group.exposureCount),
    }))
    .sort((a, b) => (CEFR_RANK[a.level] || 99) - (CEFR_RANK[b.level] || 99));

  const row = {
    itemId: bucket.itemId,
    questionId: bucket.questionId,
    level: bucket.level,
    word: bucket.word,
    itemType: bucket.itemType,
    skillDimension: bucket.skillDimension,
    componentProcess: bucket.componentProcess,
    source: bucket.source,
    reviewStatus: bucket.reviewStatus,
    activityTags: bucket.activityTags,
    exposureCount: bucket.exposureCount,
    correctCount: bucket.correctCount,
    correctRate: pct(bucket.correctCount, bucket.exposureCount),
    avgResponseMs: bucket.responseMsCount
      ? Math.round(bucket.responseMsTotal / bucket.responseMsCount)
      : null,
    abilityGroupStats,
  };

  const discrimination = assessVocabularyDepthDiscrimination(row);
  return {
    ...row,
    discrimination,
    metadataSuggestion: buildVocabularyDepthMetadataSuggestion(row, discrimination),
    health: assessVocabularyDepthItemHealth({ ...row, discrimination }),
  };
}

function assessVocabularyDepthDiscrimination(row) {
  const usableGroups = (row.abilityGroupStats || [])
    .filter((group) => group.exposureCount >= VOCAB_DEPTH_ITEM_HEALTH.minGroupExposure)
    .sort((a, b) => (CEFR_RANK[a.level] || 99) - (CEFR_RANK[b.level] || 99));

  if (usableGroups.length < 2) {
    return {
      status: 'insufficient_group_data',
      label: '分組不足',
      spread: null,
      lowGroup: null,
      highGroup: null,
      minGroupExposure: VOCAB_DEPTH_ITEM_HEALTH.minGroupExposure,
    };
  }

  const lowGroup = usableGroups[0];
  const highGroup = usableGroups[usableGroups.length - 1];
  const spread = Number((highGroup.correctRate - lowGroup.correctRate).toFixed(4));

  return {
    status: spread < VOCAB_DEPTH_ITEM_HEALTH.lowDiscriminationSpread
      ? 'low_discrimination'
      : 'observable',
    label: spread < VOCAB_DEPTH_ITEM_HEALTH.lowDiscriminationSpread ? '鑑別度偏低' : '可觀察',
    spread,
    lowGroup,
    highGroup,
    minGroupExposure: VOCAB_DEPTH_ITEM_HEALTH.minGroupExposure,
  };
}

function buildVocabularyDepthMetadataSuggestion(row, discrimination) {
  const suggestions = [];
  if (!row.skillDimension) suggestions.push({ field: 'skillDimension', reason: '缺少技能維度標記' });
  if (!row.componentProcess) suggestions.push({ field: 'componentProcess', reason: '缺少測量歷程標記' });
  if (!row.activityTags?.length) suggestions.push({ field: 'activityTags', reason: '尚未對齊活動推薦標籤' });
  if (discrimination?.status === 'low_discrimination') {
    suggestions.push({ field: 'reviewStatus', reason: '分組答對率差異偏小，建議人工審題' });
  }

  return {
    status: suggestions.length ? 'needs_human_review' : 'not_needed',
    source: 'llm_pending',
    label: suggestions.length ? '待 AI 建議 / 人工確認' : '暫無建議',
    needsHumanReview: suggestions.length > 0,
    suggestions,
    note: 'LLM item assistant 尚未串接；此欄位先保留人工確認工作流與未來 AI 建議入口。',
  };
}

function assessVocabularyDepthItemHealth(row) {
  const exposureCount = Number(row.exposureCount || 0);
  const correctRate = Number(row.correctRate);
  const avgResponseMs = Number(row.avgResponseMs);
  const reasons = [];

  if (exposureCount < VOCAB_DEPTH_ITEM_HEALTH.minExposure) {
    return {
      status: 'insufficient_data',
      label: '資料不足',
      severity: 'muted',
      reasons: [`曝光未滿 ${VOCAB_DEPTH_ITEM_HEALTH.minExposure} 次`],
      thresholds: VOCAB_DEPTH_ITEM_HEALTH,
    };
  }

  if (Number.isFinite(correctRate) && correctRate >= VOCAB_DEPTH_ITEM_HEALTH.tooEasyCorrectRate) {
    reasons.push('答對率偏高，可能太簡單');
  }
  if (Number.isFinite(correctRate) && correctRate <= VOCAB_DEPTH_ITEM_HEALTH.tooHardCorrectRate) {
    reasons.push('答對率偏低，可能太難或題目需檢查');
  }
  if (Number.isFinite(avgResponseMs) && avgResponseMs >= VOCAB_DEPTH_ITEM_HEALTH.slowAvgResponseMs) {
    reasons.push('平均反應時間偏長');
  }
  if (row.discrimination?.status === 'low_discrimination') {
    reasons.push('高低估計程度答對率差異偏小，疑似鑑別度不足');
  }

  if (!reasons.length) {
    return {
      status: 'observable',
      label: '可觀察',
      severity: 'ok',
      reasons: ['樣本量達標，暫無明顯異常'],
      thresholds: VOCAB_DEPTH_ITEM_HEALTH,
    };
  }

  return {
    status: 'review_suggested',
    label: '建議檢查',
    severity: 'warning',
    reasons,
    thresholds: VOCAB_DEPTH_ITEM_HEALTH,
  };
}

function mergeDailySeries(seriesList) {
  /** @type {Map<string, number>} */
  const buckets = new Map();
  for (const series of seriesList) {
    for (const row of series || []) {
      buckets.set(row.date, (buckets.get(row.date) || 0) + row.sessions);
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, sessions]) => ({ date, sessions }));
}

function aggregateMicroLearningSummaries(perGameSummaries, days, since) {
  const totals = perGameSummaries.reduce(
    (acc, summary) => ({
      completedSessions: acc.completedSessions + (summary.totals?.completedSessions || 0),
      uniqueClientSessions: acc.uniqueClientSessions + (summary.totals?.uniqueClientSessions || 0),
      identifiedStudents: acc.identifiedStudents + (summary.totals?.identifiedStudents || 0),
      durationSum: acc.durationSum + (summary.totals?.avgDurationMs || 0) * (summary.totals?.completedSessions || 0),
      durationCount: acc.durationCount + (summary.totals?.avgDurationMs ? summary.totals.completedSessions : 0),
    }),
    { completedSessions: 0, uniqueClientSessions: 0, identifiedStudents: 0, durationSum: 0, durationCount: 0 },
  );

  return {
    gameId: 'all',
    windowDays: days,
    since: since.toISOString(),
    totals: {
      completedSessions: totals.completedSessions,
      uniqueClientSessions: totals.uniqueClientSessions,
      identifiedStudents: totals.identifiedStudents,
      avgDurationMs: totals.durationCount
        ? Math.round(totals.durationSum / totals.durationCount)
        : null,
    },
    perGame: perGameSummaries.map((s) => ({
      gameId: s.gameId,
      completedSessions: s.totals?.completedSessions || 0,
      uniqueClientSessions: s.totals?.uniqueClientSessions || 0,
      avgDurationMs: s.totals?.avgDurationMs ?? null,
    })),
    dailySessions: mergeDailySeries(perGameSummaries.map((s) => s.dailySessions)),
    cefrDistribution: [],
    endReasonDistribution: [],
    mistakeDistribution: [],
    recentSamples: [],
    researchNote: '總覽加總為各遊戲 session 之和；跨遊戲不重複去重 clientSessionId。',
  };
}

async function getMicroLearningEngagementSummary(query = {}) {
  const requestedGameId = String(query.gameId || 'all').trim();
  const days = clampNumber(query.days, { min: 7, max: 90 }) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  if (requestedGameId === 'all') {
    const perGameSummaries = await Promise.all(
      MICRO_LEARNING_GAME_IDS.map(async (gameId) => {
        const rows = await fetchCompletedSessionsForGame(gameId, since);
        return summarizeEngagementRows(gameId, rows, days, since);
      }),
    );
    return aggregateMicroLearningSummaries(perGameSummaries, days, since);
  }

  const gameId = MICRO_LEARNING_GAME_IDS.includes(requestedGameId)
    ? requestedGameId
    : 'word_bridge';
  const rows = await fetchCompletedSessionsForGame(gameId, since);
  return summarizeEngagementRows(gameId, rows, days, since);
}

async function getRecommendationFunnelSummary(query = {}) {
  const days = clampNumber(query.days, { min: 7, max: 90 }) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await LearningTraceEvent.findAll({
    where: {
      gameId: 'activity_recommendation',
      eventType: { [Op.in]: ['funnel_impression', 'funnel_click', 'funnel_book_attempt'] },
      occurredAt: { [Op.gte]: since },
    },
    attributes: ['eventType', 'payload', 'clientSessionId'],
    limit: 10000,
  });

  const impressions = rows.filter((row) => row.eventType === 'funnel_impression').length;
  const clicks = rows.filter((row) => row.eventType === 'funnel_click').length;
  const bookAttempts = rows.filter((row) => row.eventType === 'funnel_book_attempt').length;
  const uniqueSessions = new Set(rows.map((row) => row.clientSessionId)).size;

  const byActivity = {};
  rows.forEach((row) => {
    const key = row.payload?.activityKey || row.payload?.activitySlug || 'unknown';
    if (!byActivity[key]) {
      byActivity[key] = { activityKey: key, impressions: 0, clicks: 0, bookAttempts: 0 };
    }
    if (row.eventType === 'funnel_impression') byActivity[key].impressions += 1;
    if (row.eventType === 'funnel_click') byActivity[key].clicks += 1;
    if (row.eventType === 'funnel_book_attempt') byActivity[key].bookAttempts += 1;
  });

  return {
    windowDays: days,
    since: since.toISOString(),
    uniqueSessions,
    funnel: {
      impressions,
      clicks,
      bookAttempts,
      clickThroughRate: pct(clicks, impressions),
      bookAttemptRate: pct(bookAttempts, clicks),
    },
    byActivity: Object.values(byActivity).sort((a, b) => b.impressions - a.impressions),
    researchNote: '推薦漏斗為前端行為觀察，不含後端預約成功確認。',
    causalClaimAllowed: false,
  };
}

module.exports = {
  recordLearningTrace,
  getMicroLearningEngagementSummary,
  getRecommendationFunnelSummary,
  validateTraceInput,
  summarizeVocabularyDepthItemStats,
  assessVocabularyDepthItemHealth,
};
