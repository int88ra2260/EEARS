'use strict';

/**
 * 學生探索用的前後測快照。
 * 前測＝第一梯有效英檢（pre_test，含只有一次的 single）。後測＝第二梯（post_test）。學測不算。
 * CEFR 優先用測驗紀錄上的等級。GSE 只用既有原始分或等級對照，不用 CEFR 中位數充當成績。
 * 名單上的 GSE 是該梯可換算技能的平均。0 與 1 是缺考占位，不換算、不計差距。
 */

const { inferGse, gseToCefr } = require('./gseScoreMappingService');
const { isPlaceholderSkillScore, isUsableSkillRawScore } = require('../learningJourney/utils/usableSkillScore');

const SKILLS = Object.freeze(['listening', 'reading', 'speaking', 'writing']);
const PRE_TEST_PHASES = new Set(['pre_test', 'single']);
const POST_TEST_PHASES = new Set(['post_test']);

function flagged(value) {
  return value === true || value === 1 || value === '1';
}

function round1(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function normalizeSkill(skill) {
  const key = String(skill || '').trim().toLowerCase();
  return SKILLS.includes(key) ? key : null;
}

function isGsat(instrument) {
  return String(instrument || '').trim().toUpperCase() === 'GSAT';
}

function emptySummary() {
  return {
    gse: null,
    cefr: null,
    cefrSource: null,
    mixedCefr: false,
    instrument: null,
    mixedInstrument: false,
    examDate: null,
    skillCount: 0,
    mappedSkillCount: 0,
  };
}

function isIncludedExam(exam) {
  if (!exam || flagged(exam.excludeFlag) || flagged(exam.registeredNoScoreFlag)) return false;
  if (isGsat(exam.instrument)) return false;
  const phase = String(exam.testPhase || '').trim();
  if (!PRE_TEST_PHASES.has(phase) && !POST_TEST_PHASES.has(phase)) return false;
  return normalizeSkill(exam.skill) != null;
}

function toCell(exam) {
  const raw = exam.rawScore == null || exam.rawScore === '' ? null : Number(exam.rawScore);
  const rawScore = Number.isFinite(raw) ? raw : null;
  const invalidScore = isPlaceholderSkillScore(rawScore);
  const usable = isUsableSkillRawScore(rawScore);
  let gse = null;
  let mappingType = null;
  if (usable) {
    const mapped = inferGse({
      examType: exam.instrument,
      skill: exam.skill,
      rawScore,
      cefrLevel: exam.cefrLevel,
      examDate: exam.examDate,
    });
    const measured = mapped?.isMapped
      && (mapped.mappingType === 'score_anchors' || mapped.mappingType === 'level_midpoint')
      && Number.isFinite(mapped.gse);
    if (measured) {
      gse = round1(mapped.gse);
      mappingType = mapped.mappingType;
    }
  }
  return {
    examDate: exam.examDate || null,
    instrument: exam.instrument || null,
    rawScore,
    invalidScore,
    cefr: exam.cefrLevel ? String(exam.cefrLevel) : null,
    gse,
    mappingType,
  };
}

function compareDate(left, right, direction) {
  const leftDate = left.examDate ? String(left.examDate) : '';
  const rightDate = right.examDate ? String(right.examDate) : '';
  if (!leftDate && rightDate) return 1;
  if (leftDate && !rightDate) return -1;
  if (leftDate !== rightDate) {
    return direction === 'earliest'
      ? leftDate.localeCompare(rightDate)
      : rightDate.localeCompare(leftDate);
  }
  const leftRound = Number(left.examRound || 0);
  const rightRound = Number(right.examRound || 0);
  return direction === 'earliest' ? leftRound - rightRound : rightRound - leftRound;
}

function pickExam(rows, direction) {
  if (!rows.length) return null;
  const usable = rows.filter((row) => isUsableSkillRawScore(row.rawScore));
  const pool = usable.length ? usable : rows;
  return pool.slice().sort((left, right) => compareDate(left, right, direction))[0];
}

function sameInstrument(left, right) {
  if (!left?.instrument || !right?.instrument) return false;
  return String(left.instrument).trim().toUpperCase() === String(right.instrument).trim().toUpperCase();
}

function summarize(cells, dateMode) {
  if (!cells.length) return emptySummary();
  const gses = cells.map((cell) => cell.gse).filter((value) => value != null);
  const gse = gses.length
    ? round1(gses.reduce((sum, value) => sum + value, 0) / gses.length)
    : null;
  const cefrs = [...new Set(cells.map((cell) => cell.cefr).filter(Boolean))];
  let cefr = null;
  let cefrSource = null;
  let mixedCefr = false;
  if (cefrs.length === 1) {
    cefr = cefrs[0];
    cefrSource = 'recorded';
  } else if (cefrs.length > 1) {
    mixedCefr = true;
    cefr = gse != null ? gseToCefr(gse) : null;
    cefrSource = cefr ? 'gse_band' : null;
  } else if (gse != null) {
    cefr = gseToCefr(gse);
    cefrSource = 'gse_band';
  }
  const instruments = [...new Set(cells.map((cell) => cell.instrument).filter(Boolean))];
  const dated = cells
    .filter((cell) => cell.examDate)
    .slice()
    .sort((left, right) => String(left.examDate).localeCompare(String(right.examDate)));
  const examDate = dated.length
    ? dated[dateMode === 'latest' ? dated.length - 1 : 0].examDate
    : null;
  return {
    gse,
    cefr,
    cefrSource,
    mixedCefr,
    instrument: instruments.length === 1 ? instruments[0] : null,
    mixedInstrument: instruments.length > 1,
    examDate,
    skillCount: cells.length,
    mappedSkillCount: gses.length,
  };
}

function buildSkill(skill, rows) {
  const matched = rows.filter((row) => normalizeSkill(row.skill) === skill);
  const preExam = pickExam(matched.filter((row) => PRE_TEST_PHASES.has(String(row.testPhase || ''))), 'earliest');
  const postExam = pickExam(matched.filter((row) => POST_TEST_PHASES.has(String(row.testPhase || ''))), 'latest');
  const pre = preExam ? toCell(preExam) : null;
  const post = postExam ? toCell(postExam) : null;
  const comparableInstrument = sameInstrument(pre, post);
  const rawDelta = comparableInstrument
    && pre
    && post
    && !pre.invalidScore
    && !post.invalidScore
    && pre.rawScore != null
    && post.rawScore != null
    ? round1(post.rawScore - pre.rawScore)
    : null;
  const gseDelta = pre?.gse != null && post?.gse != null ? round1(post.gse - pre.gse) : null;
  return {
    skill,
    pre,
    post,
    sameInstrument: comparableInstrument,
    rawDelta,
    gseDelta,
  };
}

function buildStudentPrePost(exams) {
  const rows = (exams || []).filter(isIncludedExam);
  const skills = SKILLS.map((skill) => buildSkill(skill, rows));
  return {
    skills,
    pre: summarize(skills.map((row) => row.pre).filter(Boolean), 'earliest'),
    post: summarize(skills.map((row) => row.post).filter(Boolean), 'latest'),
  };
}

function gseForRecordedExam(exam) {
  if (!exam || flagged(exam.excludeFlag) || flagged(exam.registeredNoScoreFlag) || isGsat(exam.instrument)) {
    return { gse: null, invalidScore: false };
  }
  if (!normalizeSkill(exam.skill)) return { gse: null, invalidScore: false };
  const cell = toCell(exam);
  return { gse: cell.gse, invalidScore: cell.invalidScore };
}

module.exports = {
  SKILLS,
  buildStudentPrePost,
  gseForRecordedExam,
  emptySummary,
};
