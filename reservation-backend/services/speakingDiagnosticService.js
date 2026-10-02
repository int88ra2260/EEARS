'use strict';

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { SpeakingTask, SpeakingAttempt } = require('../models');
const { READ_ALOUD_TASKS } = require('../constants/speakingDiagnosticTaskBank');

const ANALYSIS_VERSION = 'v0';
const CLIENT_SESSION_RE = /^[a-zA-Z0-9_-]{4,64}$/;
const CEFR_RANK = Object.freeze({ A2: 2, B1: 3, B2: 4 });

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

function clampNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function sequenceSimilarity(targetTokens, responseTokens) {
  if (!targetTokens.length) return null;
  const distance = levenshtein(targetTokens, responseTokens);
  return Number(Math.max(0, 1 - distance / targetTokens.length).toFixed(4));
}

function wordCoverage(targetTokens, responseTokens) {
  if (!targetTokens.length) return null;
  const responseCounts = new Map();
  responseTokens.forEach((word) => responseCounts.set(word, (responseCounts.get(word) || 0) + 1));
  let matched = 0;
  targetTokens.forEach((word) => {
    const count = responseCounts.get(word) || 0;
    if (count > 0) {
      matched += 1;
      responseCounts.set(word, count - 1);
    }
  });
  return Number((matched / targetTokens.length).toFixed(4));
}

function parseClientFeatures(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function buildAutomatedAnalysis({ task, transcript, durationMs, clientFeatures }) {
  const targetTokens = tokenize(task.targetText);
  const responseTokens = tokenize(transcript);
  const durationMinutes = durationMs ? durationMs / 60000 : null;
  const spokenWords = responseTokens.length || clampNumber(clientFeatures?.spokenWordEstimate, { min: 0, max: 5000 });
  const speechRateWpm = durationMinutes && spokenWords != null
    ? Number((spokenWords / durationMinutes).toFixed(2))
    : null;
  const totalPauseMs = clampNumber(clientFeatures?.totalPauseMs, { min: 0, max: 60 * 60 * 1000 });
  const phonationMinutes = durationMs && totalPauseMs != null
    ? Math.max(0.001, (durationMs - totalPauseMs) / 60000)
    : null;
  const articulationRateWpm = phonationMinutes && spokenWords != null
    ? Number((spokenWords / phonationMinutes).toFixed(2))
    : null;
  const pauseCount = clampNumber(clientFeatures?.pauseCount, { min: 0, max: 1000 });
  const averagePauseDurationMs = pauseCount && totalPauseMs != null
    ? Math.round(totalPauseMs / pauseCount)
    : clampNumber(clientFeatures?.averagePauseDurationMs, { min: 0, max: 60000 });
  const pauseFrequencyPerMinute = durationMinutes && pauseCount != null
    ? Number((pauseCount / durationMinutes).toFixed(2))
    : null;

  const completionRate = responseTokens.length
    ? wordCoverage(targetTokens, responseTokens)
    : null;
  const transcriptSimilarity = responseTokens.length
    ? sequenceSimilarity(targetTokens, responseTokens)
    : null;

  const features = {
    mode: 'controlled_read_aloud',
    analysisVersion: ANALYSIS_VERSION,
    targetWordCount: targetTokens.length,
    transcriptWordCount: responseTokens.length || null,
    durationMs,
    speechRateWpm,
    articulationRateWpm,
    pauseCount,
    pauseFrequencyPerMinute,
    averagePauseDurationMs,
    totalPauseMs,
    longPauseCount: clampNumber(clientFeatures?.longPauseCount, { min: 0, max: 1000 }),
    completionRate,
    transcriptSimilarity,
    acousticPlaceholders: {
      phonemeAccuracy: null,
      stress: null,
      rhythm: null,
      pitchProsody: null,
      note: 'Reserved for forced alignment or speech assessment API integration.',
    },
    clientFeatures,
  };

  const automatedScores = {
    wordCompletion: completionRate,
    fluencyProxy: buildFluencyProxy({ speechRateWpm, pauseFrequencyPerMinute, averagePauseDurationMs }),
    transcriptSimilarity,
    scoreCaution: 'Diagnostic evidence only; not a calibrated CEFR speaking score.',
  };

  return { features, automatedScores };
}

function buildFluencyProxy({ speechRateWpm, pauseFrequencyPerMinute, averagePauseDurationMs }) {
  if (speechRateWpm == null && pauseFrequencyPerMinute == null && averagePauseDurationMs == null) return null;
  let score = 1;
  if (speechRateWpm != null) {
    if (speechRateWpm >= 90 && speechRateWpm <= 170) score += 0.45;
    else if (speechRateWpm >= 60 && speechRateWpm < 90) score += 0.25;
  }
  if (pauseFrequencyPerMinute != null) {
    if (pauseFrequencyPerMinute <= 8) score += 0.35;
    else if (pauseFrequencyPerMinute <= 14) score += 0.2;
  }
  if (averagePauseDurationMs != null) {
    if (averagePauseDurationMs <= 900) score += 0.2;
    else if (averagePauseDurationMs <= 1600) score += 0.1;
  }
  return Number(Math.min(2, score).toFixed(2));
}

function toTaskDto(task) {
  return {
    id: task.id,
    taskKey: task.taskKey,
    level: task.level,
    taskType: task.taskType,
    title: task.title,
    prompt: task.prompt,
    targetText: task.targetText,
    estimatedSeconds: task.estimatedSeconds,
    targetWords: task.targetWords,
    focusTags: task.focusTags || [],
    constructTags: task.constructTags || [],
    version: task.version,
  };
}

async function ensureSeedTasks() {
  const count = await SpeakingTask.count();
  if (count > 0) return;
  await SpeakingTask.bulkCreate(
    READ_ALOUD_TASKS.map((task) => ({ ...task, isActive: true, version: 'v0' })),
    { ignoreDuplicates: true },
  );
}

async function listSpeakingTasks(query = {}) {
  await ensureSeedTasks();
  const where = { isActive: true };
  const level = String(query.level || '').trim().toUpperCase();
  if (CEFR_RANK[level]) where.level = level;
  const taskType = String(query.taskType || 'read_aloud').trim();
  if (taskType) where.taskType = taskType;
  const rows = await SpeakingTask.findAll({
    where,
    order: [['level', 'ASC'], ['id', 'ASC']],
  });
  return {
    tasks: rows.map(toTaskDto),
    constructVersion: 'v0',
    caution: 'Read-aloud tasks provide controlled speech evidence, not full speaking proficiency certification.',
  };
}

async function submitSpeakingAttempt({ body, file }) {
  await ensureSeedTasks();
  if (!file) {
    const err = new Error('請上傳錄音檔');
    err.status = 400;
    err.code = 'AUDIO_REQUIRED';
    throw err;
  }

  const taskKey = String(body.taskKey || '').trim();
  const task = await SpeakingTask.findOne({ where: { taskKey, isActive: true } });
  if (!task) {
    const err = new Error('找不到口說任務');
    err.status = 400;
    err.code = 'TASK_NOT_FOUND';
    throw err;
  }

  const clientSessionId = String(body.clientSessionId || '').trim();
  if (!CLIENT_SESSION_RE.test(clientSessionId)) {
    const err = new Error('clientSessionId 格式不正確');
    err.status = 400;
    err.code = 'INVALID_CLIENT_SESSION_ID';
    throw err;
  }

  const durationMs = clampNumber(body.durationMs, { min: 0, max: 10 * 60 * 1000 });
  const transcript = String(body.transcript || '').trim().slice(0, 8000) || null;
  const clientFeatures = parseClientFeatures(body.clientFeatures);
  const { features, automatedScores } = buildAutomatedAnalysis({
    task,
    transcript,
    durationMs,
    clientFeatures,
  });

  const row = await SpeakingAttempt.create({
    attemptUid: uuidv4(),
    taskId: task.id,
    studentId: normalizeStudentId(body.studentId),
    clientSessionId,
    submittedAt: new Date(),
    audioPath: path.relative(path.join(__dirname, '..'), file.path).replace(/\\/g, '/'),
    audioMimeType: file.mimetype || null,
    audioSizeBytes: file.size || null,
    durationMs,
    transcript,
    features,
    automatedScores,
    analysisVersion: ANALYSIS_VERSION,
    status: 'submitted',
  });

  return {
    attemptUid: row.attemptUid,
    task: toTaskDto(task),
    features,
    automatedScores,
    audioUrl: `/${row.audioPath}`,
    nextStep: 'Teacher rubric rating and ASR/forced-alignment integration can be added on this attempt record.',
  };
}

async function listRecentAttempts(query = {}) {
  const limit = Math.max(1, Math.min(Number(query.limit) || 20, 100));
  const where = {};
  const studentId = normalizeStudentId(query.studentId);
  if (studentId) where.studentId = studentId;
  const rows = await SpeakingAttempt.findAll({
    where,
    include: [{ model: SpeakingTask, as: 'task' }],
    order: [['submittedAt', 'DESC']],
    limit,
  });
  return rows.map((row) => ({
    attemptUid: row.attemptUid,
    studentId: row.studentId,
    submittedAt: row.submittedAt,
    task: row.task ? toTaskDto(row.task) : null,
    durationMs: row.durationMs,
    transcript: row.transcript,
    features: row.features,
    automatedScores: row.automatedScores,
    audioUrl: `/${row.audioPath}`,
  }));
}

module.exports = {
  ANALYSIS_VERSION,
  buildAutomatedAnalysis,
  listSpeakingTasks,
  submitSpeakingAttempt,
  listRecentAttempts,
  normalizeText,
  tokenize,
};
