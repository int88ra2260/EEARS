const ExcelJS = require('exceljs');
const { Op, fn, col } = require('sequelize');
const { sequelize, Survey, SurveyVersion, SurveyRule, SurveyModuleResponse, SurveyResponseAnswer, Semester, Event } = require('../models');
const surveyModuleService = require('./surveyModuleService');
const { simulateSurveyRuleResolution } = require('./surveyRuleEvaluationService');
const { normalizeSurveyResponseAnswers } = require('./surveyResponseNormalizationService');
const {
  maskSurveyResponseListForAdminApi,
  maskSurveyResponseDetailForAdminApi,
} = require('../utils/surveyResponseApiMask');
const { mergeWhereWithScope } = require('./accessControl/surveyScopeGuard');
const { isValidSemester } = require('../utils/semester');

const ACTIVITY_TYPE_ALIASES = {
  ET: 'English Table',
  EC: 'English Club',
};

const LIST_PAGE_SIZE_MAX = 200;
const EXPORT_PAGE_SIZE_MAX = 5000;

function normalizePagination(query = {}) {
  const page = Math.max(Number(query.page) || 1, 1);
  const requested = Math.max(Number(query.pageSize) || 20, 1);
  const cap = query.__forExport
    ? Math.min(Math.max(Number(query.maxRows) || EXPORT_PAGE_SIZE_MAX, 1), EXPORT_PAGE_SIZE_MAX)
    : LIST_PAGE_SIZE_MAX;
  const pageSize = Math.min(requested, cap);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

async function listSurveyCenter(query = {}) {
  const { page, pageSize, offset } = normalizePagination(query);
  const where = {};
  if (query.id) where.id = Number(query.id);
  if (query.status) where.status = query.status;
  if (query.activityType) where.activityType = query.activityType;
  const { rows, count } = await Survey.findAndCountAll({
    where: mergeWhereWithScope(where, query.__scopeWhere),
    order: [['updatedAt', 'DESC']],
    limit: pageSize,
    offset,
  });
  return { rows, count, page, pageSize };
}

function parseSort(query, allowed, defaultKey, defaultOrder = 'DESC') {
  const sortBy = allowed.includes(query.sortBy) ? query.sortBy : defaultKey;
  const sortOrder = String(query.sortOrder || defaultOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return { sortBy, sortOrder };
}

function computeRuleStatus(rule, now = new Date()) {
  if (!rule?.isEnabled) return 'disabled';
  const startAt = rule.startAt || rule.startDate;
  const endAt = rule.endAt || rule.endDate;
  if (startAt && new Date(startAt) > now) return 'not_started';
  if (endAt && new Date(endAt) < now) return 'expired';
  return 'active_now';
}

async function listSurveyRules(query = {}) {
  const { page, pageSize, offset } = normalizePagination(query);
  const where = {};
  if (query.semesterId) where.semesterId = query.semesterId;
  if (query.activityType) where.activityType = query.activityType;
  if (query.isEnabled === 'true') where.isEnabled = true;
  if (query.isEnabled === 'false') where.isEnabled = false;
  const { sortBy, sortOrder } = parseSort(query, ['priority', 'updatedAt', 'startAt', 'endAt', 'id'], 'priority', 'ASC');

  const { rows, count } = await SurveyRule.findAndCountAll({
    where: mergeWhereWithScope(where, query.__scopeWhere),
    include: [
      { model: Survey, attributes: ['id', 'name', 'title', 'surveyKey'], required: false },
      { model: Semester, attributes: ['id', 'code', 'name'], required: false },
      { model: SurveyVersion, attributes: ['id', 'versionNumber'], required: false },
    ],
    order: [[sortBy, sortOrder], ['updatedAt', 'DESC']],
    limit: pageSize,
    offset,
  });

  const enabledRows = await SurveyRule.findAll({ where: mergeWhereWithScope({ ...where, isEnabled: true }, query.__scopeWhere), order: [['priority', 'ASC'], ['updatedAt', 'DESC']] });
  const activeByScope = new Map();
  const now = new Date();
  enabledRows.forEach((r) => {
    if (computeRuleStatus(r, now) !== 'active_now') return;
    const k = `${r.semesterId || 'all'}|${r.activityType || 'general'}|${r.appliesToAllEvents ? 'all' : r.eventId || 'none'}`;
    if (!activeByScope.has(k)) activeByScope.set(k, r.id);
  });

  const data = rows.map((r) => {
    const k = `${r.semesterId || 'all'}|${r.activityType || 'general'}|${r.appliesToAllEvents ? 'all' : r.eventId || 'none'}`;
    const status = computeRuleStatus(r, now);
    const overridden = status === 'active_now' && activeByScope.get(k) !== r.id;
    return { ...r.toJSON(), effectiveStatus: overridden ? 'overridden_by_higher_priority' : status };
  });
  return { rows: data, pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) } };
}

function overlap(aStart, aEnd, bStart, bEnd) {
  const as = aStart ? new Date(aStart).getTime() : Number.NEGATIVE_INFINITY;
  const ae = aEnd ? new Date(aEnd).getTime() : Number.POSITIVE_INFINITY;
  const bs = bStart ? new Date(bStart).getTime() : Number.NEGATIVE_INFINITY;
  const be = bEnd ? new Date(bEnd).getTime() : Number.POSITIVE_INFINITY;
  return as <= be && bs <= ae;
}

async function findRuleConflicts(payload, excludeId = null) {
  const where = { semesterId: payload.semesterId || null, activityType: payload.activityType || null, isEnabled: true };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const candidates = await SurveyRule.findAll({ where });
  const hit = candidates.filter((r) => {
    const sameScope =
      (payload.appliesToAllEvents && r.appliesToAllEvents) ||
      (!payload.appliesToAllEvents && !r.appliesToAllEvents && Number(payload.eventId) === Number(r.eventId)) ||
      (payload.appliesToAllEvents && !r.appliesToAllEvents) ||
      (!payload.appliesToAllEvents && r.appliesToAllEvents);
    if (!sameScope) return false;
    return overlap(payload.startAt || payload.startDate, payload.endAt || payload.endDate, r.startAt || r.startDate, r.endAt || r.endDate);
  });
  return hit;
}

async function createSurveyRule(payload) {
  const conflicts = await findRuleConflicts(payload, null);
  if (payload.isEnabled !== false && conflicts.length) {
    const samePriority = conflicts.some((c) => Number(c.priority) === Number(payload.priority || 100));
    const err = new Error(samePriority ? '規則衝突：同範圍同時段已有相同優先序啟用規則' : '規則重疊：將由 priority 決定生效順序');
    err.statusCode = samePriority ? 409 : 400;
    err.code = 'RULE_CONFLICT';
    err.details = conflicts.map((c) => ({ id: c.id, priority: c.priority }));
    err.relatedRules = conflicts.map((c) => c.id);
    err.canResolveByPriority = !samePriority;
    err.suggestion = samePriority ? '調整 priority 或時間區間' : '請確認較高優先序規則是否符合預期';
    err.conflictType = samePriority ? 'SAME_PRIORITY_OVERLAP' : 'SAME_SCOPE_OVERLAP';
    throw err;
  }
  return SurveyRule.create(payload);
}

async function updateSurveyRule(id, payload) {
  const row = await SurveyRule.findByPk(id);
  if (!row) return null;
  const merged = { ...row.toJSON(), ...payload };
  const conflicts = await findRuleConflicts(merged, id);
  if (merged.isEnabled !== false && conflicts.length) {
    const samePriority = conflicts.some((c) => Number(c.priority) === Number(merged.priority || 100));
    const err = new Error(samePriority ? '規則衝突：同範圍同時段已有相同優先序啟用規則' : '規則重疊：將由 priority 決定生效順序');
    err.statusCode = samePriority ? 409 : 400;
    err.code = 'RULE_CONFLICT';
    err.details = conflicts.map((c) => ({ id: c.id, priority: c.priority }));
    err.relatedRules = conflicts.map((c) => c.id);
    err.canResolveByPriority = !samePriority;
    err.suggestion = samePriority ? '調整 priority 或時間區間' : '請確認較高優先序規則是否符合預期';
    err.conflictType = samePriority ? 'SAME_PRIORITY_OVERLAP' : 'SAME_SCOPE_OVERLAP';
    throw err;
  }
  await row.update(payload);
  return row;
}

async function getEffectiveRule({ semesterId, activityType, eventId }) {
  const sim = await simulateSurveyRuleResolution({ semesterId, activityType, eventId, currentTime: new Date() });
  return sim.selectedRule || null;
}

async function applyResponseListFilters(query) {
  const where = {};
  const andParts = [];
  const eqFields = ['surveyId', 'surveyVersionId', 'eventId', 'studentId', 'submissionStatus'];
  eqFields.forEach((f) => {
    if (query[f] != null && query[f] !== '') where[f] = query[f];
  });

  if (query.semesterId != null && query.semesterId !== '') {
    const sem = await Semester.findByPk(Number(query.semesterId));
    if (sem?.code) {
      andParts.push({ [Op.or]: [{ semesterId: Number(query.semesterId) }, { semester: sem.code }] });
    } else {
      where.semesterId = Number(query.semesterId);
    }
  } else if (query.semester && isValidSemester(query.semester)) {
    where.semester = query.semester;
  }

  if (query.activityType) {
    const raw = String(query.activityType).trim();
    const resolved = ACTIVITY_TYPE_ALIASES[raw] || raw;
    andParts.push({
      [Op.or]: [{ activityType: resolved }, { activityType: raw }, { eventType: resolved }],
    });
  }

  if (andParts.length) {
    return { [Op.and]: [...andParts, ...(Object.keys(where).length ? [where] : [])] };
  }
  return where;
}

async function listSurveyResponses(query = {}) {
  const { page, pageSize, offset } = normalizePagination(query);
  let where = await applyResponseListFilters(query);
  if (query.studentName) where.studentName = { [Op.like]: `%${query.studentName}%` };
  if (query.studentEmail && String(query.studentEmail).trim()) {
    where.studentEmail = { [Op.like]: `%${String(query.studentEmail).trim()}%` };
  }
  if (query.versionId && !where.surveyVersionId) where.surveyVersionId = query.versionId;
  if (query.startDate || query.endDate || query.from || query.to) {
    where.submittedAt = {};
    if (query.startDate || query.from) where.submittedAt[Op.gte] = new Date(query.startDate || query.from);
    if (query.endDate || query.to) where.submittedAt[Op.lte] = new Date(query.endDate || query.to);
  }

  const { sortBy, sortOrder } = parseSort(
    query,
    ['submittedAt', 'studentId', 'studentName', 'submissionStatus', 'semesterId', 'surveyId'],
    'submittedAt',
    'DESC'
  );

  const scopedWhere = mergeWhereWithScope(where, query.__scopeWhere);
  const { rows, count } = await SurveyModuleResponse.findAndCountAll({
    where: scopedWhere,
    include: [
      { model: Survey, attributes: ['id', 'name', 'title', 'surveyKey'], required: false },
      { model: SurveyVersion, attributes: ['id', 'versionNumber'], required: false },
      { model: Semester, attributes: ['id', 'code', 'name'], required: false },
    ],
    order: [[sortBy, sortOrder]],
    limit: pageSize,
    offset,
  });
  const responseIds = rows.map((r) => r.id);
  const answerCounts = responseIds.length
    ? await SurveyResponseAnswer.findAll({
        attributes: ['responseId', [fn('COUNT', col('id')), 'cnt']],
        where: { responseId: { [Op.in]: responseIds } },
        group: ['responseId'],
      })
    : [];
  const answerMap = new Map(answerCounts.map((a) => [Number(a.responseId), Number(a.get('cnt') || 0)]));

  const summaryRows = await SurveyModuleResponse.findAll({
    attributes: [
      [fn('COUNT', col('id')), 'totalResponses'],
      [fn('SUM', sequelize.literal("CASE WHEN submissionStatus = 'submitted' THEN 1 ELSE 0 END")), 'completedResponses'],
      [fn('COUNT', fn('DISTINCT', col('surveyId'))), 'distinctSurveyCount'],
      [fn('COUNT', fn('DISTINCT', col('eventId'))), 'distinctEventCount'],
      [fn('COUNT', fn('DISTINCT', col('semesterId'))), 'distinctSemesterCount'],
    ],
    where: scopedWhere,
    raw: true,
  });
  const s = summaryRows[0] || {};
  const totalResponses = Number(s.totalResponses || 0);
  const completedResponses = Number(s.completedResponses || 0);
  const summary = {
    totalResponses,
    completedResponses,
    partialResponses: Math.max(totalResponses - completedResponses, 0),
    distinctSurveyCount: Number(s.distinctSurveyCount || 0),
    distinctEventCount: Number(s.distinctEventCount || 0),
    distinctSemesterCount: Number(s.distinctSemesterCount || 0),
  };

  const mappedRows = rows.map((r) => ({ ...r.toJSON(), answersCount: answerMap.get(r.id) || 0 }));
  const rowsOut = query.__forExport ? mappedRows : maskSurveyResponseListForAdminApi(mappedRows);

  return {
    rows: rowsOut,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
    summary,
  };
}

async function getResponseDetail(id) {
  const response = await SurveyModuleResponse.findByPk(id);
  if (!response) return null;
  const normalized = await normalizeSurveyResponseAnswers(response);
  return maskSurveyResponseDetailForAdminApi({
    response: response.toJSON ? response.toJSON() : response,
    answers: normalized.answers,
    schemaJson: normalized.schemaJson,
    warnings: normalized.warnings,
    dataIntegrity: normalized.dataIntegrity,
  });
}

async function analyticsOverview(query = {}) {
  const where = buildAnalyticsWhere(query);
  const total = await SurveyModuleResponse.count({ where });
  const submitted = await SurveyModuleResponse.count({ where: { ...where, submissionStatus: 'submitted' } });
  const activityCoverage = await SurveyModuleResponse.count({ where, distinct: true, col: 'eventId' });
  const surveyCoverage = await SurveyModuleResponse.count({ where, distinct: true, col: 'surveyId' });
  const likertRows = await SurveyResponseAnswer.findAll({
    attributes: [[fn('AVG', col('scoreValue')), 'avgScore']],
    include: [{ model: SurveyModuleResponse, required: true, attributes: [], where }],
    where: { scoreValue: { [Op.ne]: null } },
    raw: true,
  });
  const avgScore = Number(likertRows[0]?.avgScore || 0);
  return {
    totalResponses: total,
    completionRate: total ? Number(((submitted / total) * 100).toFixed(2)) : 0,
    averageSatisfaction: Number(avgScore.toFixed(2)),
    activityCoverage,
    surveyCoverage,
  };
}

function buildAnalyticsWhere(query = {}) {
  const where = {};
  if (query.semesterId) where.semesterId = query.semesterId;
  if (query.surveyId) where.surveyId = query.surveyId;
  if (query.versionId) where.surveyVersionId = query.versionId;
  if (query.activityType) where.activityType = query.activityType;
  if (query.eventId) where.eventId = query.eventId;
  if (query.startDate || query.endDate) {
    where.submittedAt = {};
    if (query.startDate) where.submittedAt[Op.gte] = new Date(query.startDate);
    if (query.endDate) where.submittedAt[Op.lte] = new Date(query.endDate);
  }
  return mergeWhereWithScope(where, query.__scopeWhere);
}

async function analyticsDistribution(query = {}) {
  const where = buildAnalyticsWhere(query);
  const responseRows = await SurveyModuleResponse.findAll({ where, attributes: ['id'] });
  const ids = responseRows.map((r) => r.id);
  if (!ids.length) return { questions: [] };
  const answers = await SurveyResponseAnswer.findAll({ where: { responseId: { [Op.in]: ids } }, raw: true });
  const grouped = new Map();
  answers.forEach((a) => {
    if (!grouped.has(a.questionKey)) grouped.set(a.questionKey, []);
    grouped.get(a.questionKey).push(a);
  });
  const questions = [];
  grouped.forEach((arr, key) => {
    const type = arr[0]?.questionType || 'text';
    if (type === 'radio' || type === 'likert') {
      const dist = {};
      arr.forEach((x) => {
        const v = x.answerText || (x.scoreValue != null ? String(x.scoreValue) : null);
        if (!v) return;
        dist[v] = (dist[v] || 0) + 1;
      });
      const scored = arr.filter((x) => x.scoreValue != null);
      const avg = scored.length ? Number((scored.reduce((s, x) => s + Number(x.scoreValue || 0), 0) / scored.length).toFixed(2)) : null;
      questions.push({ questionKey: key, questionType: type, distribution: dist, averageScore: avg });
    } else if (type === 'checkbox') {
      const dist = {};
      arr.forEach((x) => {
        const list = Array.isArray(x.answerJson) ? x.answerJson : (typeof x.answerText === 'string' ? x.answerText.split('|') : []);
        list.forEach((it) => {
          const k = String(it).trim();
          if (!k) return;
          dist[k] = (dist[k] || 0) + 1;
        });
      });
      questions.push({ questionKey: key, questionType: type, distribution: dist });
    }
  });
  return { questions };
}

async function analyticsTrends(query = {}) {
  const where = buildAnalyticsWhere(query);
  const rows = await SurveyModuleResponse.findAll({
    attributes: [[fn('DATE', col('submittedAt')), 'day'], [fn('COUNT', col('id')), 'count']],
    where,
    group: [fn('DATE', col('submittedAt'))],
    order: [[fn('DATE', col('submittedAt')), 'ASC']],
    raw: true,
  });
  return { rows: rows.map((r) => ({ day: r.day, count: Number(r.count || 0) })) };
}

async function analyticsComparison(query = {}) {
  const by = query.by === 'activityType' ? 'activityType' : 'semesterId';
  const where = buildAnalyticsWhere(query);
  const rows = await SurveyModuleResponse.findAll({
    attributes: [by, [fn('COUNT', col('id')), 'count']],
    where,
    group: [col(by)],
    order: [[fn('COUNT', col('id')), 'DESC']],
    raw: true,
  });
  return { by, rows: rows.map((r) => ({ key: r[by] || 'N/A', count: Number(r.count || 0) })) };
}

async function analyticsOpenTextSummary(query = {}) {
  const where = buildAnalyticsWhere(query);
  const responseRows = await SurveyModuleResponse.findAll({ where, attributes: ['id'] });
  const ids = responseRows.map((r) => r.id);
  if (!ids.length) return { total: 0, rows: [], topTokens: [] };
  const answerWhere = { responseId: { [Op.in]: ids } };
  if (query.questionKey) answerWhere.questionKey = query.questionKey;
  const rows = await SurveyResponseAnswer.findAll({
    where: answerWhere,
    attributes: ['responseId', 'questionKey', 'answerText', 'createdAt'],
    limit: Math.min(Number(query.limit) || 50, 200),
    order: [['createdAt', 'DESC']],
    raw: true,
  });
  const filtered = rows.filter((r) => r.answerText && String(r.answerText).trim().length >= 2);
  const tokenCount = {};
  filtered.forEach((r) => {
    String(r.answerText)
      .split(/[\s,，。.!?！？;；:：()\[\]{}\/\\\n\r\t]+/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 2)
      .forEach((x) => {
        tokenCount[x] = (tokenCount[x] || 0) + 1;
      });
  });
  const topTokens = Object.entries(tokenCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([token, count]) => ({ token, count }));
  return { total: filtered.length, rows: filtered, topTokens };
}

async function gatingEffectiveForReservation({ eventId, activityType }) {
  let at = activityType || null;
  let semesterId = null;
  if (eventId) {
    const event = await Event.findByPk(eventId);
    if (event) {
      at = at || event.eventType || null;
      semesterId = event.semesterId || null;
    }
  }
  const rule = await getEffectiveRule({ semesterId, activityType: at, eventId });
  return { semesterId, activityType: at, rule };
}

async function submitSurvey(surveyKey, body, req) {
  // 仍使用既有提交引擎，確保不破壞既有流程
  return surveyModuleService.submitPublicResponse(surveyKey, body, req);
}

async function myStatus({ surveyId, studentId, semesterId }) {
  const where = { surveyId, studentId };
  if (semesterId) where.semesterId = semesterId;
  const row = await SurveyModuleResponse.findOne({ where, order: [['submittedAt', 'DESC']] });
  return { filled: !!row, latest: row || null };
}

async function listSemesters() {
  let rows = await Semester.findAll({ order: [['startDate', 'DESC']] });
  if (!rows.length) {
    const { ensureSemesterRows } = require('./surveyLegacyResponseSyncService');
    await ensureSemesterRows();
    rows = await Semester.findAll({ order: [['startDate', 'DESC']] });
  }
  return rows;
}

const EXPORT_ANSWERS_JSON_SKIP = new Set(['__legacyActivityType']);
const EXPORT_QUESTION_SKIP = new Set([
  '__legacyActivityType',
  'studentId',
  'studentName',
  'name',
  'email',
  'studentEmail',
]);

function formatAnswerCellValue(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map((x) => String(x)).join(' | ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function flattenAnswersJsonForExport(answersJson) {
  if (!answersJson || typeof answersJson !== 'object') return {};
  const out = {};
  Object.entries(answersJson).forEach(([key, value]) => {
    if (EXPORT_ANSWERS_JSON_SKIP.has(key)) return;
    out[key] = formatAnswerCellValue(value);
  });
  return out;
}

function buildAnswerKvForExport(answersJson, answerRows = []) {
  const kv = {};
  answerRows.forEach((a) => {
    kv[a.questionKey] =
      a.answerText ||
      formatAnswerCellValue(a.answerJson) ||
      (a.scoreValue != null ? String(a.scoreValue) : '');
  });
  Object.assign(kv, flattenAnswersJsonForExport(answersJson));
  return kv;
}

function pickQuestionCells(kv, questionColumns) {
  const cells = {};
  questionColumns.forEach((col) => {
    cells[col.colKey] = kv[col.key] ?? '';
  });
  return cells;
}

function questionExportHeader(q, likertOrdinal) {
  const label = String(q.label || q.id || '').trim();
  if (q.type === 'likert' && /^q\d+$/i.test(String(q.id)) && likertOrdinal != null) {
    return `Q${likertOrdinal} ${label}`;
  }
  return label ? `${q.id} ${label}` : String(q.id);
}

async function buildExportQuestionColumns(query, rows) {
  const { resolveSurveySchema } = require('./surveyResponseStatsService');
  const columns = [];
  const seen = new Set();

  const add = (key, header, type) => {
    if (!key || seen.has(key) || EXPORT_QUESTION_SKIP.has(key)) return;
    seen.add(key);
    columns.push({
      key,
      header,
      type: type || 'text',
      colKey: `q_${key}`,
    });
  };

  const surveyIds = new Set();
  if (query.surveyId != null && query.surveyId !== '') surveyIds.add(Number(query.surveyId));
  rows.forEach((r) => {
    if (r.surveyId) surveyIds.add(Number(r.surveyId));
  });

  for (const sid of [...surveyIds].sort((a, b) => a - b)) {
    const surveyRow =
      rows.find((r) => Number(r.surveyId) === sid)?.Survey ||
      (await Survey.findByPk(sid).catch(() => null));
    const schema = await resolveSurveySchema(surveyRow);
    let likertOrdinal = 0;
    (schema?.questions || []).forEach((q) => {
      const isLikert = q.type === 'likert';
      if (isLikert) likertOrdinal += 1;
      add(q.id, questionExportHeader(q, isLikert ? likertOrdinal : null), q.type || 'text');
    });
  }

  const extras = new Set();
  rows.forEach((r) => {
    Object.keys(flattenAnswersJsonForExport(r.answersJson)).forEach((k) => extras.add(k));
  });
  [...extras].sort().forEach((k) => {
    add(k, k, /^q\d+$/i.test(k) ? 'likert' : 'text');
  });

  return columns;
}

function getRawAnswerForExport(row, questionKey, answersByResponseId) {
  const answerRows = answersByResponseId.get(row.id) || [];
  const fromTable = answerRows.find((a) => a.questionKey === questionKey);
  if (fromTable) {
    if (fromTable.scoreValue != null) return fromTable.scoreValue;
    if (fromTable.answerText != null && fromTable.answerText !== '') return fromTable.answerText;
    return fromTable.answerJson;
  }
  return row.answersJson?.[questionKey];
}

function computeExportAverageRow(rows, questionColumns, answersByResponseId) {
  const { parseLikertScore } = require('./surveyResponseStatsService');
  const cells = {};
  questionColumns.forEach((col) => {
    const isLikert = col.type === 'likert' || /^q\d+$/i.test(col.key);
    if (!isLikert) {
      cells[col.colKey] = '';
      return;
    }
    let sum = 0;
    let count = 0;
    rows.forEach((r) => {
      const score = parseLikertScore(getRawAnswerForExport(r, col.key, answersByResponseId));
      if (score != null) {
        sum += score;
        count += 1;
      }
    });
    cells[col.colKey] = count ? Number((sum / count).toFixed(2)) : '';
  });
  return cells;
}

async function exportSurveyResponsesXlsx(query, res, actorId) {
  const list = await listSurveyResponses({
    ...query,
    page: 1,
    pageSize: Math.min(Number(query.maxRows) || 5000, 5000),
    __forExport: true,
  });
  const rows = list.rows || [];
  const ids = rows.map((r) => r.id);
  const answerRows = ids.length
    ? await SurveyResponseAnswer.findAll({ where: { responseId: { [Op.in]: ids } }, raw: true })
    : [];
  const answersByResponseId = new Map();
  answerRows.forEach((a) => {
    if (!answersByResponseId.has(a.responseId)) answersByResponseId.set(a.responseId, []);
    answersByResponseId.get(a.responseId).push(a);
  });

  const questionColumns = await buildExportQuestionColumns(query, rows);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'EEARS';
  wb.created = new Date();

  const ws = wb.addWorksheet('填答紀錄');
  const fixedCols = [
    { header: 'responseId', key: 'responseId', width: 10 },
    { header: 'semester', key: 'semester', width: 14 },
    { header: 'survey', key: 'survey', width: 24 },
    { header: 'version', key: 'version', width: 10 },
    { header: 'activityType', key: 'activityType', width: 18 },
    { header: 'eventId', key: 'eventId', width: 10 },
    { header: 'studentId', key: 'studentId', width: 14 },
    { header: 'studentName', key: 'studentName', width: 16 },
    { header: 'studentEmail', key: 'studentEmail', width: 28 },
    { header: 'status', key: 'status', width: 14 },
    { header: 'submittedAt', key: 'submittedAt', width: 22 },
    { header: 'source', key: 'source', width: 16 },
  ];
  ws.columns = fixedCols.concat(
    questionColumns.map((col) => ({ header: col.header, key: col.colKey, width: 28 }))
  );

  rows.forEach((r) => {
    const base = {
      responseId: r.id,
      semester: r.Semester?.code || r.semester || '',
      survey: r.Survey?.title || r.Survey?.name || '',
      version: r.SurveyVersion?.versionNumber || '',
      activityType: r.activityType || '',
      eventId: r.eventId || '',
      studentId: r.studentId || '',
      studentName: r.studentName || r.answersJson?.name || '',
      studentEmail: r.studentEmail || r.answersJson?.email || '',
      status: r.submissionStatus || '',
      submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : '',
      source: r.source || '',
    };
    const kv = buildAnswerKvForExport(r.answersJson, answersByResponseId.get(r.id) || []);
    ws.addRow({ ...base, ...pickQuestionCells(kv, questionColumns) });
  });

  if (rows.length > 0 && questionColumns.length > 0) {
    const avgCells = computeExportAverageRow(rows, questionColumns, answersByResponseId);
    const avgRow = ws.addRow({
      responseId: '',
      semester: '',
      survey: '',
      version: '',
      activityType: '',
      eventId: '',
      studentId: '',
      studentName: '平均',
      studentEmail: '',
      status: '',
      submittedAt: '',
      source: '',
      ...avgCells,
    });
    avgRow.font = { bold: true };
  }

  try {
    const { getResponseBasicStats } = require('./surveyResponseStatsService');
    const stats = await getResponseBasicStats(query);
    const summaryWs = wb.addWorksheet('基本統計');
    summaryWs.columns = [
      { header: '項目', key: 'item', width: 36 },
      { header: '數值', key: 'value', width: 48 },
    ];
    summaryWs.addRow({ item: '總回應數', value: stats.totalResponses });
    Object.entries(stats.gradeDistribution || {}).forEach(([grade, count]) => {
      const pct = stats.gradeDistributionPercent?.[grade];
      summaryWs.addRow({
        item: `年級分布：${grade}`,
        value: pct != null ? `${count}（${pct}%）` : String(count),
      });
    });
    const primary = stats.primary || stats.groups?.[0];
    if (primary?.overallLikertAverage != null) {
      summaryWs.addRow({ item: '李克特整體平均', value: primary.overallLikertAverage });
    }
    (primary?.questionStats || []).forEach((q, idx) => {
      summaryWs.addRow({
        item: `Q${idx + 1} ${q.label}`,
        value: q.average != null ? `${q.average}（n=${q.count}）` : '—',
      });
    });
  } catch (_) {
    // 統計 sheet 失敗不阻擋主資料匯出
  }

  await surveyModuleService.writeAudit(
    actorId,
    'export',
    'SurveyModuleResponse',
    String(query.surveyId || 'all'),
    null,
    { count: rows.length },
    'export survey responses xlsx'
  );
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="survey-responses-export.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}

async function exportSurveyAnalyticsXlsx(query, res, actorId) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EEARS';
  wb.created = new Date();

  const filtersWs = wb.addWorksheet('filters');
  filtersWs.columns = [
    { header: 'key', key: 'key', width: 24 },
    { header: 'value', key: 'value', width: 60 },
  ];
  Object.entries({
    semesterId: query.semesterId || '',
    surveyId: query.surveyId || '',
    versionId: query.versionId || '',
    activityType: query.activityType || '',
    eventId: query.eventId || '',
    startDate: query.startDate || '',
    endDate: query.endDate || '',
  }).forEach(([k, v]) => filtersWs.addRow({ key: k, value: v }));

  const [overview, distribution, trends, comparison, openText] = await Promise.all([
    analyticsOverview(query),
    analyticsDistribution(query),
    analyticsTrends(query),
    analyticsComparison(query),
    analyticsOpenTextSummary({ ...query, limit: Math.min(Number(query.limit) || 200, 200) }),
  ]);

  const surveyHealthService = require('./surveyHealthService');
  const where = buildAnalyticsWhere(query);
  const dataQuality = await surveyHealthService.dataQualityForWhere(where).catch(() => null);

  const ows = wb.addWorksheet('overview');
  ows.columns = [
    { header: 'metric', key: 'metric', width: 24 },
    { header: 'value', key: 'value', width: 20 },
  ];
  Object.entries(overview || {}).forEach(([k, v]) => ows.addRow({ metric: k, value: v == null ? '' : v }));

  const dws = wb.addWorksheet('distribution');
  dws.columns = [
    { header: 'questionKey', key: 'questionKey', width: 32 },
    { header: 'questionType', key: 'questionType', width: 14 },
    { header: 'averageScore', key: 'averageScore', width: 14 },
    { header: 'distribution', key: 'distribution', width: 80 },
  ];
  (distribution?.questions || []).forEach((q) => {
    dws.addRow({
      questionKey: q.questionKey,
      questionType: q.questionType,
      averageScore: q.averageScore != null ? q.averageScore : '',
      distribution: q.distribution ? JSON.stringify(q.distribution) : '',
    });
  });

  const tws = wb.addWorksheet('trends');
  tws.columns = [
    { header: 'day', key: 'day', width: 14 },
    { header: 'count', key: 'count', width: 10 },
  ];
  (trends?.rows || []).forEach((r) => tws.addRow(r));

  const cws = wb.addWorksheet('comparison');
  cws.columns = [
    { header: 'by', key: 'by', width: 16 },
    { header: 'key', key: 'key', width: 20 },
    { header: 'count', key: 'count', width: 10 },
  ];
  (comparison?.rows || []).forEach((r) => cws.addRow({ by: comparison.by || '', key: r.key, count: r.count }));

  const otextWs = wb.addWorksheet('open_text');
  otextWs.columns = [
    { header: 'responseId', key: 'responseId', width: 12 },
    { header: 'questionKey', key: 'questionKey', width: 24 },
    { header: 'answerText', key: 'answerText', width: 80 },
    { header: 'createdAt', key: 'createdAt', width: 22 },
  ];
  (openText?.rows || []).forEach((r) => otextWs.addRow(r));

  const tokenWs = wb.addWorksheet('open_text_tokens');
  tokenWs.columns = [
    { header: 'token', key: 'token', width: 24 },
    { header: 'count', key: 'count', width: 10 },
  ];
  (openText?.topTokens || []).forEach((t) => tokenWs.addRow(t));

  const dqWs = wb.addWorksheet('data_quality');
  dqWs.columns = [
    { header: 'metric', key: 'metric', width: 32 },
    { header: 'value', key: 'value', width: 20 },
  ];
  Object.entries(dataQuality || {}).forEach(([k, v]) => dqWs.addRow({ metric: k, value: v == null ? '' : v }));

  await surveyModuleService.writeAudit(
    actorId,
    'export_analytics_xlsx',
    'SurveyAnalytics',
    String(query.surveyId || 'all'),
    null,
    { openTextRows: Number(openText?.total || 0) },
    'export survey analytics xlsx'
  );

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="survey-analytics-export.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}

module.exports = {
  listSurveyCenter,
  listSurveyRules,
  createSurveyRule,
  updateSurveyRule,
  getEffectiveRule,
  applyResponseListFilters,
  listSurveyResponses,
  getResponseDetail,
  analyticsOverview,
  analyticsDistribution,
  analyticsTrends,
  analyticsComparison,
  analyticsOpenTextSummary,
  gatingEffectiveForReservation,
  submitSurvey,
  myStatus,
  listSemesters,
  exportSurveyResponsesXlsx,
  exportSurveyAnalyticsXlsx,
  computeExportAverageRow,
  pickQuestionCells,
  buildAnswerKvForExport,
};
