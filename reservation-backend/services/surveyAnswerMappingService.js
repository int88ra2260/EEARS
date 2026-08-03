const { Op } = require('sequelize');
const { SurveyAnswerMapping, SurveyVersion, SurveyModuleResponse } = require('../models');

function normalizeKey(s = '') {
  return String(s || '').trim().toLowerCase().replace(/[\s_\-]/g, '');
}

async function listMappings(query = {}) {
  const where = {};
  if (query.surveyId) where.surveyId = query.surveyId;
  if (query.surveyVersionId) where.surveyVersionId = query.surveyVersionId;
  if (query.status && query.status !== 'all') where.status = query.status;
  if (query.sourceQuestionKey) where.sourceQuestionKey = { [Op.like]: `%${query.sourceQuestionKey}%` };
  if (query.targetQuestionKey) where.targetQuestionKey = { [Op.like]: `%${query.targetQuestionKey}%` };
  return SurveyAnswerMapping.findAll({ where, order: [['updatedAt', 'DESC']], limit: 500 });
}

async function createMapping(payload, userId) {
  return SurveyAnswerMapping.create({
    ...payload,
    createdBy: userId || null,
    status: payload.status || 'pending',
    isApproved: payload.isApproved || false,
  });
}

async function updateMapping(id, payload) {
  const row = await SurveyAnswerMapping.findByPk(id);
  if (!row) return null;
  await row.update(payload);
  return row;
}

async function approveMapping(id, userId) {
  const row = await SurveyAnswerMapping.findByPk(id);
  if (!row) return null;
  await row.update({
    status: 'approved',
    isApproved: true,
    approvedBy: userId || null,
    approvedAt: new Date(),
  });
  return row;
}

async function rejectMapping(id, userId, notes = null) {
  const row = await SurveyAnswerMapping.findByPk(id);
  if (!row) return null;
  await row.update({
    status: 'rejected',
    isApproved: false,
    approvedBy: userId || null,
    approvedAt: new Date(),
    notes: notes != null ? notes : row.notes,
  });
  return row;
}

async function applyMappingsToAnswer(answer, surveyId = null, surveyVersionId = null) {
  const mappings = await SurveyAnswerMapping.findAll({
    where: {
      status: 'approved',
      isApproved: true,
      [Op.or]: [{ surveyId: surveyId || null }, { surveyId: null }],
      [Op.or]: [{ surveyVersionId: surveyVersionId || null }, { surveyVersionId: null }],
    },
  });
  const source = normalizeKey(answer.questionKey);
  const hit = mappings.find((m) => normalizeKey(m.sourceQuestionKey) === source);
  if (!hit) return { mapped: false, questionKey: answer.questionKey, mapping: null };
  return { mapped: true, questionKey: hit.targetQuestionKey, mapping: hit };
}

async function generateProposals({ surveyId, surveyVersionId }) {
  const version = surveyVersionId ? await SurveyVersion.findByPk(surveyVersionId) : null;
  const questions = Array.isArray(version?.schemaJson?.questions) ? version.schemaJson.questions : [];
  const questionKeys = questions.map((q) => q.id);
  const responses = await SurveyModuleResponse.findAll({
    where: { ...(surveyId ? { surveyId } : {}), ...(surveyVersionId ? { surveyVersionId } : {}) },
    limit: 200,
    order: [['updatedAt', 'DESC']],
  });
  const sourceKeys = new Set();
  responses.forEach((r) => {
    const obj = r.answersJson && typeof r.answersJson === 'object' ? r.answersJson : {};
    Object.keys(obj).forEach((k) => sourceKeys.add(k));
  });

  const proposals = [];
  sourceKeys.forEach((sk) => {
    if (questionKeys.includes(sk)) return;
    const nsk = normalizeKey(sk);
    const exact = questionKeys.find((tk) => normalizeKey(tk) === nsk);
    if (exact) {
      proposals.push({
        surveyId: surveyId || null,
        surveyVersionId: surveyVersionId || null,
        sourceQuestionKey: sk,
        targetQuestionKey: exact,
        mappingType: 'exact',
        confidenceScore: 0.99,
        status: 'pending',
      });
      return;
    }
    const fuzzy = questionKeys.find((tk) => normalizeKey(tk).includes(nsk) || nsk.includes(normalizeKey(tk)));
    if (fuzzy) {
      proposals.push({
        surveyId: surveyId || null,
        surveyVersionId: surveyVersionId || null,
        sourceQuestionKey: sk,
        targetQuestionKey: fuzzy,
        mappingType: 'heuristic',
        confidenceScore: 0.7,
        status: 'pending',
      });
    }
  });
  return proposals;
}

/**
 * 建立／核准標準舊版欄位 → schema 題號對照（全系統或指定問卷）
 */
async function bootstrapStandardAnswerMappings({ surveyId = null, userId = null, dryRun = true } = {}) {
  const created = [];
  const skipped = [];

  const canonicalSources = [
    { sourceQuestionKey: 'interviewEmail', targetQuestionKey: 'interview_email' },
    { sourceQuestionKey: 'timesThisSemester', targetQuestionKey: 'times_this_semester' },
    { sourceQuestionKey: 'reasonAttend', targetQuestionKey: 'reason_attend' },
    { sourceQuestionKey: 'informationChannel', targetQuestionKey: 'information_channel' },
    { sourceQuestionKey: 'abilityImproved', targetQuestionKey: 'ability_improved' },
    { sourceQuestionKey: 'abilityDescription', targetQuestionKey: 'ability_description' },
    { sourceQuestionKey: 'otherComments', targetQuestionKey: 'other_comments' },
  ];

  for (const row of canonicalSources) {
    const where = {
      sourceQuestionKey: row.sourceQuestionKey,
      targetQuestionKey: row.targetQuestionKey,
      ...(surveyId ? { surveyId } : {}),
    };
    const existing = await SurveyAnswerMapping.findOne({ where });
    if (existing) {
      skipped.push({ ...row, id: existing.id, status: existing.status });
      if (!dryRun && existing.status !== 'approved') {
        await approveMapping(existing.id, userId);
        created.push({ ...row, id: existing.id, action: 'approved_existing' });
      }
      continue;
    }
    if (dryRun) {
      created.push({ ...row, action: 'would_create' });
      continue;
    }
    const mapping = await createMapping(
      {
        surveyId: surveyId || null,
        surveyVersionId: null,
        ...row,
        mappingType: 'deprecated_key_alias',
        confidenceScore: 0.99,
        status: 'approved',
        isApproved: true,
        notes: 'Bootstrap standard alias mapping',
      },
      userId
    );
    await approveMapping(mapping.id, userId);
    created.push({ ...row, id: mapping.id, action: 'created' });
  }

  return { dryRun, surveyId, created, skipped };
}

module.exports = {
  listMappings,
  createMapping,
  updateMapping,
  approveMapping,
  rejectMapping,
  applyMappingsToAnswer,
  generateProposals,
  bootstrapStandardAnswerMappings,
};
