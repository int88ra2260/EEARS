'use strict';

const {
  isSurveyAnswerMetadataKey,
  resolveSurveyQuestionKeyAlias,
} = require('../services/surveyAnswerKeyRegistry');

const UNFILLED = '未填寫';
const ASSOCIATION_NOTE = '數字來自同一問卷版本。分組平均是該組的量表分數，相關係數是 Spearman 等級相關，表示題目一起偏高或一起偏低。這不是因果。人數少於門檻的格子不顯示數值。';

const ACTIVITY_ORDER = ['ET', 'EC', 'IF', 'JT', 'GENERAL'];

const CONSTRUCT_DEFS = [
  {
    id: 'speaking',
    label: '口說表現',
    keys: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q13'],
    when: (set) => set.has('q13') && set.has('q1'),
  },
  {
    id: 'confidence',
    label: '自信與氣氛',
    keys: ['q7', 'q8', 'q9', 'q16', 'q17'],
    when: (set) => set.has('q17') && set.has('q7'),
  },
  {
    id: 'motivation',
    label: '參與動機',
    keys: ['q10', 'q11', 'q12'],
    when: (set) => set.has('q12') && set.has('q10'),
  },
  {
    id: 'overall',
    label: '總體有益',
    keys: ['q18'],
    when: (set) => set.has('q18') && set.has('q7'),
  },
  {
    id: 'ec_arrangement',
    label: '滿意與安排',
    keys: ['q1', 'q2', 'q3'],
    when: (set) => set.has('q8') && set.has('q10') && set.has('q1') && !set.has('q11') && !set.has('q18'),
  },
  {
    id: 'ec_teacher',
    label: '指導老師',
    keys: ['q5', 'q6'],
    when: (set) => set.has('q8') && set.has('q5') && set.has('q6') && !set.has('q11') && !set.has('q18'),
  },
  {
    id: 'ec_learning',
    label: '學習與興趣',
    keys: ['q4', 'q7', 'q8'],
    when: (set) => set.has('q8') && set.has('q4') && !set.has('q11') && !set.has('q18'),
  },
  {
    id: 'ec_continue',
    label: '人際與續參加',
    keys: ['q9', 'q10'],
    when: (set) => set.has('q9') && set.has('q10') && !set.has('q11') && !set.has('q13') && !set.has('q18'),
  },
];

function round2(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function collectQLikertScores(answersJson) {
  const json = parseJsonObject(answersJson);
  if (!json || Array.isArray(json)) return [];
  const scores = [];
  Object.entries(json).forEach(([key, value]) => {
    if (isSurveyAnswerMetadataKey(key)) return;
    const resolved = resolveSurveyQuestionKeyAlias(key);
    if (!/^q\d+$/i.test(resolved)) return;
    const score = parseLikertScore(value);
    if (score != null) scores.push(score);
  });
  return scores;
}

function parseLikertScore(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return n;
}

function normalizeResponseId(id) {
  if (id == null || id === '') return id;
  const numeric = Number(id);
  if (Number.isFinite(numeric) && String(numeric) === String(id).trim()) return numeric;
  return id;
}

function parseJsonObject(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }
  if (typeof value === 'object') return value;
  return null;
}

function readSchemaQuestions(schemaJson) {
  let schema = schemaJson;
  if (typeof schema === 'string') {
    try {
      schema = JSON.parse(schema);
    } catch (_) {
      return [];
    }
  }
  const list = Array.isArray(schema) ? schema : schema?.questions;
  if (!Array.isArray(list)) return [];
  return list
    .filter((q) => q && q.id)
    .map((q) => ({
      id: String(q.id),
      type: q.type || 'text',
      label: String(q.label || q.title || q.id).trim() || String(q.id),
      options: Array.isArray(q.options) ? q.options.map((option) => String(option)) : [],
      scale: Array.isArray(q.scale) ? q.scale.map((point) => String(point)) : [],
    }));
}

function shortQuestionLabel(id) {
  const match = /^q(\d+)$/i.exec(String(id || ''));
  if (match) return `Q${Number(match[1])}`;
  return String(id || '');
}

function textFromStoredAnswer(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw.answerJson)) return raw.answerJson.map((item) => String(item)).join('|');
  if (raw.answerText != null && String(raw.answerText).trim() !== '') return String(raw.answerText);
  return null;
}

function cellFromJsonValue(question, value) {
  if (value == null || value === '') return null;
  if (Array.isArray(value)) {
    const text = value.map((item) => String(item).trim()).filter(Boolean).join('|');
    return text ? { text, score: null } : null;
  }
  if (typeof value === 'object') return null;
  const text = String(value);
  return {
    text,
    score: question.type === 'likert' ? parseLikertScore(value) : null,
  };
}

/**
 * 答案列優先，缺的題再從 answersJson 補。只保留 schema 裡的題目。
 * @returns {Map<number, Record<string, { text: string|null, score: number|null }>>}
 */
function indexAnswersByResponse({ responses = [], answerRows = [], schemaQuestions = [] }) {
  const schemaById = new Map(schemaQuestions.map((q) => [q.id, q]));
  const index = new Map();

  function bucket(responseId) {
    if (!index.has(responseId)) index.set(responseId, {});
    return index.get(responseId);
  }

  answerRows.forEach((row) => {
    const key = resolveSurveyQuestionKeyAlias(row.questionKey);
    const question = schemaById.get(key);
    if (!question) return;
    const answers = bucket(normalizeResponseId(row.responseId));
    if (answers[key]) return;
    const text = textFromStoredAnswer(row);
    const score = question.type === 'likert'
      ? (parseLikertScore(row.scoreValue) ?? parseLikertScore(text))
      : null;
    answers[key] = { text, score };
  });

  responses.forEach((response) => {
    const json = parseJsonObject(response.answersJson);
    if (!json) return;
    const answers = bucket(normalizeResponseId(response.id));
    Object.entries(json).forEach(([rawKey, value]) => {
      if (isSurveyAnswerMetadataKey(rawKey)) return;
      const key = resolveSurveyQuestionKeyAlias(rawKey);
      const question = schemaById.get(key);
      if (!question || answers[key]) return;
      const cell = cellFromJsonValue(question, value);
      if (cell) answers[key] = cell;
    });
  });

  return index;
}

function flattenAnswerIndex(index, schemaQuestions = []) {
  const typeById = new Map(schemaQuestions.map((q) => [q.id, q.type]));
  const rows = [];
  index.forEach((answers, responseId) => {
    Object.entries(answers).forEach(([questionKey, cell]) => {
      const questionType = typeById.get(questionKey) || 'text';
      const scoreValue = cell.score;
      let answerText = cell.text;
      let answerJson = null;
      if (questionType === 'likert' && scoreValue != null) answerText = String(scoreValue);
      if (questionType === 'checkbox' && answerText) {
        answerJson = String(answerText).split('|').map((part) => part.trim()).filter(Boolean);
      }
      rows.push({
        responseId,
        questionKey,
        questionType,
        answerText,
        answerJson,
        scoreValue,
      });
    });
  });
  return rows;
}

function distributionOptionOrder(distribution, schemaQuestion, questionType) {
  const keys = Object.keys(distribution || {});
  const type = schemaQuestion?.type || questionType;
  let preferred = [];
  if (type === 'likert') {
    preferred = (schemaQuestion?.scale?.length ? schemaQuestion.scale : ['1', '2', '3', '4', '5']).map(String);
  } else if (schemaQuestion?.options?.length) {
    preferred = schemaQuestion.options.map(String);
  }
  if (!preferred.length) {
    return [...keys].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }
  const rest = keys.filter((key) => !preferred.includes(key)).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  return [...preferred, ...rest];
}

function decorateDistributionQuestions(questions = [], schemaQuestions = []) {
  const byId = new Map(schemaQuestions.map((q) => [q.id, q]));
  const order = schemaQuestions.map((q) => q.id);
  return questions
    .map((question) => {
      const schemaQuestion = byId.get(question.questionKey);
      return {
        ...question,
        label: schemaQuestion?.label || question.label || question.questionKey,
        optionOrder: distributionOptionOrder(question.distribution, schemaQuestion, question.questionType),
      };
    })
    .sort((a, b) => {
      const ia = order.indexOf(a.questionKey);
      const ib = order.indexOf(b.questionKey);
      if (ia === -1 && ib === -1) return String(a.questionKey).localeCompare(String(b.questionKey), 'zh-Hant');
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
}

function canonicalActivity(value) {
  const raw = String(value || '').trim();
  if (!raw) return { key: UNFILLED, label: UNFILLED };
  const lower = raw.toLowerCase();
  if (lower === 'et' || lower === 'english table') return { key: 'ET', label: 'ET 英語桌' };
  if (lower === 'ec' || lower === 'english club') return { key: 'EC', label: 'EC 英語俱樂部' };
  if (lower === 'if') return { key: 'IF', label: 'IF' };
  if (lower === 'jt' || lower === 'job talk') return { key: 'JT', label: 'JT' };
  if (lower === 'general') return { key: 'GENERAL', label: 'GENERAL' };
  return { key: raw, label: raw };
}

function groupIdentity(record, groupBy, eventLabels = {}) {
  if (groupBy === 'activityType') return canonicalActivity(record.activityType);
  if (groupBy === 'eventId') {
    if (record.eventId == null || record.eventId === '') return { key: UNFILLED, label: UNFILLED };
    const id = String(record.eventId);
    const name = eventLabels[id];
    return { key: id, label: name ? String(name) : `活動 #${id}` };
  }
  if (groupBy === 'semester') {
    const semester = String(record.semester || '').trim();
    if (!semester) return { key: UNFILLED, label: UNFILLED };
    return { key: semester, label: semester };
  }
  const text = String(record.answers?.[groupBy]?.text || '').trim();
  if (!text) return { key: UNFILLED, label: UNFILLED };
  return { key: text, label: text };
}

function listGroupOptions(schemaQuestions = []) {
  const byId = new Map(schemaQuestions.map((q) => [q.id, q]));
  const options = [];
  ['times_this_semester', 'grade', 'year'].forEach((id) => {
    if (byId.has(id)) options.push({ id, label: byId.get(id).label, source: 'answer' });
  });
  options.push(
    { id: 'activityType', label: '活動類型', source: 'response' },
    { id: 'eventId', label: '活動', source: 'response' },
    { id: 'semester', label: '學期', source: 'response' },
  );
  return options;
}

function distinctFilledCount(records, groupBy, eventLabels) {
  const values = new Set();
  records.forEach((record) => {
    const identity = groupIdentity(record, groupBy, eventLabels);
    if (identity.key !== UNFILLED) values.add(identity.key);
  });
  return values.size;
}

function resolveGroupBy(requested, options, records, eventLabels) {
  const allowed = new Set(options.map((option) => option.id));
  if (requested && allowed.has(requested)) return requested;
  const splitting = options.find((option) => distinctFilledCount(records, option.id, eventLabels) >= 2);
  if (splitting) return splitting.id;
  const filled = options.find((option) => distinctFilledCount(records, option.id, eventLabels) >= 1);
  return filled?.id || options[0]?.id || 'activityType';
}

function summarizeScores(values, minN) {
  const n = values.length;
  if (n < minN) return { n, mean: null, sd: null, suppressed: true, reason: 'MIN_N' };
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  let sd = null;
  if (n >= 2) {
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (n - 1);
    sd = Math.sqrt(variance);
  }
  return { n, mean: round2(mean), sd: sd == null ? null : round2(sd), suppressed: false, reason: null };
}

function averageRanks(values) {
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);
  const ranks = new Array(values.length);
  let cursor = 0;
  while (cursor < indexed.length) {
    let end = cursor;
    while (end + 1 < indexed.length && indexed[end + 1].value === indexed[cursor].value) end += 1;
    const average = (cursor + 1 + end + 1) / 2;
    for (let i = cursor; i <= end; i += 1) ranks[indexed[i].index] = average;
    cursor = end + 1;
  }
  return ranks;
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i] - meanX;
    const b = ys[i] - meanY;
    numerator += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx <= 1e-12 || dy <= 1e-12) return null;
  return numerator / Math.sqrt(dx * dy);
}

function spearmanRho(xs, ys) {
  if (!xs.length || xs.length !== ys.length) return null;
  return pearson(averageRanks(xs), averageRanks(ys));
}

function pairCell(xs, ys, minN) {
  const n = xs.length;
  if (n < minN) return { n, rho: null, suppressed: true, reason: 'MIN_N' };
  const rho = spearmanRho(xs, ys);
  if (rho == null) return { n, rho: null, suppressed: false, reason: 'NO_VARIANCE' };
  return { n, rho: round2(rho), suppressed: false, reason: null };
}

function sortGroups(groups, groupBy, schemaQuestion) {
  const unfilled = [];
  const rest = [];
  groups.forEach((group) => {
    if (group.key === UNFILLED) unfilled.push(group);
    else rest.push(group);
  });
  const byOrder = (order) => {
    rest.sort((a, b) => {
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      if (ia === -1 && ib === -1) return a.label.localeCompare(b.label, 'zh-Hant');
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  };
  if (schemaQuestion?.options?.length) byOrder(schemaQuestion.options.map(String));
  else if (groupBy === 'activityType') byOrder(ACTIVITY_ORDER);
  else if (groupBy === 'semester') rest.sort((a, b) => b.key.localeCompare(a.key, 'zh-Hant'));
  else if (groupBy === 'eventId') {
    rest.sort((a, b) => b.responseCount - a.responseCount || a.label.localeCompare(b.label, 'zh-Hant'));
  } else rest.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'));
  return [...rest, ...unfilled];
}

function likertQuestions(schemaQuestions = []) {
  return schemaQuestions
    .filter((q) => q.type === 'likert')
    .map((q) => ({
      key: q.id,
      label: q.label,
      shortLabel: shortQuestionLabel(q.id),
    }));
}

function suggestedQuestionKeys(questions) {
  const ids = questions.map((q) => q.key);
  const set = new Set(ids);
  const et = ['q7', 'q17', 'q18'].filter((key) => set.has(key));
  if (et.length >= 2) return et;
  const ec = ['q1', 'q8', 'q10'].filter((key) => set.has(key));
  if (ec.length >= 2 && !set.has('q18')) return ec;
  return ids.slice(0, 3);
}

function matchingConstructs(questions) {
  const set = new Set(questions.map((q) => q.key));
  return CONSTRUCT_DEFS
    .filter((def) => def.when(set))
    .map((def) => ({
      id: def.id,
      label: def.label,
      keys: def.keys.filter((key) => set.has(key)),
    }))
    .filter((def) => def.keys.length > 0);
}

function buildItemRelations({
  records = [],
  schemaQuestions = [],
  groupBy,
  minN = 10,
  eventLabels = {},
  versionId = null,
  versionNumber = null,
  surveyId = null,
}) {
  const questions = likertQuestions(schemaQuestions);
  const groupOptions = listGroupOptions(schemaQuestions);
  const resolvedGroupBy = resolveGroupBy(groupBy, groupOptions, records, eventLabels);
  const groupQuestion = schemaQuestions.find((q) => q.id === resolvedGroupBy) || null;
  const buckets = new Map();

  records.forEach((record) => {
    const identity = groupIdentity(record, resolvedGroupBy, eventLabels);
    if (!buckets.has(identity.key)) {
      buckets.set(identity.key, {
        key: identity.key,
        label: identity.label,
        responseCount: 0,
        scores: Object.fromEntries(questions.map((q) => [q.key, []])),
      });
    }
    const bucket = buckets.get(identity.key);
    bucket.responseCount += 1;
    questions.forEach((question) => {
      const score = record.answers?.[question.key]?.score;
      if (score != null) bucket.scores[question.key].push(score);
    });
  });

  const groups = sortGroups(
    [...buckets.values()].map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      responseCount: bucket.responseCount,
      cells: Object.fromEntries(
        questions.map((question) => [question.key, summarizeScores(bucket.scores[question.key], minN)]),
      ),
    })),
    resolvedGroupBy,
    groupQuestion,
  );

  const series = Object.fromEntries(questions.map((question) => [question.key, new Map()]));
  records.forEach((record, index) => {
    const responseKey = record.responseId != null ? record.responseId : `row-${index}`;
    questions.forEach((question) => {
      const score = record.answers?.[question.key]?.score;
      if (score != null) series[question.key].set(responseKey, score);
    });
  });

  const matrix = {};
  questions.forEach((row) => {
    matrix[row.key] = {};
    questions.forEach((column) => {
      const xs = [];
      const ys = [];
      series[row.key].forEach((score, responseKey) => {
        if (!series[column.key].has(responseKey)) return;
        xs.push(score);
        ys.push(series[column.key].get(responseKey));
      });
      matrix[row.key][column.key] = pairCell(xs, ys, minN);
    });
  });

  return {
    ready: true,
    versionId,
    versionNumber,
    surveyId,
    minN,
    responseCount: records.length,
    groupBy: resolvedGroupBy,
    groupByLabel: groupOptions.find((option) => option.id === resolvedGroupBy)?.label || resolvedGroupBy,
    groupOptions,
    questions,
    suggestedQuestionKeys: suggestedQuestionKeys(questions),
    constructs: matchingConstructs(questions),
    groups,
    matrix,
    message: questions.length ? '' : '這個版本沒有量表題，無法計算關聯。',
    note: ASSOCIATION_NOTE,
  };
}

module.exports = {
  ASSOCIATION_NOTE,
  UNFILLED,
  averageRanks,
  buildItemRelations,
  collectQLikertScores,
  decorateDistributionQuestions,
  distributionOptionOrder,
  flattenAnswerIndex,
  indexAnswersByResponse,
  normalizeResponseId,
  parseLikertScore,
  readSchemaQuestions,
  round2,
  spearmanRho,
  summarizeScores,
};
