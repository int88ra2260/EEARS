'use strict';

const path = require('path');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const sequelize = require('../../db');
const { LjAnalyticStudent, LjAnalyticExam } = require('../../models');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const {
  buildInstrumentSessions,
  listInstruments,
  EXAM_SESSION_WINDOW_DAYS,
} = require('../learningJourney/analytics/examSessionService');
const {
  computeAdjustedGrowthEpisodes,
  inferGseScore,
  LVA_VERSION,
} = require('../learningJourney/analytics/lvaAnalyticsService');
const { LVA_CONFIG_DEFAULTS } = require('./learningAnalyticsLvaDefaults');
const { GSE_CEFR_SUMMARY } = require('./gseMappingDefaults');
const { evidenceQualityForStudent } = require('./learningAnalyticsFilterUtils');
const { resolveBaselineCefrBand } = require('./baselineAbilityUtils');
const { formatTimestampForFilename } = require('../../utils/reportExportFilename');

const MAIN_SKILLS = ['listening', 'reading', 'speaking', 'writing'];
const SKILL_LABELS = { listening: '聽力', reading: '閱讀', speaking: '口說', writing: '寫作' };
const SKILL_KEYS = {
  listening: { preScore: 'preListeningScore', postScore: 'postListeningScore', preCefr: 'preListeningCefr', postCefr: 'postListeningCefr', delta: 'deltaListeningScore' },
  reading: { preScore: 'preReadingScore', postScore: 'postReadingScore', preCefr: 'preReadingCefr', postCefr: 'postReadingCefr', delta: 'deltaReadingScore' },
  speaking: { preScore: 'preSpeakingScore', postScore: 'postSpeakingScore', preCefr: 'preSpeakingCefr', postCefr: 'postSpeakingCefr', delta: 'deltaSpeakingScore' },
  writing: { preScore: 'preWritingScore', postScore: 'postWritingScore', preCefr: 'preWritingCefr', postCefr: 'postWritingCefr', delta: 'deltaWritingScore' },
};

function formatCell(value) {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return value;
}

function round2(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return round2(nums.reduce((s, v) => s + v, 0) / nums.length);
}

function pct(n, d) {
  if (!d) return null;
  return round2((n / d) * 100);
}

function tierByActivityCount(c) {
  if (c >= 6) return '高頻（簽到≥6次）';
  if (c >= 1) return '低頻（簽到1~5次）';
  return '無活動簽到';
}

async function loadActivityCounts(studentIds) {
  if (!studentIds.length) return new Map();
  const rows = await sequelize.query(
    `SELECT student_id, COUNT(*) AS c FROM lj_student_events
     WHERE event_type = 'activity_event' AND status = 'valid' AND exclude_flag = 0
       AND student_id IN (:ids)
     GROUP BY student_id`,
    { replacements: { ids: studentIds }, type: sequelize.QueryTypes.SELECT }
  );
  return new Map(rows.map((r) => [r.student_id, Number(r.c)]));
}

async function loadExamsByStudent(snapshotVersion, studentIds) {
  const map = new Map();
  if (!studentIds.length) return map;
  const rows = await LjAnalyticExam.findAll({
    where: {
      snapshotVersion,
      studentId: { [Op.in]: studentIds },
      excludeFlag: false,
      registeredNoScoreFlag: false,
      rawScore: { [Op.ne]: null },
      skill: { [Op.in]: MAIN_SKILLS },
    },
    order: [['studentId', 'ASC'], ['examDate', 'ASC'], ['skill', 'ASC']],
  });
  for (const row of rows) {
    const json = row.toJSON();
    if (!map.has(json.studentId)) map.set(json.studentId, []);
    map.get(json.studentId).push(json);
  }
  return map;
}

/** 跨所有英檢工具，依考試日期排序取梯次（與主管問答 735 人算法一致） */
function toSessionExamRows(examRows) {
  return (examRows || []).map((r) => ({
    instrument: r.instrument,
    skill: r.skill,
    eventDate: r.examDate,
    examDate: r.examDate,
    rawScore: r.rawScore,
    cefrLevel: r.cefrLevel,
    excludeFlag: false,
    status: r.status,
    registeredNoScoreFlag: false,
  }));
}

function buildCrossInstrumentChronologicalSessions(examRows) {
  const normalized = toSessionExamRows(examRows);
  const instruments = listInstruments(normalized);
  const sessions = [];
  for (const instrument of instruments) {
    for (const session of buildInstrumentSessions(normalized, instrument)) {
      sessions.push(session);
    }
  }
  sessions.sort((a, b) => a.sessionStart.localeCompare(b.sessionStart));
  return sessions;
}

function sessionSkillMaps(session) {
  const skills = {};
  const cefrs = {};
  for (const cell of session.cells) {
    if (!MAIN_SKILLS.includes(cell.skill)) continue;
    const ev = cell.event;
    skills[cell.skill] = ev.rawScore != null ? Number(ev.rawScore) : null;
    cefrs[cell.skill] = ev.cefrLevel || null;
  }
  return { skills, cefrs };
}

/**
 * 跨工具第 1、第 2 梯前後測（不含入學分級）；前後測可為不同英檢類型。
 */
function buildCrossInstrumentPrePost(examRows) {
  const sessions = buildCrossInstrumentChronologicalSessions(examRows);
  if (sessions.length < 2) return null;

  const preSession = sessions[0];
  const postSession = sessions[1];
  const preMaps = sessionSkillMaps(preSession);
  const postMaps = sessionSkillMaps(postSession);

  const base = {
    crossSessionCount: sessions.length,
    allInstruments: listInstruments(toSessionExamRows(examRows)).join('、'),
    preTestInstrument: preSession.instrument,
    postTestInstrument: postSession.instrument,
    sameInstrument: preSession.instrument === postSession.instrument,
    preTestDateStart: preSession.sessionStart,
    preTestDateEnd: preSession.sessionEnd,
    postTestDateStart: postSession.sessionStart,
    postTestDateEnd: postSession.sessionEnd,
  };

  for (const skill of MAIN_SKILLS) {
    const cap = skill.charAt(0).toUpperCase() + skill.slice(1);
    const preScore = preMaps.skills[skill] ?? null;
    const postScore = postMaps.skills[skill] ?? null;
    const preCefr = preMaps.cefrs[skill] ?? null;
    const postCefr = postMaps.cefrs[skill] ?? null;
    base[`pre${cap}Score`] = preScore;
    base[`post${cap}Score`] = postScore;
    base[`pre${cap}Cefr`] = preCefr;
    base[`post${cap}Cefr`] = postCefr;
    base[`delta${cap}Score`] = preScore != null && postScore != null
      ? round2(postScore - preScore)
      : null;
    base[`pre${cap}Instrument`] = preScore != null ? preSession.instrument : null;
    base[`post${cap}Instrument`] = postScore != null ? postSession.instrument : null;
  }

  return base;
}

function gseForSkill(instrument, skill, rawScore, cefr, examDate) {
  return inferGseScore({
    instrument,
    skill,
    rawScore,
    examDate,
    cefrLevel: cefr,
  });
}

function buildQuestion1Row(student, prePost, growthByStudentSkill) {
  const row = {
    studentId: student.studentId,
    cohort: student.cohort,
    college: student.college,
    department: student.department,
    crossSessionCount: prePost.crossSessionCount,
    allInstruments: prePost.allInstruments,
    preTestInstrument: prePost.preTestInstrument,
    postTestInstrument: prePost.postTestInstrument,
    sameInstrument: prePost.sameInstrument ? '是' : '否',
    preTestDateStart: prePost.preTestDateStart,
    preTestDateEnd: prePost.preTestDateEnd,
    postTestDateStart: prePost.postTestDateStart,
    postTestDateEnd: prePost.postTestDateEnd,
    evidenceQuality: evidenceQualityForStudent(student),
    baselineCefrBand: resolveBaselineCefrBand(student) || '',
    algorithmVersion: LVA_VERSION,
    gseScale: JSON.stringify(GSE_CEFR_SUMMARY),
    expectedGrowthWeights: JSON.stringify(LVA_CONFIG_DEFAULTS.expectedGrowthWeights),
  };

  const preGseList = [];
  const postGseList = [];
  let improvedSkillCount = 0;
  let retestSkillCount = 0;

  for (const skill of MAIN_SKILLS) {
    const keys = SKILL_KEYS[skill];
    const label = SKILL_LABELS[skill];
    const cap = skill.charAt(0).toUpperCase() + skill.slice(1);
    const preScore = prePost[keys.preScore];
    const postScore = prePost[keys.postScore];
    const preCefr = prePost[keys.preCefr];
    const postCefr = prePost[keys.postCefr];
    const preInstrument = prePost[`pre${cap}Instrument`] || prePost.preTestInstrument;
    const postInstrument = prePost[`post${cap}Instrument`] || prePost.postTestInstrument;
    const preGse = preScore != null
      ? gseForSkill(preInstrument, skill, preScore, preCefr, prePost.preTestDateStart)
      : null;
    const postGse = postScore != null
      ? gseForSkill(postInstrument, skill, postScore, postCefr, prePost.postTestDateStart)
      : null;
    const rawDelta = prePost[keys.delta];
    const gseDelta = preGse != null && postGse != null ? round2(postGse - preGse) : null;

    const growthKey = `${student.studentId}|${skill}|${postInstrument}`;
    const growthSameTool = growthByStudentSkill.get(`${student.studentId}|${skill}`) || {};

    row[`${label}_前測英檢類型`] = preInstrument;
    row[`${label}_後測英檢類型`] = postInstrument;
    row[`${label}_前測原始分`] = preScore;
    row[`${label}_前測CEFR`] = preCefr;
    row[`${label}_前測GSE`] = preGse;
    row[`${label}_後測原始分`] = postScore;
    row[`${label}_後測CEFR`] = postCefr;
    row[`${label}_後測GSE`] = postGse;
    row[`${label}_原始分變化`] = rawDelta;
    row[`${label}_GSE成長`] = gseDelta;
    row[`${label}_預期GSE成長`] = preInstrument === postInstrument ? growthSameTool.expectedGseGrowth ?? null : null;
    row[`${label}_修正GSE成長`] = preInstrument === postInstrument ? growthSameTool.adjustedGseGrowth ?? null : null;
    row[`${label}_是否進步`] = rawDelta != null ? (rawDelta > 0 ? '是' : (rawDelta < 0 ? '否' : '持平')) : (gseDelta != null ? (gseDelta > 0 ? '是' : (gseDelta < 0 ? '否' : '持平')) : '');

    if (preGse != null) preGseList.push(preGse);
    if (postGse != null) postGseList.push(postGse);
    if (rawDelta != null) {
      retestSkillCount += 1;
      if (rawDelta > 0) improvedSkillCount += 1;
    } else if (gseDelta != null) {
      retestSkillCount += 1;
      if (gseDelta > 0) improvedSkillCount += 1;
    }
  }

  row.overallPreGse = preGseList.length ? Math.max(...preGseList) : null;
  row.overallPostGse = postGseList.length ? Math.max(...postGseList) : null;
  row.overallGseGrowth = row.overallPreGse != null && row.overallPostGse != null
    ? round2(row.overallPostGse - row.overallPreGse)
    : null;
  row.improvedSkillCount = retestSkillCount ? improvedSkillCount : null;
  row.retestSkillCount = retestSkillCount || null;
  row.overallImproved = retestSkillCount
    ? (improvedSkillCount > 0 ? '是' : (improvedSkillCount < retestSkillCount ? '否' : '持平'))
    : '';

  const studentGrowths = MAIN_SKILLS
    .map((skill) => growthByStudentSkill.get(`${student.studentId}|${skill}`))
    .filter(Boolean);
  row.avgActualGseGrowth = mean(
    MAIN_SKILLS.map((skill) => {
      const keys = SKILL_KEYS[skill];
      const preScore = prePost[keys.preScore];
      const postScore = prePost[keys.postScore];
      if (preScore == null || postScore == null) return null;
      const cap = skill.charAt(0).toUpperCase() + skill.slice(1);
      const preInst = prePost[`pre${cap}Instrument`] || prePost.preTestInstrument;
      const postInst = prePost[`post${cap}Instrument`] || prePost.postTestInstrument;
      const preGse = gseForSkill(preInst, skill, preScore, prePost[keys.preCefr], prePost.preTestDateStart);
      const postGse = gseForSkill(postInst, skill, postScore, prePost[keys.postCefr], prePost.postTestDateStart);
      return preGse != null && postGse != null ? postGse - preGse : null;
    })
  );
  row.avgAdjustedGseGrowth = mean(studentGrowths.map((g) => g.adjustedGseGrowth));

  return row;
}

function buildGrowthLookup(growthEpisodes) {
  const map = new Map();
  for (const ep of growthEpisodes) {
    map.set(`${ep.studentId}|${ep.skill}`, ep);
  }
  return map;
}

function summarizeTier(students, q1RowsByStudent, retestExams, growthEpisodes, tierLabel) {
  const ids = new Set(students.map((s) => s.studentId));
  const skillRows = retestExams.filter((e) => ids.has(e.studentId) && e.retestFlag && e.deltaRawScore != null);
  const improved = skillRows.filter((e) => e.improvedFlag).length;
  const eps = growthEpisodes.filter((ep) => ids.has(ep.studentId));
  const crossGse = students
    .map((s) => q1RowsByStudent.get(s.studentId)?.overallGseGrowth)
    .filter((v) => v != null);
  const crossImproved = students.filter((s) => {
    const row = q1RowsByStudent.get(s.studentId);
    return row && row.overallImproved === '是';
  }).length;
  return {
    參與分群: tierLabel,
    學生人數: students.length,
    跨工具整體GSE進步率_pct: pct(crossImproved, students.length),
    平均跨工具整體GSE成長: mean(crossGse),
    同工具重測技能列數: skillRows.length,
    同工具分數進步率_pct: pct(improved, skillRows.length),
    平均修正GSE成長_同工具: mean(eps.map((e) => e.adjustedGseGrowth)),
  };
}

function buildQuestion2StudentRow(student, prePost, activityCount, growthEpisodes) {
  const eps = growthEpisodes.filter((ep) => ep.studentId === student.studentId);
  const improvedSkills = MAIN_SKILLS.filter((skill) => {
    const delta = prePost[SKILL_KEYS[skill].delta];
    if (delta != null) return delta > 0;
    const cap = skill.charAt(0).toUpperCase() + skill.slice(1);
    const preScore = prePost[SKILL_KEYS[skill].preScore];
    const postScore = prePost[SKILL_KEYS[skill].postScore];
    if (preScore == null || postScore == null) return false;
    const preInst = prePost[`pre${cap}Instrument`] || prePost.preTestInstrument;
    const postInst = prePost[`post${cap}Instrument`] || prePost.postTestInstrument;
    const preGse = gseForSkill(preInst, skill, preScore, prePost[SKILL_KEYS[skill].preCefr], prePost.preTestDateStart);
    const postGse = gseForSkill(postInst, skill, postScore, prePost[SKILL_KEYS[skill].postCefr], prePost.postTestDateStart);
    return preGse != null && postGse != null && postGse > preGse;
  }).map((skill) => SKILL_LABELS[skill]).join('、');

  const growthLookup = buildGrowthLookup(eps);
  const q1Snippet = buildQuestion1Row(student, prePost, growthLookup);

  return {
    studentId: student.studentId,
    cohort: student.cohort,
    college: student.college,
    department: student.department,
    activityAttendanceCount: activityCount,
    activityTier: tierByActivityCount(activityCount),
    totalActivityHours: round2(student.totalActivityHours),
    exposureLevel: student.exposureLevel || 'none',
    preTestInstrument: prePost.preTestInstrument,
    postTestInstrument: prePost.postTestInstrument,
    sameInstrument: prePost.sameInstrument ? '是' : '否',
    crossSessionCount: prePost.crossSessionCount,
    preTestDate: prePost.preTestDateStart,
    postTestDate: prePost.postTestDateStart,
    improvedSkills: improvedSkills || '',
    overallGseGrowth: q1Snippet.overallGseGrowth,
    avgActualGseGrowth: q1Snippet.avgActualGseGrowth,
    avgAdjustedGseGrowth: q1Snippet.avgAdjustedGseGrowth,
    retestSkillCount: q1Snippet.retestSkillCount,
  };
}

const Q1_COLUMNS = [
  { key: 'studentId', header: '學號', width: 14 },
  { key: 'cohort', header: '入學年度', width: 10 },
  { key: 'college', header: '學院', width: 16 },
  { key: 'department', header: '系所', width: 18 },
  { key: 'allInstruments', header: '曾考英檢類型(全部)', width: 22 },
  { key: 'preTestInstrument', header: '前測英檢類型', width: 14 },
  { key: 'postTestInstrument', header: '後測英檢類型', width: 14 },
  { key: 'sameInstrument', header: '前後測同類型', width: 12 },
  { key: 'crossSessionCount', header: '跨工具梯次總數', width: 12 },
  { key: 'preTestDateStart', header: '前測日期（起）', width: 14 },
  { key: 'preTestDateEnd', header: '前測日期（迄）', width: 14 },
  { key: 'postTestDateStart', header: '後測日期（起）', width: 14 },
  { key: 'postTestDateEnd', header: '後測日期（迄）', width: 14 },
  ...MAIN_SKILLS.flatMap((skill) => {
    const label = SKILL_LABELS[skill];
    return [
      { key: `${label}_前測英檢類型`, header: `${label}前測類型`, width: 12 },
      { key: `${label}_後測英檢類型`, header: `${label}後測類型`, width: 12 },
      { key: `${label}_前測原始分`, header: `${label}前測分`, width: 10 },
      { key: `${label}_前測CEFR`, header: `${label}前測CEFR`, width: 10 },
      { key: `${label}_前測GSE`, header: `${label}前測GSE`, width: 10 },
      { key: `${label}_後測原始分`, header: `${label}後測分`, width: 10 },
      { key: `${label}_後測CEFR`, header: `${label}後測CEFR`, width: 10 },
      { key: `${label}_後測GSE`, header: `${label}後測GSE`, width: 10 },
      { key: `${label}_原始分變化`, header: `${label}分數變化`, width: 10 },
      { key: `${label}_GSE成長`, header: `${label}GSE成長`, width: 10 },
      { key: `${label}_預期GSE成長`, header: `${label}預期成長(同工具)`, width: 14 },
      { key: `${label}_修正GSE成長`, header: `${label}修正成長(同工具)`, width: 14 },
      { key: `${label}_是否進步`, header: `${label}進步`, width: 8 },
    ];
  }),
  { key: 'overallPreGse', header: '整體前測GSE(最高技能)', width: 16 },
  { key: 'overallPostGse', header: '整體後測GSE(最高技能)', width: 16 },
  { key: 'overallGseGrowth', header: '整體GSE成長', width: 12 },
  { key: 'improvedSkillCount', header: '進步技能數', width: 10 },
  { key: 'retestSkillCount', header: '可比較技能數', width: 12 },
  { key: 'overallImproved', header: '至少一項進步', width: 12 },
  { key: 'avgActualGseGrowth', header: '平均實際GSE成長', width: 14 },
  { key: 'avgAdjustedGseGrowth', header: '平均修正GSE成長', width: 14 },
  { key: 'evidenceQuality', header: '資料品質', width: 10 },
  { key: 'baselineCefrBand', header: '起始能力帶(演算法用)', width: 14 },
  { key: 'algorithmVersion', header: '演算法版本', width: 18 },
  { key: 'expectedGrowthWeights', header: '預期成長權重JSON', width: 24 },
  { key: 'gseScale', header: 'GSE對照JSON', width: 24 },
];

const Q2_SUMMARY_KEYS = [
  '參與分群', '學生人數', '跨工具整體GSE進步率_pct', '平均跨工具整體GSE成長',
  '同工具重測技能列數', '同工具分數進步率_pct', '平均修正GSE成長_同工具',
];

const Q2_COLUMNS = [
  { key: 'studentId', header: '學號', width: 14 },
  { key: 'cohort', header: '入學年度', width: 10 },
  { key: 'college', header: '學院', width: 16 },
  { key: 'department', header: '系所', width: 18 },
  { key: 'activityAttendanceCount', header: '活動簽到次數', width: 12 },
  { key: 'activityTier', header: '參與分群', width: 16 },
  { key: 'totalActivityHours', header: '活動時數合計', width: 12 },
  { key: 'exposureLevel', header: '曝光等級', width: 10 },
  { key: 'preTestInstrument', header: '前測英檢類型', width: 14 },
  { key: 'postTestInstrument', header: '後測英檢類型', width: 14 },
  { key: 'sameInstrument', header: '前後測同類型', width: 12 },
  { key: 'crossSessionCount', header: '跨工具梯次總數', width: 12 },
  { key: 'preTestDate', header: '前測日期', width: 12 },
  { key: 'postTestDate', header: '後測日期', width: 12 },
  { key: 'improvedSkills', header: '進步技能', width: 20 },
  { key: 'overallGseGrowth', header: '整體GSE成長', width: 12 },
  { key: 'avgActualGseGrowth', header: '平均實際GSE成長', width: 14 },
  { key: 'avgAdjustedGseGrowth', header: '平均修正GSE成長', width: 14 },
  { key: 'retestSkillCount', header: '可比較技能數', width: 12 },
];

function applyColumns(sheet, columns) {
  sheet.columns = columns.map((col) => ({ header: col.header, key: col.key, width: col.width }));
  sheet.getRow(1).font = { bold: true };
}

function appendDataRows(sheet, columns, items) {
  for (const item of items) {
    const row = {};
    for (const col of columns) row[col.key] = formatCell(item[col.key]);
    sheet.addRow(row);
  }
}

function addAlgorithmNoteSheet(workbook, snapshotVersion, q1Count, q2Count) {
  const sheet = workbook.addWorksheet('算法說明');
  sheet.columns = [{ header: '項目', key: 'k', width: 28 }, { header: '說明', key: 'v', width: 90 }];
  sheet.getRow(1).font = { bold: true };
  const notes = [
    ['分析快照', snapshotVersion],
    ['問題一筆數', `跨所有英檢類型、依日期第 1／第 2 梯，共 ${q1Count} 人（不含入學分級）`],
    ['問題二筆數', `同上母體 ${q2Count} 人，附活動參與分群`],
    ['前測定義', '所有英檢類型中，依考試日期排序之第 1 梯（BESTEP 同學期合併；其他工具 ≤14 天合併）'],
    ['後測定義', '同上排序之第 2 梯；前後測可為不同英檢類型（欄位：前測英檢類型／後測英檢類型）'],
    ['與361人差異', '舊版僅取「主要英檢工具」(優先 BESTEP) 第 1、2 梯，故筆數較少；本版與主管問答 735 人算法一致'],
    ['梯次合併', `BESTEP 同學期合併；其他工具考試日相距 ≤${EXAM_SESSION_WINDOW_DAYS} 天合併`],
    ['GSE', 'Global Scale of English；由 CEFR 或英檢分數對照表換算，供內部分析'],
    ['GSE成長', '後測 GSE − 前測 GSE（同技能）'],
    ['預期GSE成長', '加權平均：全體／同技能／技能+起點帶／技能+系所／技能+資料品質'],
    ['修正GSE成長', '實際 GSE 成長 − 預期 GSE 成長（baseline_adjusted_simplified）'],
    ['活動高頻', 'lj_student_events 活動簽到 ≥6 次'],
    ['活動低頻', '簽到 1~5 次'],
    ['活動無紀錄', '簽到 0 次（約 68% 學生無活動事件串接）'],
    ['因果聲明', '本匯出為觀察性描述統計，不可直接解讀為活動或課程的因果效果'],
    ['個資', '含學號與成績，請依中心個資規範使用，勿外流'],
  ];
  for (const [k, v] of notes) sheet.addRow({ k, v });
}

async function buildManagerExamActivityWorkbook() {
  const snapshotVersion = await resolveLatestSnapshotVersion();

  const students = await LjAnalyticStudent.findAll({
    where: {
      snapshotVersion,
      hasValidExam: true,
      excludeFlagSummary: false,
    },
    order: [['studentId', 'ASC']],
  });

  const studentIds = students.map((s) => s.studentId);
  const studentById = new Map(students.map((s) => [s.studentId, s.toJSON()]));
  const examsByStudent = await loadExamsByStudent(snapshotVersion, studentIds);
  const activityCounts = await loadActivityCounts(studentIds);

  const allExams = [];
  for (const rows of examsByStudent.values()) allExams.push(...rows);
  const retestExams = allExams.filter(
    (e) => !e.excludeFlag && !e.registeredNoScoreFlag && e.retestFlag && e.deltaRawScore != null
      && MAIN_SKILLS.includes(e.skill)
  );
  const growthEpisodes = computeAdjustedGrowthEpisodes(retestExams, studentById);
  const growthLookup = buildGrowthLookup(growthEpisodes);

  const q1Rows = [];
  const q1RowsByStudent = new Map();
  const q2Rows = [];
  const tierBuckets = { high: [], low: [], none: [] };

  for (const student of students) {
    const json = student.toJSON();
    const examRows = examsByStudent.get(json.studentId) || [];
    const prePost = buildCrossInstrumentPrePost(examRows);
    if (!prePost) continue;

    const q1Row = buildQuestion1Row(json, prePost, growthLookup);
    q1Rows.push(q1Row);
    q1RowsByStudent.set(json.studentId, q1Row);
    const actCount = activityCounts.get(json.studentId) || 0;
    q2Rows.push(buildQuestion2StudentRow(json, prePost, actCount, growthEpisodes));

    const tier = actCount >= 6 ? 'high' : actCount >= 1 ? 'low' : 'none';
    tierBuckets[tier].push(json);
  }

  const q2Summary = [
    summarizeTier(tierBuckets.high, q1RowsByStudent, retestExams, growthEpisodes, '高頻（簽到≥6次）'),
    summarizeTier(tierBuckets.low, q1RowsByStudent, retestExams, growthEpisodes, '低頻（簽到1~5次）'),
    summarizeTier(tierBuckets.none, q1RowsByStudent, retestExams, growthEpisodes, '無活動簽到'),
  ];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EEARS Learning Analytics';
  workbook.created = new Date();

  const sheet1 = workbook.addWorksheet('問題一_英檢前後測成長');
  applyColumns(sheet1, Q1_COLUMNS);
  appendDataRows(sheet1, Q1_COLUMNS, q1Rows);

  const sheet2 = workbook.addWorksheet('問題二_活動參與比較');
  sheet2.addRow(['【分群摘要】']);
  sheet2.getRow(1).font = { bold: true };
  sheet2.addRow(Q2_SUMMARY_KEYS);
  sheet2.getRow(2).font = { bold: true };
  for (const summary of q2Summary) {
    sheet2.addRow(Q2_SUMMARY_KEYS.map((k) => formatCell(summary[k])));
  }
  sheet2.addRow([]);
  const rosterHeaderRow = sheet2.rowCount + 1;
  sheet2.addRow(Q2_COLUMNS.map((c) => c.header));
  sheet2.getRow(rosterHeaderRow).font = { bold: true };
  for (const item of q2Rows) {
    sheet2.addRow(Q2_COLUMNS.map((col) => formatCell(item[col.key])));
  }
  Q2_COLUMNS.forEach((col, i) => {
    sheet2.getColumn(i + 1).width = col.width;
  });

  addAlgorithmNoteSheet(workbook, snapshotVersion, q1Rows.length, q2Rows.length);

  const stamp = formatTimestampForFilename();
  const fileName = `EEARS_主管問答_英檢成長與活動比較_${stamp}.xlsx`;

  return {
    workbook,
    fileName,
    snapshotVersion,
    q1RowCount: q1Rows.length,
    q2RowCount: q2Rows.length,
    q2Summary,
  };
}

async function writeManagerExamActivityExport(outputDir) {
  const result = await buildManagerExamActivityWorkbook();
  const dir = outputDir || path.join(__dirname, '..', '..', 'exports');
  const fs = require('fs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, result.fileName);
  await result.workbook.xlsx.writeFile(filePath);
  return { ...result, filePath };
}

module.exports = {
  buildManagerExamActivityWorkbook,
  writeManagerExamActivityExport,
};
