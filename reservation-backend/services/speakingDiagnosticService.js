'use strict';

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { SpeakingTask, SpeakingAttempt, SpeakingHumanRating, SpeakingAdaptiveSession } = require('../models');
const { alignSpeakingAttempt } = require('./speakingForcedAlignmentService');
const { SPEAKING_TASKS } = require('../constants/speakingDiagnosticTaskBank');

const ANALYSIS_VERSION = 'v0';
const CLIENT_SESSION_RE = /^[a-zA-Z0-9_-]{4,64}$/;
const CEFR_RANK = Object.freeze({ A2: 2, B1: 3, B2: 4 });
const CEFR_LEVELS = ['A2', 'B1', 'B2'];
const ADAPTIVE_REQUIRED_CONSTRUCTS = ['fluency', 'pronunciation_intelligibility', 'grammar', 'vocabulary', 'task_achievement'];
const ADAPTIVE_TASK_TYPE_SEQUENCE = ['read_aloud', 'campus_short_answer', 'picture_description', 'opinion_response'];
const ADAPTIVE_DEFAULTS = Object.freeze({ minTasks: 4, maxTasks: 8, targetStandardError: 0.38 });

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

function buildWordResults(targetTokens, responseTokens) {
  if (!targetTokens.length) return [];
  const responseCounts = new Map();
  responseTokens.forEach((word) => responseCounts.set(word, (responseCounts.get(word) || 0) + 1));
  return targetTokens.map((word, index) => {
    const count = responseCounts.get(word) || 0;
    if (count > 0) {
      responseCounts.set(word, count - 1);
      return { index, word, status: 'matched' };
    }
    return { index, word, status: responseTokens.length ? 'missing' : 'unknown' };
  });
}

function sequenceSimilarity(targetTokens, responseTokens) {
  if (!targetTokens.length) return null;
  const distance = levenshtein(targetTokens, responseTokens);
  return Number(Math.max(0, 1 - distance / targetTokens.length).toFixed(4));
}

function wordCoverage(targetTokens, responseTokens) {
  const results = buildWordResults(targetTokens, responseTokens);
  if (!results.length) return null;
  const matched = results.filter((row) => row.status === 'matched').length;
  return Number((matched / results.length).toFixed(4));
}

function rateToPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.max(0, Math.min(1, n)) * 100);
}

function proxyToPercent(value, max = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.max(0, Math.min(max, n)) / max * 100);
}

function buildPaceScore(speechRateWpm) {
  const n = Number(speechRateWpm);
  if (!Number.isFinite(n)) return null;
  if (n >= 95 && n <= 165) return 100;
  if (n >= 80 && n < 95) return 84;
  if (n > 165 && n <= 190) return 78;
  if (n >= 60 && n < 80) return 64;
  if (n > 190) return 58;
  return 46;
}

function buildPauseScore({ pauseFrequencyPerMinute, averagePauseDurationMs }) {
  const freq = Number(pauseFrequencyPerMinute);
  const avg = Number(averagePauseDurationMs);
  if (!Number.isFinite(freq) && !Number.isFinite(avg)) return null;
  let score = 100;
  if (Number.isFinite(freq)) score -= Math.max(0, freq - 6) * 4;
  if (Number.isFinite(avg)) score -= Math.max(0, avg - 700) / 20;
  return Math.round(Math.max(30, Math.min(100, score)));
}

function weightedReadAloudOverall(scores) {
  const weights = [
    ['completionPercent', 0.45],
    ['fluencyPercent', 0.25],
    ['pacePercent', 0.15],
    ['pauseControlPercent', 0.15],
  ];
  let sum = 0;
  let weightSum = 0;
  weights.forEach(([key, weight]) => {
    const value = Number(scores[key]);
    if (Number.isFinite(value)) {
      sum += value * weight;
      weightSum += weight;
    }
  });
  return weightSum ? Math.round(sum / weightSum) : null;
}

function weightedConstructedOverall(scores) {
  const weights = [
    ['completionPercent', 0.15],
    ['fluencyPercent', 0.2],
    ['pacePercent', 0.15],
    ['pauseControlPercent', 0.15],
    ['vocabularyPercent', 0.15],
    ['grammarPercent', 0.1],
    ['coherencePercent', 0.1],
  ];
  let sum = 0;
  let weightSum = 0;
  weights.forEach(([key, weight]) => {
    const value = Number(scores[key]);
    if (Number.isFinite(value)) {
      sum += value * weight;
      weightSum += weight;
    }
  });
  return weightSum ? Math.round(sum / weightSum) : null;
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

function isRealAlignment(alignment) {
  return alignment && alignment.status && !['baseline', 'no_target_words', 'audio_missing'].includes(alignment.status);
}

function buildAlignmentWordResults(targetTokens, alignment) {
  const alignedWords = Array.isArray(alignment?.words) ? alignment.words : [];
  if (!targetTokens.length || !alignedWords.length || !isRealAlignment(alignment)) return null;
  const alignedCounts = new Map();
  alignedWords.forEach((item) => {
    const word = normalizeText(item.word);
    if (word) alignedCounts.set(word, (alignedCounts.get(word) || 0) + 1);
  });
  return targetTokens.map((word, index) => {
    const count = alignedCounts.get(word) || 0;
    if (count > 0) {
      alignedCounts.set(word, count - 1);
      return { index, word, status: 'aligned' };
    }
    return { index, word, status: 'missing' };
  });
}

const COMMON_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there',
  'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time',
  'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than',
  'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first',
  'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
]);
const FILLER_WORDS = new Set(['um', 'uh', 'erm', 'er', 'ah', 'like', 'well', 'so']);
const REPAIR_MARKERS = new Set(['sorry', 'mean', 'actually', 'rather', 'correction']);
const DISCOURSE_MARKERS = new Set(['first', 'second', 'finally', 'however', 'therefore', 'because', 'although', 'also', 'moreover', 'then', 'next', 'for example']);
const SUBORDINATORS = new Set(['because', 'although', 'while', 'when', 'if', 'unless', 'since', 'before', 'after', 'that', 'which', 'who']);

function countConsecutiveRepetitions(tokens) {
  let count = 0;
  for (let i = 1; i < tokens.length; i += 1) {
    if (tokens[i] && tokens[i] === tokens[i - 1]) count += 1;
  }
  return count;
}

function buildTranscriptEvidence(transcript) {
  const raw = String(transcript || '').trim();
  const tokens = tokenize(raw);
  if (!tokens.length) {
    return {
      wordCount: 0,
      uniqueWordCount: 0,
      lexicalDiversity: null,
      lexicalSophistication: null,
      averageWordLength: null,
      fillerCount: 0,
      repairMarkerCount: 0,
      repetitionCount: 0,
      discourseMarkerCount: 0,
      subordinatorCount: 0,
      sentenceCount: 0,
      meanWordsPerSentence: null,
      grammarControlProxy: null,
      coherenceProxy: null,
    };
  }
  const unique = new Set(tokens);
  const sophisticated = tokens.filter((word) => word.length >= 7 && !COMMON_WORDS.has(word));
  const fillerCount = tokens.filter((word) => FILLER_WORDS.has(word)).length;
  const repairMarkerCount = tokens.filter((word) => REPAIR_MARKERS.has(word)).length;
  const repetitionCount = countConsecutiveRepetitions(tokens);
  const discourseMarkerCount = tokens.filter((word) => DISCOURSE_MARKERS.has(word)).length;
  const subordinatorCount = tokens.filter((word) => SUBORDINATORS.has(word)).length;
  const sentenceCount = Math.max(1, raw.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length);
  const lexicalDiversity = unique.size / tokens.length;
  const lexicalSophistication = sophisticated.length / tokens.length;
  const meanWordsPerSentence = tokens.length / sentenceCount;
  const disfluencyPenalty = Math.min(0.5, (fillerCount + repairMarkerCount + repetitionCount) / Math.max(1, tokens.length));
  const grammarControlProxy = Math.max(0, Math.min(1, 0.55 + Math.min(0.25, subordinatorCount * 0.05) + Math.min(0.2, meanWordsPerSentence / 80) - disfluencyPenalty));
  const coherenceProxy = Math.max(0, Math.min(1, 0.45 + Math.min(0.35, discourseMarkerCount * 0.08) + Math.min(0.2, subordinatorCount * 0.04) - Math.min(0.25, repetitionCount * 0.04)));
  return {
    wordCount: tokens.length,
    uniqueWordCount: unique.size,
    lexicalDiversity: Number(lexicalDiversity.toFixed(4)),
    lexicalSophistication: Number(lexicalSophistication.toFixed(4)),
    averageWordLength: Number((tokens.join('').length / tokens.length).toFixed(2)),
    fillerCount,
    repairMarkerCount,
    repetitionCount,
    discourseMarkerCount,
    subordinatorCount,
    sentenceCount,
    meanWordsPerSentence: Number(meanWordsPerSentence.toFixed(2)),
    grammarControlProxy: Number(grammarControlProxy.toFixed(4)),
    coherenceProxy: Number(coherenceProxy.toFixed(4)),
  };
}

function buildAutomatedAnalysis({ task, transcript, durationMs, clientFeatures, alignment }) {
  const isReadAloud = task.taskType === 'read_aloud';
  const targetTokens = isReadAloud ? tokenize(task.targetText) : [];
  const responseTokens = tokenize(transcript);
  const transcriptWordResults = isReadAloud ? buildWordResults(targetTokens, responseTokens) : [];
  const alignmentWordResults = isReadAloud ? buildAlignmentWordResults(targetTokens, alignment) : null;
  const wordResults = alignmentWordResults || transcriptWordResults;
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

  const transcriptCompletionRate = isReadAloud && responseTokens.length ? wordCoverage(targetTokens, responseTokens) : null;
  const alignmentCompletionRate = isReadAloud && alignmentWordResults?.length
    ? Number((alignmentWordResults.filter((row) => row.status === 'aligned').length / alignmentWordResults.length).toFixed(4))
    : null;
  const completionRate = alignmentCompletionRate != null ? alignmentCompletionRate : transcriptCompletionRate;
  const transcriptSimilarity = isReadAloud && responseTokens.length ? sequenceSimilarity(targetTokens, responseTokens) : null;
  const transcriptEvidence = buildTranscriptEvidence(transcript);
  const responseTargetRate = !isReadAloud && task.targetWords
    ? Number(Math.min(1, responseTokens.length / task.targetWords).toFixed(4))
    : null;

  const features = {
    mode: isReadAloud ? 'controlled_read_aloud' : 'constructed_response',
    analysisVersion: ANALYSIS_VERSION,
    taskType: task.taskType,
    targetWordCount: isReadAloud ? targetTokens.length : task.targetWords || null,
    transcriptWordCount: responseTokens.length || null,
    durationMs,
    speechRateWpm,
    articulationRateWpm,
    pauseCount,
    pauseFrequencyPerMinute,
    averagePauseDurationMs,
    totalPauseMs,
    longPauseCount: clampNumber(clientFeatures?.longPauseCount, { min: 0, max: 1000 }),
    completionRate: isReadAloud ? completionRate : responseTargetRate,
    responseTargetRate,
    transcriptCompletionRate,
    alignmentCompletionRate,
    transcriptSimilarity,
    wordResults,
    transcriptWordResults,
    alignment,
    transcriptEvidence,
    acousticPlaceholders: {
      phonemeAccuracy: null,
      stress: null,
      rhythm: null,
      pitchProsody: null,
      note: isReadAloud
        ? 'Reserved for phoneme-level forced alignment or speech assessment API integration.'
        : 'Constructed response tasks use transcript and fluency evidence first; pronunciation can be added after open-response alignment is available.',
    },
    clientFeatures,
  };

  const fluencyProxy = buildFluencyProxy({ speechRateWpm, pauseFrequencyPerMinute, averagePauseDurationMs });
  const grammarPercent = rateToPercent(transcriptEvidence.grammarControlProxy);
  const coherencePercent = rateToPercent(transcriptEvidence.coherenceProxy);
  const vocabularyPercent = rateToPercent(Math.min(1,
    (Number(transcriptEvidence.lexicalDiversity) || 0) * 0.65
    + (Number(transcriptEvidence.lexicalSophistication) || 0) * 1.2,
  ));
  const presentationScores = {
    completionPercent: isReadAloud ? rateToPercent(completionRate) : rateToPercent(responseTargetRate),
    similarityPercent: rateToPercent(transcriptSimilarity),
    fluencyPercent: proxyToPercent(fluencyProxy),
    pacePercent: buildPaceScore(speechRateWpm),
    pauseControlPercent: buildPauseScore({ pauseFrequencyPerMinute, averagePauseDurationMs }),
    vocabularyPercent: isReadAloud ? null : vocabularyPercent,
    grammarPercent: isReadAloud ? null : grammarPercent,
    coherencePercent: isReadAloud ? null : coherencePercent,
  };
  presentationScores.overallPercent = isReadAloud
    ? weightedReadAloudOverall(presentationScores)
    : weightedConstructedOverall(presentationScores);

  const automatedScores = {
    wordCompletion: isReadAloud ? completionRate : null,
    transcriptCompletion: transcriptCompletionRate,
    alignmentCompletion: alignmentCompletionRate,
    responseTargetRate,
    fluencyProxy,
    transcriptSimilarity,
    languageEvidence: {
      lexicalDiversity: transcriptEvidence.lexicalDiversity,
      lexicalSophistication: transcriptEvidence.lexicalSophistication,
      grammarControlProxy: transcriptEvidence.grammarControlProxy,
      coherenceProxy: transcriptEvidence.coherenceProxy,
      fillerCount: transcriptEvidence.fillerCount,
      repairMarkerCount: transcriptEvidence.repairMarkerCount,
      repetitionCount: transcriptEvidence.repetitionCount,
    },
    presentationScores,
    scoreCaution: 'Diagnostic evidence only; not a calibrated CEFR speaking score.',
  };

  return { features, automatedScores, presentationScores, wordResults };
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

function toRatingDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    raterUserId: row.raterUserId,
    fluency: row.fluency,
    pronunciationIntelligibility: row.pronunciationIntelligibility,
    grammar: row.grammar,
    vocabulary: row.vocabulary,
    taskAchievement: row.taskAchievement,
    comments: row.comments,
    rubricVersion: row.rubricVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}


const RATING_FIELDS = [
  'fluency',
  'pronunciationIntelligibility',
  'grammar',
  'vocabulary',
  'taskAchievement',
];

function ratingCount(row) {
  return Array.isArray(row?.humanRatings) ? row.humanRatings.length : 0;
}

function ratingStatus(row) {
  const count = ratingCount(row);
  if (count >= 2) return 'double_rated';
  if (count === 1) return 'single_rated';
  return 'unrated';
}

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function pearson(pairs) {
  const clean = pairs.filter(([x, y]) => Number.isFinite(Number(x)) && Number.isFinite(Number(y)))
    .map(([x, y]) => [Number(x), Number(y)]);
  if (clean.length < 3) return null;
  const meanX = mean(clean.map(([x]) => x));
  const meanY = mean(clean.map(([, y]) => y));
  let numerator = 0;
  let dx2 = 0;
  let dy2 = 0;
  clean.forEach(([x, y]) => {
    const dx = x - meanX;
    const dy = y - meanY;
    numerator += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  });
  const denominator = Math.sqrt(dx2 * dy2);
  return denominator ? Number((numerator / denominator).toFixed(4)) : null;
}

function meanRatingForField(ratings, field) {
  return mean((ratings || []).map((rating) => rating[field]));
}

function meanOverallHumanRating(ratings) {
  const fieldMeans = RATING_FIELDS.map((field) => meanRatingForField(ratings, field)).filter(Number.isFinite);
  return mean(fieldMeans);
}

function toAttemptDto(row) {
  const ratings = row.humanRatings || [];
  return {
    attemptUid: row.attemptUid,
    studentId: row.studentId,
    submittedAt: row.submittedAt,
    task: row.task ? toTaskDto(row.task) : null,
    durationMs: row.durationMs,
    transcript: row.transcript,
    features: row.features,
    automatedScores: row.automatedScores,
    presentationScores: row.automatedScores?.presentationScores || null,
    wordResults: row.features?.wordResults || [],
    alignment: row.features?.alignment || null,
    audioUrl: `/${row.audioPath}`,
    ratingCount: ratings.length,
    ratingStatus: ratingStatus(row),
    humanRatingMean: meanOverallHumanRating(ratings),
    humanRatings: ratings.map(toRatingDto),
  };
}

async function ensureSeedTasks() {
  const existing = await SpeakingTask.findAll({ attributes: ['taskKey'] });
  const existingKeys = new Set(existing.map((row) => row.taskKey));
  const missing = SPEAKING_TASKS.filter((task) => !existingKeys.has(task.taskKey));
  if (!missing.length) return;
  await SpeakingTask.bulkCreate(
    missing.map((task) => ({ ...task, isActive: true, version: 'v0' })),
    { ignoreDuplicates: true },
  );
}

function normalizeCompletedTaskKeys(value) {
  if (!value) return new Set();
  if (Array.isArray(value)) return new Set(value.map(String));
  return new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean));
}

function adjacentLevel(level, direction) {
  const levels = ['A2', 'B1', 'B2'];
  const index = Math.max(0, levels.indexOf(String(level || 'A2').toUpperCase()));
  const nextIndex = Math.max(0, Math.min(levels.length - 1, index + direction));
  return levels[nextIndex];
}

function chooseAdaptiveLevel({ currentLevel, previousOverallPercent }) {
  const score = Number(previousOverallPercent);
  if (!Number.isFinite(score)) return String(currentLevel || 'A2').toUpperCase();
  if (score >= 82) return adjacentLevel(currentLevel, 1);
  if (score <= 52) return adjacentLevel(currentLevel, -1);
  return String(currentLevel || 'A2').toUpperCase();
}

function levelToAbility(level) {
  return CEFR_RANK[String(level || 'B1').toUpperCase()] || CEFR_RANK.B1;
}

function abilityToLevel(ability) {
  const n = Number(ability);
  if (!Number.isFinite(n)) return 'B1';
  if (n < 2.55) return 'A2';
  if (n < 3.55) return 'B1';
  return 'B2';
}

function normalizeAdaptiveLevel(value) {
  const level = String(value || 'B1').trim().toUpperCase();
  return CEFR_RANK[level] ? level : 'B1';
}

function normalizeAdaptiveTaskLimit(value, fallback, { min, max }) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function emptyCoverage(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function normalizeJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function scoreToObservationAbility(task, presentationScores = {}) {
  const levelBase = levelToAbility(task?.level);
  const score = clampNumber(presentationScores.overallPercent, { min: 0, max: 100 });
  if (score == null) return levelBase;
  const offset = (score - 67) / 38;
  return Number(Math.max(1.8, Math.min(4.2, levelBase + offset * 0.62)).toFixed(3));
}

function summarizeAdaptiveAbility({ previousAbility, previousCount, observationAbility }) {
  const oldAbility = Number(previousAbility);
  const count = Math.max(0, Number(previousCount) || 0);
  const prior = Number.isFinite(oldAbility) ? oldAbility : CEFR_RANK.B1;
  const nextAbility = ((prior * Math.max(1, count)) + observationAbility) / (Math.max(1, count) + 1);
  const completedCount = count + 1;
  const standardError = Math.max(0.3, 0.95 / Math.sqrt(completedCount + 0.8));
  return {
    ability: Number(nextAbility.toFixed(3)),
    standardError: Number(standardError.toFixed(3)),
    level: abilityToLevel(nextAbility),
  };
}

function hasRequiredConstructCoverage(coverage = {}) {
  return ADAPTIVE_REQUIRED_CONSTRUCTS.every((key) => Number(coverage[key]) > 0);
}

function adaptiveCanStop(session) {
  const path = normalizeJsonArray(session.path);
  const count = path.length;
  if (count >= session.maxTasks) return { stop: true, reason: 'max_tasks_reached' };
  if (count < session.minTasks) return { stop: false, reason: 'min_tasks_not_met' };
  if (!hasRequiredConstructCoverage(session.constructCoverage)) return { stop: false, reason: 'construct_coverage_not_met' };
  if (Number(session.standardError) <= ADAPTIVE_DEFAULTS.targetStandardError) return { stop: true, reason: 'ability_estimate_stable' };
  return { stop: false, reason: 'needs_more_precision' };
}

function toAdaptiveSessionDto(row, nextTask = null, decision = null) {
  if (!row) return null;
  const path = normalizeJsonArray(row.path);
  return {
    sessionUid: row.sessionUid,
    clientSessionId: row.clientSessionId,
    studentId: row.studentId,
    status: row.status,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    initialLevel: row.initialLevel,
    currentLevel: row.currentLevel,
    currentAbility: row.currentAbility,
    standardError: row.standardError,
    minTasks: row.minTasks,
    maxTasks: row.maxTasks,
    completedTaskKeys: normalizeJsonArray(row.completedTaskKeys),
    constructCoverage: normalizeJsonObject(row.constructCoverage),
    taskTypeCoverage: normalizeJsonObject(row.taskTypeCoverage),
    path,
    decisionLog: normalizeJsonArray(row.decisionLog),
    resultSummary: row.resultSummary || null,
    stopReason: row.stopReason,
    progress: {
      completedCount: path.length,
      minTasks: row.minTasks,
      maxTasks: row.maxTasks,
      requiredConstructsCovered: hasRequiredConstructCoverage(row.constructCoverage),
      canStop: adaptiveCanStop(row).stop,
    },
    nextTask,
    decision,
  };
}

async function createAdaptiveSession(body = {}) {
  await ensureSeedTasks();
  const clientSessionId = String(body.clientSessionId || '').trim();
  if (!CLIENT_SESSION_RE.test(clientSessionId)) {
    const err = new Error('clientSessionId 格式不正確');
    err.status = 400;
    err.code = 'INVALID_CLIENT_SESSION_ID';
    throw err;
  }
  const initialLevel = normalizeAdaptiveLevel(body.initialLevel || body.level || 'B1');
  const minTasks = normalizeAdaptiveTaskLimit(body.minTasks, ADAPTIVE_DEFAULTS.minTasks, { min: 3, max: 8 });
  const maxTasks = normalizeAdaptiveTaskLimit(body.maxTasks, ADAPTIVE_DEFAULTS.maxTasks, { min: minTasks, max: 12 });
  const row = await SpeakingAdaptiveSession.create({
    sessionUid: uuidv4(),
    clientSessionId,
    studentId: normalizeStudentId(body.studentId),
    status: 'active',
    startedAt: new Date(),
    initialLevel,
    currentLevel: initialLevel,
    currentAbility: levelToAbility(initialLevel),
    standardError: null,
    minTasks,
    maxTasks,
    completedTaskKeys: [],
    constructCoverage: emptyCoverage(ADAPTIVE_REQUIRED_CONSTRUCTS),
    taskTypeCoverage: emptyCoverage(ADAPTIVE_TASK_TYPE_SEQUENCE),
    path: [],
    decisionLog: [{ type: 'session_started', at: new Date().toISOString(), initialLevel, minTasks, maxTasks }],
    resultSummary: null,
  });
  return getAdaptiveSession(row.sessionUid, { includeNextTask: true });
}

async function getAdaptiveSession(sessionUid, options = {}) {
  const row = await SpeakingAdaptiveSession.findOne({ where: { sessionUid } });
  if (!row) {
    const err = new Error('找不到 adaptive speaking session');
    err.status = 404;
    err.code = 'ADAPTIVE_SESSION_NOT_FOUND';
    throw err;
  }
  if (!options.includeNextTask || row.status !== 'active') return toAdaptiveSessionDto(row);
  const next = await getAdaptiveNextTask(sessionUid);
  return toAdaptiveSessionDto(row, next.task, next.decision);
}

function chooseNeededTaskType(session) {
  const coverage = normalizeJsonObject(session.taskTypeCoverage);
  const path = normalizeJsonArray(session.path);
  if (!path.length) return 'read_aloud';
  const missing = ADAPTIVE_TASK_TYPE_SEQUENCE.find((type) => !Number(coverage[type]));
  if (missing) return missing;
  return ADAPTIVE_TASK_TYPE_SEQUENCE
    .slice()
    .sort((a, b) => (Number(coverage[a]) || 0) - (Number(coverage[b]) || 0))[0];
}

function chooseAdaptiveTaskFromRows(rows, { targetLevel, preferredTaskType, completed }) {
  const sameType = rows.filter((task) => task.taskType === preferredTaskType && !completed.has(task.taskKey));
  const sameLevel = sameType.filter((task) => task.level === targetLevel);
  const adjacent = sameType.filter((task) => Math.abs(levelToAbility(task.level) - levelToAbility(targetLevel)) <= 1);
  return sameLevel[0] || adjacent[0] || sameType[0] || rows.find((task) => !completed.has(task.taskKey)) || rows[0] || null;
}

async function getAdaptiveNextTask(sessionUid) {
  await ensureSeedTasks();
  const session = await SpeakingAdaptiveSession.findOne({ where: { sessionUid } });
  if (!session) {
    const err = new Error('找不到 adaptive speaking session');
    err.status = 404;
    err.code = 'ADAPTIVE_SESSION_NOT_FOUND';
    throw err;
  }
  const stopCheck = adaptiveCanStop(session);
  if (session.status !== 'active' || stopCheck.stop) {
    return { task: null, decision: { action: 'stop', reason: session.stopReason || stopCheck.reason } };
  }
  const rows = await SpeakingTask.findAll({
    where: { isActive: true },
    order: [['level', 'ASC'], ['id', 'ASC']],
  });
  const completed = new Set(normalizeJsonArray(session.completedTaskKeys).map(String));
  const targetLevel = abilityToLevel(session.currentAbility);
  const preferredTaskType = chooseNeededTaskType(session);
  const selected = chooseAdaptiveTaskFromRows(rows, { targetLevel, preferredTaskType, completed });
  const decision = {
    action: 'administer_next_task',
    targetLevel,
    preferredTaskType,
    currentAbility: session.currentAbility,
    standardError: session.standardError,
    completedCount: normalizeJsonArray(session.path).length,
    stopCheck: stopCheck.reason,
    rule: 'Select an uncompleted task matching the current ability level and the least-covered required task type; stop after minimum tasks once construct coverage and precision are sufficient.',
  };
  return { task: selected ? toTaskDto(selected) : null, decision };
}

function buildAdaptiveResultSummary(session) {
  const path = normalizeJsonArray(session.path);
  const scores = path.map((item) => Number(item.overallPercent)).filter(Number.isFinite);
  return {
    estimatedLevel: session.currentLevel,
    ability: session.currentAbility,
    standardError: session.standardError,
    completedCount: path.length,
    averageOverallPercent: scores.length ? Number(mean(scores).toFixed(2)) : null,
    constructCoverage: normalizeJsonObject(session.constructCoverage),
    taskTypeCoverage: normalizeJsonObject(session.taskTypeCoverage),
    caution: 'Adaptive result is a pilot diagnostic estimate. It needs human-rating calibration before use as a formal CEFR score.',
  };
}

async function updateAdaptiveSessionAfterAttempt({ sessionUid, task, attempt, presentationScores }) {
  if (!sessionUid) return null;
  const session = await SpeakingAdaptiveSession.findOne({ where: { sessionUid } });
  if (!session) {
    const err = new Error('找不到 adaptive speaking session');
    err.status = 404;
    err.code = 'ADAPTIVE_SESSION_NOT_FOUND';
    throw err;
  }
  if (session.status !== 'active') return toAdaptiveSessionDto(session);

  const path = normalizeJsonArray(session.path);
  const completedTaskKeys = new Set(normalizeJsonArray(session.completedTaskKeys).map(String));
  completedTaskKeys.add(task.taskKey);
  const constructCoverage = { ...emptyCoverage(ADAPTIVE_REQUIRED_CONSTRUCTS), ...normalizeJsonObject(session.constructCoverage) };
  (task.constructTags || []).forEach((tag) => {
    if (constructCoverage[tag] != null) constructCoverage[tag] += 1;
  });
  const taskTypeCoverage = { ...emptyCoverage(ADAPTIVE_TASK_TYPE_SEQUENCE), ...normalizeJsonObject(session.taskTypeCoverage) };
  taskTypeCoverage[task.taskType] = (Number(taskTypeCoverage[task.taskType]) || 0) + 1;

  const observationAbility = scoreToObservationAbility(task, presentationScores);
  const ability = summarizeAdaptiveAbility({
    previousAbility: session.currentAbility,
    previousCount: path.length,
    observationAbility,
  });
  const nextPath = [
    ...path,
    {
      attemptUid: attempt.attemptUid,
      taskKey: task.taskKey,
      level: task.level,
      taskType: task.taskType,
      overallPercent: presentationScores?.overallPercent ?? null,
      observationAbility,
      abilityAfter: ability.ability,
      submittedAt: attempt.submittedAt,
    },
  ];
  const decisionLog = normalizeJsonArray(session.decisionLog);
  decisionLog.push({
    type: 'attempt_scored',
    at: new Date().toISOString(),
    attemptUid: attempt.attemptUid,
    taskKey: task.taskKey,
    observationAbility,
    abilityAfter: ability.ability,
    standardError: ability.standardError,
  });

  await session.update({
    currentAbility: ability.ability,
    currentLevel: ability.level,
    standardError: ability.standardError,
    completedTaskKeys: Array.from(completedTaskKeys),
    constructCoverage,
    taskTypeCoverage,
    path: nextPath,
    decisionLog,
  });

  const stopCheck = adaptiveCanStop(session);
  if (stopCheck.stop) {
    decisionLog.push({ type: 'session_stopped', at: new Date().toISOString(), reason: stopCheck.reason });
    await session.update({
      status: 'completed',
      completedAt: new Date(),
      stopReason: stopCheck.reason,
      decisionLog,
      resultSummary: buildAdaptiveResultSummary(session),
    });
  }
  const next = session.status === 'active' ? await getAdaptiveNextTask(session.sessionUid) : { task: null, decision: { action: 'stop', reason: session.stopReason } };
  return toAdaptiveSessionDto(session, next.task, next.decision);
}

async function listSpeakingTasks(query = {}) {
  await ensureSeedTasks();
  const where = { isActive: true };
  const level = String(query.level || '').trim().toUpperCase();
  if (CEFR_RANK[level]) where.level = level;
  const taskType = String(query.taskType || '').trim();
  if (taskType) where.taskType = taskType;
  const rows = await SpeakingTask.findAll({
    where,
    order: [['level', 'ASC'], ['id', 'ASC']],
  });
  return {
    tasks: rows.map(toTaskDto),
    constructVersion: 'v0',
    caution: 'Speaking diagnostic tasks provide controlled and constructed-response evidence, not full speaking proficiency certification.',
  };
}

async function getNextSpeakingTask(query = {}) {
  await ensureSeedTasks();
  const completed = normalizeCompletedTaskKeys(query.completedTaskKeys || query.completed);
  const currentLevel = String(query.currentLevel || query.level || 'A2').toUpperCase();
  const targetLevel = chooseAdaptiveLevel({
    currentLevel,
    previousOverallPercent: query.previousOverallPercent || query.overallPercent,
  });
  const taskType = String(query.taskType || query.currentTaskType || '').trim();
  const where = { isActive: true };
  if (taskType) where.taskType = taskType;
  const rows = await SpeakingTask.findAll({
    where,
    order: [['level', 'ASC'], ['id', 'ASC']],
  });
  const candidates = rows.filter((task) => task.level === targetLevel && !completed.has(task.taskKey));
  const fallback = rows.filter((task) => !completed.has(task.taskKey));
  const selected = candidates[0] || fallback[0] || rows[0] || null;
  return {
    task: selected ? toTaskDto(selected) : null,
    decision: {
      currentLevel,
      targetLevel,
      previousOverallPercent: clampNumber(query.previousOverallPercent || query.overallPercent, { min: 0, max: 100 }),
      completedCount: completed.size,
      rule: '>=82 promote one level; <=52 lower one level; otherwise stay at current level.',
    },
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
  const adaptiveSessionUid = String(body.adaptiveSessionUid || '').trim() || null;
  if (adaptiveSessionUid) {
    const adaptiveSession = await SpeakingAdaptiveSession.findOne({ where: { sessionUid: adaptiveSessionUid } });
    if (!adaptiveSession) {
      const err = new Error('找不到 adaptive speaking session');
      err.status = 404;
      err.code = 'ADAPTIVE_SESSION_NOT_FOUND';
      throw err;
    }
    if (adaptiveSession.status !== 'active') {
      const err = new Error('此 adaptive speaking session 已結束');
      err.status = 400;
      err.code = 'ADAPTIVE_SESSION_CLOSED';
      throw err;
    }
  }
  const clientFeatures = parseClientFeatures(body.clientFeatures);
  const attemptUid = uuidv4();
  const alignment = task.taskType === 'read_aloud'
    ? await alignSpeakingAttempt({
      audioPath: file.path,
      targetText: task.targetText,
      transcript,
      durationMs,
      attemptUid,
    })
    : {
      status: 'not_applicable',
      engine: 'constructed_response_v0',
      words: [],
      phones: [],
      metrics: {},
      warnings: ['Forced alignment is skipped for constructed-response tasks.'],
    };
  const { features, automatedScores, presentationScores, wordResults } = buildAutomatedAnalysis({
    task,
    transcript,
    durationMs,
    clientFeatures,
    alignment,
  });

  const row = await SpeakingAttempt.create({
    attemptUid,
    taskId: task.id,
    studentId: normalizeStudentId(body.studentId),
    clientSessionId,
    adaptiveSessionUid,
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

  const adaptiveSession = await updateAdaptiveSessionAfterAttempt({
    sessionUid: adaptiveSessionUid,
    task,
    attempt: row,
    presentationScores,
  });

  return {
    attemptUid: row.attemptUid,
    task: toTaskDto(task),
    features,
    automatedScores,
    presentationScores,
    wordResults,
    alignment,
    adaptiveSession,
    audioUrl: `/${row.audioPath}`,
    nextStep: 'Teacher rubric rating and ASR/forced-alignment integration can be added on this attempt record.',
  };
}

function normalizeRatingValue(value, field) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    const err = new Error(`${field} 必須為 1-5 的整數`);
    err.status = 400;
    err.code = 'INVALID_RATING_VALUE';
    throw err;
  }
  return n;
}

async function rateSpeakingAttempt(attemptUid, body = {}, user = {}) {
  const attempt = await SpeakingAttempt.findOne({ where: { attemptUid } });
  if (!attempt) {
    const err = new Error('找不到口說紀錄');
    err.status = 404;
    err.code = 'ATTEMPT_NOT_FOUND';
    throw err;
  }
  const payload = {
    attemptId: attempt.id,
    raterUserId: user?.id || null,
    fluency: normalizeRatingValue(body.fluency, 'fluency'),
    pronunciationIntelligibility: normalizeRatingValue(body.pronunciationIntelligibility, 'pronunciationIntelligibility'),
    grammar: normalizeRatingValue(body.grammar, 'grammar'),
    vocabulary: normalizeRatingValue(body.vocabulary, 'vocabulary'),
    taskAchievement: normalizeRatingValue(body.taskAchievement, 'taskAchievement'),
    comments: String(body.comments || '').trim().slice(0, 4000) || null,
    rubricVersion: 'v0',
  };
  const existing = await SpeakingHumanRating.findOne({
    where: { attemptId: attempt.id, raterUserId: payload.raterUserId },
  });
  const row = existing ? await existing.update(payload) : await SpeakingHumanRating.create(payload);
  return toRatingDto(row);
}


async function realignSpeakingAttempt(attemptUid) {
  const attempt = await SpeakingAttempt.findOne({
    where: { attemptUid },
    include: [{ model: SpeakingTask, as: 'task' }],
  });
  if (!attempt || !attempt.task) {
    const err = new Error('找不到口說紀錄');
    err.status = 404;
    err.code = 'ATTEMPT_NOT_FOUND';
    throw err;
  }

  const audioPath = path.join(__dirname, '..', attempt.audioPath);
  const alignment = attempt.task.taskType === 'read_aloud'
    ? await alignSpeakingAttempt({
      audioPath,
      targetText: attempt.task.targetText,
      transcript: attempt.transcript,
      durationMs: attempt.durationMs,
      attemptUid: attempt.attemptUid,
    })
    : {
      status: 'not_applicable',
      engine: 'constructed_response_v0',
      words: [],
      phones: [],
      metrics: {},
      warnings: ['Forced alignment is skipped for constructed-response tasks.'],
    };
  const clientFeatures = attempt.features?.clientFeatures || {};
  const { features, automatedScores, presentationScores, wordResults } = buildAutomatedAnalysis({
    task: attempt.task,
    transcript: attempt.transcript,
    durationMs: attempt.durationMs,
    clientFeatures,
    alignment,
  });
  await attempt.update({
    features,
    automatedScores,
    analysisVersion: ANALYSIS_VERSION,
    status: 'aligned',
  });
  return {
    attemptUid: attempt.attemptUid,
    task: toTaskDto(attempt.task),
    features,
    automatedScores,
    presentationScores,
    wordResults,
    alignment,
    audioUrl: `/${attempt.audioPath}`,
  };
}
async function listRecentAttempts(query = {}) {
  const limit = Math.max(1, Math.min(Number(query.limit) || 50, 200));
  const where = {};
  const studentId = normalizeStudentId(query.studentId);
  if (studentId) where.studentId = studentId;
  const rows = await SpeakingAttempt.findAll({
    where,
    include: [
      { model: SpeakingTask, as: 'task' },
      { model: SpeakingHumanRating, as: 'humanRatings' },
    ],
    order: [['submittedAt', 'DESC']],
    limit: Math.max(limit, 200),
  });
  const status = String(query.ratingStatus || '').trim();
  const mapped = rows.map(toAttemptDto).filter((row) => !status || row.ratingStatus === status);
  return mapped.slice(0, limit);
}

function summarizeReliability(rows) {
  const doubleRated = rows.filter((row) => ratingCount(row) >= 2);
  const byField = {};
  RATING_FIELDS.forEach((field) => {
    const pairs = doubleRated
      .map((row) => [row.humanRatings[0]?.[field], row.humanRatings[1]?.[field]])
      .filter(([a, b]) => Number.isFinite(Number(a)) && Number.isFinite(Number(b)))
      .map(([a, b]) => [Number(a), Number(b)]);
    const diffs = pairs.map(([a, b]) => Math.abs(a - b));
    byField[field] = {
      pairCount: pairs.length,
      exactAgreement: pairs.length ? Number((pairs.filter(([a, b]) => a === b).length / pairs.length).toFixed(4)) : null,
      adjacentAgreement: pairs.length ? Number((pairs.filter(([a, b]) => Math.abs(a - b) <= 1).length / pairs.length).toFixed(4)) : null,
      meanAbsoluteDifference: diffs.length ? Number(mean(diffs).toFixed(3)) : null,
      pearsonR: pearson(pairs),
    };
  });
  return { doubleRatedAttempts: doubleRated.length, byField };
}

function summarizeFeatureCorrelations(rows) {
  const rated = rows.map((row) => ({ row, humanMean: meanOverallHumanRating(row.humanRatings || []) }))
    .filter(({ humanMean }) => Number.isFinite(humanMean));
  const features = [
    ['speechRateWpm', (row) => row.features?.speechRateWpm],
    ['articulationRateWpm', (row) => row.features?.articulationRateWpm],
    ['pauseCount', (row) => row.features?.pauseCount],
    ['averagePauseDurationMs', (row) => row.features?.averagePauseDurationMs],
    ['completionPercent', (row) => row.automatedScores?.presentationScores?.completionPercent],
    ['fluencyPercent', (row) => row.automatedScores?.presentationScores?.fluencyPercent],
    ['overallPercent', (row) => row.automatedScores?.presentationScores?.overallPercent],
  ];
  return Object.fromEntries(features.map(([key, pick]) => {
    const usable = rated.filter(({ row, humanMean }) => Number.isFinite(Number(pick(row))) && Number.isFinite(humanMean));
    return [key, { n: usable.length, pearsonR: pearson(usable.map(({ row, humanMean }) => [pick(row), humanMean])) }];
  }));
}

async function getSpeakingResearchSummary(query = {}) {
  const limit = Math.max(1, Math.min(Number(query.limit) || 1000, 5000));
  const rows = await SpeakingAttempt.findAll({
    include: [
      { model: SpeakingTask, as: 'task' },
      { model: SpeakingHumanRating, as: 'humanRatings' },
    ],
    order: [['submittedAt', 'DESC']],
    limit,
  });
  const students = new Set(rows.map((row) => row.studentId).filter(Boolean));
  const statusCounts = rows.reduce((acc, row) => {
    const status = ratingStatus(row);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { unrated: 0, single_rated: 0, double_rated: 0 });
  const taskCounts = rows.reduce((acc, row) => {
    const key = row.task?.taskKey || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    sample: {
      attempts: rows.length,
      students: students.size,
      averageAttemptsPerStudent: students.size ? Number((rows.length / students.size).toFixed(2)) : null,
      ratingStatusCounts: statusCounts,
      taskCounts,
    },
    reliability: summarizeReliability(rows),
    featureCorrelations: summarizeFeatureCorrelations(rows),
    notes: [
      'Reliability uses the first two ratings per attempt and reports exact/adjacent agreement plus Pearson r as an early diagnostic.',
      'Feature correlations are exploratory and should not be treated as a calibrated scoring model until the pilot sample is large enough.',
    ],
  };
}

function csvValue(value) {
  if (value == null) return '';
  const text = String(value).replace(/[\r\n]+/g, ' ').trim();
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
function csvLine(values) {
  return values.map(csvValue).join(',');
}

function ratingColumn(ratings, index, field) {
  return ratings?.[index]?.[field] ?? '';
}

async function exportSpeakingResearchCsv(query = {}) {
  const limit = Math.max(1, Math.min(Number(query.limit) || 5000, 10000));
  const rows = await SpeakingAttempt.findAll({
    include: [
      { model: SpeakingTask, as: 'task' },
      { model: SpeakingHumanRating, as: 'humanRatings' },
    ],
    order: [['submittedAt', 'DESC']],
    limit,
  });
  const status = String(query.ratingStatus || '').trim();
  const attempts = rows.map(toAttemptDto).filter((row) => !status || row.ratingStatus === status);
  const headers = [
    'attempt_uid', 'student_id', 'submitted_at', 'task_key', 'level', 'task_type', 'task_title',
    'rating_status', 'rating_count', 'human_rating_mean',
    'duration_ms', 'transcript_word_count', 'target_word_count',
    'speech_rate_wpm', 'articulation_rate_wpm', 'pause_count', 'pause_frequency_per_minute',
    'average_pause_ms', 'total_pause_ms', 'completion_rate', 'transcript_completion_rate',
    'alignment_completion_rate', 'transcript_similarity',
    'completion_percent', 'fluency_percent', 'pace_percent', 'pause_control_percent', 'overall_percent',
    'alignment_status', 'alignment_engine', 'aligned_word_count', 'aligned_speech_ms',
    'lexical_diversity', 'lexical_sophistication', 'avg_word_length', 'filler_count', 'repair_marker_count',
    'repetition_count', 'discourse_marker_count', 'subordinator_count', 'mean_words_per_sentence',
    'grammar_control_proxy', 'coherence_proxy',
    'r1_fluency', 'r1_pronunciation_intelligibility', 'r1_grammar', 'r1_vocabulary', 'r1_task_achievement',
    'r2_fluency', 'r2_pronunciation_intelligibility', 'r2_grammar', 'r2_vocabulary', 'r2_task_achievement',
    'transcript',
  ];
  const lines = [csvLine(headers)];
  attempts.forEach((row) => {
    const features = row.features || {};
    const scores = row.automatedScores?.presentationScores || {};
    const alignment = row.alignment || {};
    const ratings = row.humanRatings || [];
    lines.push(csvLine([
      row.attemptUid,
      row.studentId,
      row.submittedAt ? new Date(row.submittedAt).toISOString() : '',
      row.task?.taskKey,
      row.task?.level,
      row.task?.taskType,
      row.task?.title,
      row.ratingStatus,
      row.ratingCount,
      row.humanRatingMean != null ? Number(row.humanRatingMean).toFixed(3) : '',
      row.durationMs,
      features.transcriptWordCount,
      features.targetWordCount,
      features.speechRateWpm,
      features.articulationRateWpm,
      features.pauseCount,
      features.pauseFrequencyPerMinute,
      features.averagePauseDurationMs,
      features.totalPauseMs,
      features.completionRate,
      features.transcriptCompletionRate,
      features.alignmentCompletionRate,
      features.transcriptSimilarity,
      scores.completionPercent,
      scores.fluencyPercent,
      scores.pacePercent,
      scores.pauseControlPercent,
      scores.overallPercent,
      alignment.status,
      alignment.engine,
      alignment.metrics?.alignedWordCount ?? alignment.words?.length,
      alignment.metrics?.speechMs,
      features.transcriptEvidence?.lexicalDiversity,
      features.transcriptEvidence?.lexicalSophistication,
      features.transcriptEvidence?.averageWordLength,
      features.transcriptEvidence?.fillerCount,
      features.transcriptEvidence?.repairMarkerCount,
      features.transcriptEvidence?.repetitionCount,
      features.transcriptEvidence?.discourseMarkerCount,
      features.transcriptEvidence?.subordinatorCount,
      features.transcriptEvidence?.meanWordsPerSentence,
      features.transcriptEvidence?.grammarControlProxy,
      features.transcriptEvidence?.coherenceProxy,
      ratingColumn(ratings, 0, 'fluency'),
      ratingColumn(ratings, 0, 'pronunciationIntelligibility'),
      ratingColumn(ratings, 0, 'grammar'),
      ratingColumn(ratings, 0, 'vocabulary'),
      ratingColumn(ratings, 0, 'taskAchievement'),
      ratingColumn(ratings, 1, 'fluency'),
      ratingColumn(ratings, 1, 'pronunciationIntelligibility'),
      ratingColumn(ratings, 1, 'grammar'),
      ratingColumn(ratings, 1, 'vocabulary'),
      ratingColumn(ratings, 1, 'taskAchievement'),
      row.transcript,
    ]));
  });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return {
    filename: `speaking-diagnostic-research-${stamp}.csv`,
    contentType: 'text/csv; charset=utf-8',
    body: `﻿${lines.join('\n')}`,
  };
}

module.exports = {
  ANALYSIS_VERSION,
  buildAutomatedAnalysis,
  createAdaptiveSession,
  getAdaptiveSession,
  getAdaptiveNextTask,
  listSpeakingTasks,
  getNextSpeakingTask,
  submitSpeakingAttempt,
  listRecentAttempts,
  rateSpeakingAttempt,
  realignSpeakingAttempt,
  getSpeakingResearchSummary,
  exportSpeakingResearchCsv,
  normalizeText,
  tokenize,
};
