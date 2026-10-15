'use strict';

const { Op } = require('sequelize');
const { SpeakingAttempt } = require('../../models');
const { MIN_GROWTH_SAMPLE } = require('./etExamObservation');
const { isEnglishTablePractice } = require('./etPracticeBrief');

function hasSubstantiveMove(transcript) {
  const lower = String(transcript || '').toLowerCase();
  const reason = /\b(because|since|therefore|that's why|that is why|so that|cuz|cause)\b/.test(lower)
    || /\bso\s+(i|we|they|he|she|it|this|there|the|people|students)\b/.test(lower);
  const example = /\b(for example|for instance|such as|last week|yesterday|once|one time|when i)\b/.test(lower)
    || /\b(example|instance)\b/.test(lower);
  return reason || example;
}

function practicePhase(context) {
  const phase = String(context?.activityPhase || '').toLowerCase();
  if (phase === 'pre' || phase === 'pre_activity' || phase === 'warmup') return 'pre';
  if (phase === 'post' || phase === 'post_activity' || phase === 'review') return 'post';
  return '';
}

function questionKey(context) {
  return String(context?.activityQuestionNumber || '');
}

function pairAttempts(attempts, eventDate) {
  const questions = new Map();
  const rows = [...(attempts || [])].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  rows.forEach((attempt) => {
    if (!isEnglishTablePractice(attempt.features, eventDate)) return;
    const context = attempt.features.context;
    const phase = practicePhase(context);
    if (!phase) return;
    const key = questionKey(context);
    if (!questions.has(key)) questions.set(key, {});
    questions.get(key)[phase] = attempt.transcript || '';
  });
  return [...questions.values()];
}

function summarizeStudentPractice(attempts, eventDate) {
  const pairs = pairAttempts(attempts, eventDate);
  let hasPre = false;
  let hasPair = false;
  let gainedMove = false;
  pairs.forEach((pair) => {
    if (pair.pre) hasPre = true;
    if (pair.pre && pair.post) {
      hasPair = true;
      if (!hasSubstantiveMove(pair.pre) && hasSubstantiveMove(pair.post)) gainedMove = true;
    }
  });
  return {
    hasPre,
    hasPair,
    gainedMove: hasPair ? gainedMove : null,
  };
}

function summarizeEventPracticeCoverage(studentSummaries = []) {
  const preStudentCount = studentSummaries.filter((row) => row.hasPre).length;
  const pairStudentCount = studentSummaries.filter((row) => row.hasPair).length;
  const gained = studentSummaries.filter((row) => row.gainedMove).length;
  const privacySuppressed = pairStudentCount < MIN_GROWTH_SAMPLE;
  return {
    preStudentCount,
    pairStudentCount,
    gainedStudentCount: privacySuppressed ? null : gained,
    privacySuppressed,
  };
}

function describePracticeGain(preTranscript, postTranscript) {
  const gained = !hasSubstantiveMove(preTranscript) && hasSubstantiveMove(postTranscript);
  return {
    gained,
    message: gained
      ? '和你會前那次比，這次多說出了理由或例子。現場可以沿用這句。'
      : '和你會前那次比，這次還沒有多出理由或例子。可以補上句庫裡的 because 或 for example。',
  };
}

function formatPracticeMove(summary) {
  if (!summary?.hasPre && !summary?.hasPair) return '未練';
  if (!summary.hasPair) return '只有會前';
  return summary.gainedMove ? '活動後多了理由或例子' : '活動後還沒多出理由或例子';
}

async function loadEnglishTableAttempts(studentIds) {
  const unique = [...new Set((studentIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!unique.length) return [];
  const chunks = [];
  for (let i = 0; i < unique.length; i += 400) chunks.push(unique.slice(i, i + 400));
  try {
    const groups = await Promise.all(chunks.map((ids) => SpeakingAttempt.findAll({
      where: { studentId: { [Op.in]: ids } },
      attributes: ['studentId', 'transcript', 'submittedAt', 'features'],
      order: [['submittedAt', 'ASC']],
    })));
    return groups.flat();
  } catch (_err) {
    return [];
  }
}

function attemptsByStudent(attempts) {
  const map = new Map();
  attempts.forEach((attempt) => {
    const id = String(attempt.studentId || '').trim();
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(attempt);
  });
  return map;
}

module.exports = {
  hasSubstantiveMove,
  summarizeStudentPractice,
  summarizeEventPracticeCoverage,
  describePracticeGain,
  formatPracticeMove,
  loadEnglishTableAttempts,
  attemptsByStudent,
};
