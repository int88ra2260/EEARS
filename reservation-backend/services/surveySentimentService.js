/**
 * 問卷開放題情緒分析（詞典規則法）
 * - 從 SurveyResponseAnswer.answerText 與 answersJson 自由文字欄抽取
 * - 中英混寫皆可；不呼叫外部 API
 */
const { Op } = require('sequelize');
const { SurveyModuleResponse, SurveyResponseAnswer } = require('../models');
const { LEXICON } = require('../utils/surveySentimentLexicon');
const { mergeWhereWithScope } = require('./accessControl/surveyScopeGuard');

const SKIP_KEYS = new Set([
  'studentId',
  'studentName',
  'name',
  'email',
  'studentEmail',
  'department',
  '__legacyActivityType',
  'grade',
  'year',
  'class',
  'phone',
  'mobile',
  'id',
  'surveyId',
  'eventId',
  'semester',
  'semesterId',
  'activityType',
]);

const PREFERRED_OPEN_KEYS = new Set([
  'ability_description',
  'other_comments',
  'abilityDescription',
  'otherComments',
  'comments',
  'comment',
  'feedback',
  'suggestion',
  'suggestions',
  'other',
  'open_text',
  'remark',
  'remarks',
  'note',
  'notes',
  'opinion',
  'opinions',
]);

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

function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function looksLikeStudentId(s) {
  return /^[A-Za-z]?\d{6,12}$/.test(s);
}

function isOpenTextCandidate(key, value) {
  if (value == null) return false;
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (text.length < 2) return false;
  if (SKIP_KEYS.has(key)) return false;
  if (looksLikeEmail(text) || looksLikeStudentId(text)) return false;
  if (PREFERRED_OPEN_KEYS.has(key)) return true;
  // 一般文字欄：夠長才當開放意見，避免短選項（如「一年級」）
  if (text.length >= 10) return true;
  return false;
}

function tokenizeEnglish(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter(Boolean);
}

/**
 * @param {string} text
 * @returns {{ label: 'positive'|'neutral'|'negative', score: number, positiveHits: string[], negativeHits: string[], confidence: number }}
 */
function analyzeSentimentText(text) {
  const raw = String(text || '').trim();
  if (raw.length < 2) {
    return {
      label: 'neutral',
      score: 0,
      positiveHits: [],
      negativeHits: [],
      confidence: 0,
    };
  }

  let score = 0;
  const positiveHits = [];
  const negativeHits = [];
  const usedSpans = []; // { start, end }

  function overlaps(start, end) {
    return usedSpans.some((s) => !(end <= s.start || start >= s.end));
  }

  function mark(start, end) {
    usedSpans.push({ start, end });
  }

  function nearbyNegatorZh(index) {
    const window = raw.slice(Math.max(0, index - 4), index);
    return LEXICON.negatorsZh.some((n) => window.includes(n));
  }

  function nearbyIntensifierZh(index) {
    const window = raw.slice(Math.max(0, index - 4), index);
    return LEXICON.intensifiersZh.some((n) => window.includes(n));
  }

  // 中文片語（最長優先）
  for (const phrase of LEXICON.positiveZh) {
    let from = 0;
    while (from < raw.length) {
      const idx = raw.indexOf(phrase, from);
      if (idx < 0) break;
      const end = idx + phrase.length;
      if (!overlaps(idx, end)) {
        let delta = phrase.length >= 3 ? 2 : 1.2;
        if (nearbyIntensifierZh(idx)) delta *= 1.4;
        if (nearbyNegatorZh(idx)) {
          score -= delta;
          negativeHits.push(`¬${phrase}`);
        } else {
          score += delta;
          positiveHits.push(phrase);
        }
        mark(idx, end);
      }
      from = idx + phrase.length;
    }
  }

  for (const phrase of LEXICON.negativeZh) {
    let from = 0;
    while (from < raw.length) {
      const idx = raw.indexOf(phrase, from);
      if (idx < 0) break;
      const end = idx + phrase.length;
      if (!overlaps(idx, end)) {
        let delta = phrase.length >= 3 ? 2 : 1.2;
        if (nearbyIntensifierZh(idx)) delta *= 1.4;
        if (nearbyNegatorZh(idx)) {
          score += delta;
          positiveHits.push(`¬${phrase}`);
        } else {
          score -= delta;
          negativeHits.push(phrase);
        }
        mark(idx, end);
      }
      from = idx + phrase.length;
    }
  }

  // 英文詞
  const enTokens = tokenizeEnglish(raw);
  const intensifierSet = new Set(LEXICON.intensifiersEn);
  const negatorSet = new Set(LEXICON.negatorsEn);
  const posEn = new Set(LEXICON.positiveEn);
  const negEn = new Set(LEXICON.negativeEn);

  for (let i = 0; i < enTokens.length; i += 1) {
    const tok = enTokens[i];
    const prev = enTokens[i - 1] || '';
    const prev2 = enTokens[i - 2] || '';
    const negated = negatorSet.has(prev) || negatorSet.has(prev2) || prev.endsWith("n't");
    const intensified = intensifierSet.has(prev) || intensifierSet.has(prev2);
    let delta = 1.2;
    if (intensified) delta *= 1.4;

    if (posEn.has(tok)) {
      if (negated) {
        score -= delta;
        negativeHits.push(`¬${tok}`);
      } else {
        score += delta;
        positiveHits.push(tok);
      }
    } else if (negEn.has(tok)) {
      if (negated) {
        score += delta;
        positiveHits.push(`¬${tok}`);
      } else {
        score -= delta;
        negativeHits.push(tok);
      }
    }
  }

  const hitCount = positiveHits.length + negativeHits.length;
  let label = 'neutral';
  if (score >= 1.2) label = 'positive';
  else if (score <= -1.2) label = 'negative';

  const confidence = hitCount === 0
    ? 0
    : Math.min(1, Number((Math.abs(score) / (hitCount * 1.5)).toFixed(2)));

  return {
    label,
    score: Number(score.toFixed(2)),
    positiveHits: [...new Set(positiveHits)].slice(0, 12),
    negativeHits: [...new Set(negativeHits)].slice(0, 12),
    confidence,
  };
}

/**
 * 合併 answer rows + answersJson 開放題文字
 * @returns {Array<{ responseId: number|string, questionKey: string, answerText: string, createdAt?: Date|string|null, source: string }>}
 */
function mergeOpenTextRows({ answerRows = [], responses = [], questionKeyFilter = null }) {
  const map = new Map();

  const put = (row) => {
    const text = String(row.answerText || '').trim();
    if (text.length < 2) return;
    if (questionKeyFilter && row.questionKey !== questionKeyFilter) return;
    const key = `${row.responseId}::${row.questionKey}`;
    if (!map.has(key)) {
      map.set(key, {
        responseId: row.responseId,
        questionKey: row.questionKey,
        answerText: text,
        createdAt: row.createdAt || null,
        source: row.source || 'answer_row',
      });
    }
  };

  answerRows.forEach((r) => put({ ...r, source: 'answer_row' }));

  responses.forEach((r) => {
    const answers = r.answersJson && typeof r.answersJson === 'object' ? r.answersJson : {};
    Object.entries(answers).forEach(([qKey, value]) => {
      if (!isOpenTextCandidate(qKey, value)) return;
      put({
        responseId: r.id,
        questionKey: qKey,
        answerText: String(value).trim(),
        createdAt: r.submittedAt || r.createdAt || null,
        source: 'answers_json',
      });
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

async function collectOpenTextForAnalytics(query = {}) {
  const where = buildAnalyticsWhere(query);
  const responses = await SurveyModuleResponse.findAll({
    where,
    attributes: ['id', 'answersJson', 'submittedAt', 'createdAt'],
  });
  if (!responses.length) {
    return { total: 0, rows: [], responses: [] };
  }
  const ids = responses.map((r) => r.id);
  const answerWhere = { responseId: { [Op.in]: ids } };
  if (query.questionKey) answerWhere.questionKey = query.questionKey;
  const answerRows = await SurveyResponseAnswer.findAll({
    where: answerWhere,
    attributes: ['responseId', 'questionKey', 'answerText', 'createdAt'],
    raw: true,
  });
  const rows = mergeOpenTextRows({
    answerRows,
    responses: responses.map((r) => r.toJSON ? r.toJSON() : r),
    questionKeyFilter: query.questionKey || null,
  });
  const limit = Math.min(Number(query.limit) || 200, 500);
  return { total: rows.length, rows: rows.slice(0, limit), responses };
}

/**
 * @returns {Promise<{
 *   total: number,
 *   distribution: { positive: number, neutral: number, negative: number },
 *   percentages: { positive: number, neutral: number, negative: number },
 *   averageScore: number,
 *   byQuestion: Array<{ questionKey: string, total: number, positive: number, neutral: number, negative: number, averageScore: number }>,
 *   topPositiveTerms: Array<{ term: string, count: number }>,
 *   topNegativeTerms: Array<{ term: string, count: number }>,
 *   samples: Array<object>,
 *   method: string
 * }>}
 */
async function analyticsSentimentSummary(query = {}) {
  const { rows } = await collectOpenTextForAnalytics({
    ...query,
    limit: Math.min(Number(query.limit) || 200, 500),
  });

  const distribution = { positive: 0, neutral: 0, negative: 0 };
  const byQuestionMap = new Map();
  const posTermCount = {};
  const negTermCount = {};
  let scoreSum = 0;
  const samples = [];

  rows.forEach((row) => {
    const result = analyzeSentimentText(row.answerText);
    distribution[result.label] += 1;
    scoreSum += result.score;

    if (!byQuestionMap.has(row.questionKey)) {
      byQuestionMap.set(row.questionKey, {
        questionKey: row.questionKey,
        total: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        scoreSum: 0,
      });
    }
    const q = byQuestionMap.get(row.questionKey);
    q.total += 1;
    q[result.label] += 1;
    q.scoreSum += result.score;

    result.positiveHits.forEach((t) => {
      posTermCount[t] = (posTermCount[t] || 0) + 1;
    });
    result.negativeHits.forEach((t) => {
      negTermCount[t] = (negTermCount[t] || 0) + 1;
    });

    if (samples.length < 30) {
      samples.push({
        responseId: row.responseId,
        questionKey: row.questionKey,
        answerText: row.answerText.length > 280 ? `${row.answerText.slice(0, 280)}…` : row.answerText,
        label: result.label,
        score: result.score,
        confidence: result.confidence,
        positiveHits: result.positiveHits,
        negativeHits: result.negativeHits,
        source: row.source,
      });
    }
  });

  const total = rows.length;
  const pct = (n) => (total ? Number(((n / total) * 100).toFixed(1)) : 0);

  const toTop = (obj) => Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term, count]) => ({ term, count }));

  const byQuestion = Array.from(byQuestionMap.values())
    .map((q) => ({
      questionKey: q.questionKey,
      total: q.total,
      positive: q.positive,
      neutral: q.neutral,
      negative: q.negative,
      averageScore: q.total ? Number((q.scoreSum / q.total).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    total,
    distribution,
    percentages: {
      positive: pct(distribution.positive),
      neutral: pct(distribution.neutral),
      negative: pct(distribution.negative),
    },
    averageScore: total ? Number((scoreSum / total).toFixed(2)) : 0,
    byQuestion,
    topPositiveTerms: toTop(posTermCount),
    topNegativeTerms: toTop(negTermCount),
    samples,
    method: 'lexicon_zh_en_v1',
  };
}

module.exports = {
  analyzeSentimentText,
  mergeOpenTextRows,
  isOpenTextCandidate,
  collectOpenTextForAnalytics,
  analyticsSentimentSummary,
  SKIP_KEYS,
  PREFERRED_OPEN_KEYS,
};
