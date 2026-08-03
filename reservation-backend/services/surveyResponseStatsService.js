'use strict';

const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Survey, SurveyVersion, SurveyModuleResponse } = require('../models');
const { mergeWhereWithScope } = require('./accessControl/surveyScopeGuard');
const { applyResponseListFilters } = require('./surveyCenterService');

const GRADE_BUCKETS = ['一年級', '二年級', '高年級(大三以上含碩博士)'];
const GRADE_OTHER = '其他/未填寫';

function loadSurveyJsonByKey(surveyKey) {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'surveys.json'), 'utf8');
    const cfg = JSON.parse(raw);
    return (cfg.surveys || []).find((s) => s.id === surveyKey) || null;
  } catch (_) {
    return null;
  }
}

function normalizeGradeBucket(raw) {
  const v = String(raw || '').trim();
  if (!v) return GRADE_OTHER;
  if (v.includes('一年級') || v.includes('大一') || /freshman/i.test(v)) return '一年級';
  if (v.includes('二年級') || v.includes('大二') || /sophomore/i.test(v)) return '二年級';
  if (
    v.includes('高年級') ||
    v.includes('大三') ||
    v.includes('大四') ||
    v.includes('碩') ||
    v.includes('博') ||
    /junior|senior|postgraduate|graduate/i.test(v)
  ) {
    return '高年級(大三以上含碩博士)';
  }
  return GRADE_OTHER;
}

function extractGradeValue(answers) {
  if (!answers || typeof answers !== 'object') return null;
  if (answers.grade != null && String(answers.grade).trim()) return answers.grade;
  if (answers.year != null && String(answers.year).trim()) return answers.year;
  return null;
}

function parseLikertScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return n;
}

async function resolveSurveySchema(surveyRow) {
  if (!surveyRow) return null;
  const surveyKey = surveyRow.surveyKey;
  let schema = null;
  if (surveyRow.currentPublishedVersionId) {
    const ver = await SurveyVersion.findByPk(surveyRow.currentPublishedVersionId).catch(() => null);
    if (ver?.schemaJson) {
      schema = typeof ver.schemaJson === 'string' ? JSON.parse(ver.schemaJson) : ver.schemaJson;
    }
  }
  if (!schema?.questions?.length && surveyKey) {
    schema = loadSurveyJsonByKey(surveyKey);
  }
  return schema;
}

function initGradeCounts() {
  const counts = { [GRADE_OTHER]: 0 };
  GRADE_BUCKETS.forEach((b) => {
    counts[b] = 0;
  });
  return counts;
}

function toPercentages(counts, total) {
  const pct = {};
  Object.keys(counts).forEach((k) => {
    pct[k] = total ? Number(((counts[k] / total) * 100).toFixed(1)) : 0;
  });
  return pct;
}

function aggregateQuestionStats(rows, schema) {
  const likertFromSchema = (schema?.questions || [])
    .filter((q) => q.type === 'likert')
    .map((q) => ({ id: q.id, label: q.label || q.id }));

  const likertIds = new Set(likertFromSchema.map((q) => q.id));
  if (!likertIds.size) {
    rows.forEach((r) => {
      const a = r.answersJson || {};
      Object.keys(a).forEach((k) => {
        if (/^q\d+$/i.test(k) && parseLikertScore(a[k]) != null) likertIds.add(k);
      });
    });
  }

  const labelById = new Map(likertFromSchema.map((q) => [q.id, q.label]));
  const accum = new Map();
  likertIds.forEach((id) => {
    accum.set(id, { sum: 0, count: 0, min: 5, max: 1 });
  });

  rows.forEach((r) => {
    const a = r.answersJson || {};
    likertIds.forEach((qid) => {
      const score = parseLikertScore(a[qid]);
      if (score == null) return;
      const slot = accum.get(qid);
      slot.sum += score;
      slot.count += 1;
      slot.min = Math.min(slot.min, score);
      slot.max = Math.max(slot.max, score);
    });
  });

  const questionStats = [...likertIds].map((qid) => {
    const slot = accum.get(qid);
    const average = slot.count ? Number((slot.sum / slot.count).toFixed(2)) : null;
    return {
      questionId: qid,
      label: labelById.get(qid) || qid,
      average,
      count: slot.count,
      min: slot.count ? slot.min : null,
      max: slot.count ? slot.max : null,
    };
  });

  const allScores = [];
  questionStats.forEach((q) => {
    if (q.average != null && q.count) allScores.push(q.average);
  });

  let overallLikertAverage = null;
  if (rows.length) {
    let totalSum = 0;
    let totalCount = 0;
    rows.forEach((r) => {
      const a = r.answersJson || {};
      likertIds.forEach((qid) => {
        const score = parseLikertScore(a[qid]);
        if (score != null) {
          totalSum += score;
          totalCount += 1;
        }
      });
    });
    overallLikertAverage = totalCount ? Number((totalSum / totalCount).toFixed(2)) : null;
  }

  return { questionStats, overallLikertAverage, likertQuestionCount: likertIds.size };
}

function aggregateExtras(rows, schema) {
  const deptCounts = new Map();
  const timesCounts = new Map();
  const yearRawCounts = new Map();
  let withGrade = 0;

  rows.forEach((r) => {
    const a = r.answersJson || {};
    const dept = String(a.department || '').trim();
    if (dept) deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);

    const times = a.times_this_semester ?? a.timesThisSemester;
    if (times != null && String(times).trim()) {
      const t = String(times).trim();
      timesCounts.set(t, (timesCounts.get(t) || 0) + 1);
    }

    if (a.year != null && String(a.year).trim()) {
      const y = String(a.year).trim();
      yearRawCounts.set(y, (yearRawCounts.get(y) || 0) + 1);
    }

    if (extractGradeValue(a)) withGrade += 1;
  });

  const topDepartments = [...deptCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const timesThisSemester = Object.fromEntries(timesCounts);
  const yearDistribution = Object.fromEntries(yearRawCounts);

  const submittedDates = rows
    .map((r) => r.submittedAt)
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => Number.isFinite(d.getTime()));

  return {
    topDepartments,
    timesThisSemester: Object.keys(timesThisSemester).length ? timesThisSemester : null,
    yearDistribution: Object.keys(yearDistribution).length ? yearDistribution : null,
    withGradeField: withGrade,
    distinctStudents: new Set(rows.map((r) => String(r.studentId || '').trim()).filter(Boolean)).size,
    submittedAtRange:
      submittedDates.length > 0
        ? {
            first: new Date(Math.min(...submittedDates.map((d) => d.getTime()))).toISOString(),
            last: new Date(Math.max(...submittedDates.map((d) => d.getTime()))).toISOString(),
          }
        : null,
    surveyType: schema?.surveyType || null,
  };
}

async function aggregateSurveyGroup(rows, surveyRow) {
  const schema = await resolveSurveySchema(surveyRow);
  const gradeCounts = initGradeCounts();
  rows.forEach((r) => {
    const bucket = normalizeGradeBucket(extractGradeValue(r.answersJson));
    gradeCounts[bucket] = (gradeCounts[bucket] || 0) + 1;
  });
  const total = rows.length;
  const { questionStats, overallLikertAverage, likertQuestionCount } = aggregateQuestionStats(rows, schema);
  const extras = aggregateExtras(rows, schema);

  return {
    survey: surveyRow
      ? {
          id: surveyRow.id,
          surveyKey: surveyRow.surveyKey,
          title: surveyRow.title || surveyRow.name,
        }
      : null,
    totalResponses: total,
    gradeDistribution: gradeCounts,
    gradeDistributionPercent: toPercentages(gradeCounts, total),
    overallLikertAverage,
    likertScale: { min: 1, max: 5 },
    likertQuestionCount,
    questionStats,
    extras,
  };
}

/**
 * 基本統計（從 answersJson 彙整，支援 legacy 同步資料）
 */
async function getResponseBasicStats(query = {}) {
  const baseWhere = await applyResponseListFilters(query);
  const scopedWhere = mergeWhereWithScope(baseWhere, query.__scopeWhere);

  const rows = await SurveyModuleResponse.findAll({
    where: scopedWhere,
    attributes: ['id', 'surveyId', 'studentId', 'studentName', 'submittedAt', 'answersJson', 'semester'],
    include: [{ model: Survey, attributes: ['id', 'surveyKey', 'title', 'name', 'currentPublishedVersionId'], required: false }],
    order: [['submittedAt', 'DESC']],
  });

  const bySurvey = new Map();
  rows.forEach((r) => {
    const sid = r.surveyId || 0;
    if (!bySurvey.has(sid)) bySurvey.set(sid, []);
    bySurvey.get(sid).push(r);
  });

  const groups = [];
  for (const [sid, groupRows] of bySurvey.entries()) {
    const surveyRow = groupRows[0]?.Survey || (sid ? await Survey.findByPk(sid) : null);
    groups.push(await aggregateSurveyGroup(groupRows, surveyRow));
  }

  const combinedGrade = initGradeCounts();
  groups.forEach((g) => {
    Object.entries(g.gradeDistribution || {}).forEach(([k, v]) => {
      combinedGrade[k] = (combinedGrade[k] || 0) + v;
    });
  });

  return {
    totalResponses: rows.length,
    gradeDistribution: combinedGrade,
    gradeDistributionPercent: toPercentages(combinedGrade, rows.length),
    groups: groups.length > 1 ? groups : undefined,
    primary: groups.length === 1 ? groups[0] : groups[0] || null,
    filters: {
      semesterId: query.semesterId || null,
      surveyId: query.surveyId || null,
      activityType: query.activityType || null,
      versionId: query.versionId || null,
    },
  };
}

module.exports = {
  getResponseBasicStats,
  parseLikertScore,
  aggregateQuestionStats,
  resolveSurveySchema,
  normalizeGradeBucket,
  GRADE_BUCKETS,
  GRADE_OTHER,
};
