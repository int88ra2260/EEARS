'use strict';

const { Op } = require('sequelize');
const { Event, SurveyModuleResponse, SurveyResponseAnswer, SurveyVersion } = require('../models');
const {
  flattenAnswerIndex,
  indexAnswersByResponse,
  normalizeResponseId,
  readSchemaQuestions,
} = require('../utils/surveyAssociationMath');

const ANSWER_ID_CHUNK = 500;

async function loadVersionContext(versionId) {
  const id = Number(versionId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const version = await SurveyVersion.findByPk(id);
  if (!version) return null;
  const plain = version.toJSON ? version.toJSON() : version;
  return {
    version: plain,
    questions: readSchemaQuestions(plain.schemaJson),
  };
}

async function findAnswerRows(ids, questionKeys) {
  if (!ids.length || !questionKeys.length) return [];
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += ANSWER_ID_CHUNK) {
    const slice = ids.slice(offset, offset + ANSWER_ID_CHUNK);
    const part = await SurveyResponseAnswer.findAll({
      where: {
        responseId: { [Op.in]: slice },
        questionKey: { [Op.in]: questionKeys },
      },
      attributes: ['responseId', 'questionKey', 'answerText', 'answerJson', 'scoreValue'],
      raw: true,
    });
    rows.push(...part);
  }
  return rows;
}

async function loadAssociationRecords({ where, questions = [] }) {
  const responses = await SurveyModuleResponse.findAll({
    where,
    attributes: ['id', 'activityType', 'eventId', 'semester', 'answersJson'],
    raw: true,
  });
  const ids = responses.map((row) => row.id);
  const questionKeys = questions.map((question) => question.id);
  const answerRows = await findAnswerRows(ids, questionKeys);
  const index = indexAnswersByResponse({ responses, answerRows, schemaQuestions: questions });
  const eventIds = [...new Set(responses.map((row) => row.eventId).filter((id) => id != null && id !== ''))];
  let eventLabels = {};
  if (eventIds.length) {
    const events = await Event.findAll({
      where: { id: { [Op.in]: eventIds } },
      attributes: ['id', 'name'],
      raw: true,
    });
    eventLabels = Object.fromEntries(events.map((event) => [String(event.id), event.name]));
  }
  const records = responses.map((row) => ({
    responseId: row.id,
    activityType: row.activityType,
    eventId: row.eventId,
    semester: row.semester,
    answers: index.get(normalizeResponseId(row.id)) || {},
  }));
  return { records, eventLabels, index };
}

async function loadFlatAnswers(where, questions) {
  const { index } = await loadAssociationRecords({ where, questions });
  return flattenAnswerIndex(index, questions);
}

module.exports = {
  loadAssociationRecords,
  loadFlatAnswers,
  loadVersionContext,
};
