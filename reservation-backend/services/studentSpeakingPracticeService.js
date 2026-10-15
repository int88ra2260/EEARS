'use strict';

const { SpeakingAttempt, SpeakingTask } = require('../models');
const { EVENT_TYPES } = require('../constants/eventTypes');
const { buildEnglishTablePracticeNote } = require('./etGrouping/englishTablePracticeNote');

const PRACTICE_DISCLAIMER = '這裡只列出你用同一組學號、姓名與 Email 預約過的 English Table。留下的是練習句子和建議說法，沒有錄音，也不是成績。';
const ATTEMPT_SCAN_LIMIT = 200;
const PUBLIC_ITEM_LIMIT = 40;

function practiceStudentId(value) {
  if (value == null || value === '') return '';
  const trimmed = String(value).trim().toUpperCase();
  if (/^[BMDNIJ]\d{9}$/.test(trimmed) || /^\d{8,10}$/.test(trimmed)) return trimmed;
  return '';
}

function dateKey(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : '';
}

function clip(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function parseFeatures(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function englishTableDates(reservations) {
  const dates = new Set();
  (reservations || []).forEach((row) => {
    if (row?.eventType !== EVENT_TYPES.ENGLISH_TABLE) return;
    const key = dateKey(row.date);
    if (key) dates.add(key);
  });
  return dates;
}

function toPublicAttempt(row) {
  const features = parseFeatures(row?.features);
  const context = features.context && typeof features.context === 'object' ? features.context : {};
  const linked = context.linkedActivity === 'English Table' || context.source === 'english-table';
  if (!linked) return null;
  const activityDate = dateKey(context.activityDate);
  const question = Number.parseInt(String(context.activityQuestionNumber || ''), 10);
  if (!activityDate || !Number.isInteger(question) || question < 1 || question > 20) return null;
  const activityPhase = context.activityPhase === 'post_activity'
    ? 'post_activity'
    : (context.activityPhase === 'pre_activity' ? 'pre_activity' : '');
  if (!activityPhase) return null;

  const prompt = row?.task?.prompt || row?.prompt || '';
  const note = buildEnglishTablePracticeNote(row?.transcript, prompt);
  return {
    attemptUid: String(row.attemptUid || ''),
    activityDate,
    activityPhase,
    questionNumber: String(question),
    heard: clip(row?.transcript, 500),
    say: clip(note.say, 240),
    phraseId: note.phraseId || '',
    cue: clip(note.cue, 180),
    submittedAt: row.submittedAt || null,
  };
}

function keepLatestPair(items) {
  const seen = new Set();
  const kept = [];
  items.forEach((item) => {
    const key = `${item.activityDate}|${item.questionNumber}|${item.activityPhase}`;
    if (seen.has(key)) return;
    seen.add(key);
    kept.push(item);
  });
  return kept.slice(0, PUBLIC_ITEM_LIMIT);
}

function sortForReading(items) {
  return [...items].sort((left, right) => {
    if (left.activityDate !== right.activityDate) return right.activityDate.localeCompare(left.activityDate);
    const questionDelta = Number(left.questionNumber) - Number(right.questionNumber);
    if (questionDelta) return questionDelta;
    if (left.activityPhase === right.activityPhase) return 0;
    return left.activityPhase === 'pre_activity' ? -1 : 1;
  });
}

function latestByQuestion(items) {
  const ordered = [...items].sort((left, right) => {
    const leftTime = new Date(left.submittedAt || 0).getTime();
    const rightTime = new Date(right.submittedAt || 0).getTime();
    return rightTime - leftTime;
  });
  const map = {};
  ordered.forEach((item) => {
    if (!map[item.questionNumber]) map[item.questionNumber] = item;
  });
  return map;
}

async function loadMatchingAttempts(studentId, allowedDates) {
  const id = practiceStudentId(studentId);
  if (!id || !allowedDates.size) return [];
  const rows = await SpeakingAttempt.findAll({
    where: { studentId: id },
    attributes: ['attemptUid', 'transcript', 'submittedAt', 'features'],
    include: [{
      model: SpeakingTask,
      as: 'task',
      attributes: ['prompt'],
      required: false,
    }],
    order: [['submittedAt', 'DESC']],
    limit: ATTEMPT_SCAN_LIMIT,
  });
  return rows
    .map((row) => toPublicAttempt(row.toJSON ? row.toJSON() : row))
    .filter((item) => item && allowedDates.has(item.activityDate));
}

async function listEnglishTablePracticeItems({ studentId, reservations }) {
  const allowedDates = englishTableDates(reservations);
  if (!allowedDates.size) {
    return { items: [], disclaimer: PRACTICE_DISCLAIMER };
  }
  const matched = await loadMatchingAttempts(studentId, allowedDates);
  return {
    items: sortForReading(keepLatestPair(matched)),
    disclaimer: PRACTICE_DISCLAIMER,
  };
}

async function attachEnglishTablePractice(reservations, studentId) {
  const list = Array.isArray(reservations) ? reservations : [];
  const allowedDates = englishTableDates(list);
  if (!allowedDates.size) return list;
  let matched = [];
  try {
    matched = await loadMatchingAttempts(studentId, allowedDates);
  } catch (err) {
    console.error('English Table practice lookup failed:', err.message);
    return list;
  }
  const byDate = new Map();
  matched.forEach((item) => {
    const bucket = byDate.get(item.activityDate) || [];
    bucket.push(item);
    byDate.set(item.activityDate, bucket);
  });
  return list.map((row) => {
    if (row?.eventType !== EVENT_TYPES.ENGLISH_TABLE) return row;
    const bucket = byDate.get(dateKey(row.date)) || [];
    return { ...row, practiceByQuestion: latestByQuestion(bucket) };
  });
}

module.exports = {
  PRACTICE_DISCLAIMER,
  practiceStudentId,
  dateKey,
  englishTableDates,
  toPublicAttempt,
  keepLatestPair,
  sortForReading,
  latestByQuestion,
  listEnglishTablePracticeItems,
  attachEnglishTablePractice,
};
