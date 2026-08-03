'use strict';

const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const {
  Survey,
  SurveyVersion,
  Semester,
  SurveyModuleResponse,
  EnglishTableSurveyResponse,
  EnglishClubSurveyResponse,
} = require('../models');
const { SEMESTER_RANGES, SEMESTER_ORDER } = require('../utils/semesterConstants');
const { isValidSemester } = require('../utils/semester');

const SURVEY_SPECS = [
  {
    surveyKey: 'english_table_feedback_114_1',
    activityType: 'English Table',
    legacyModel: EnglishTableSurveyResponse,
  },
  {
    surveyKey: 'english_club_feedback_114_1',
    activityType: 'English Club',
    legacyModel: EnglishClubSurveyResponse,
  },
];

function loadSurveyJsonByKey(surveyKey) {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'surveys.json'), 'utf8');
    const cfg = JSON.parse(raw);
    return (cfg.surveys || []).find((s) => s.id === surveyKey) || null;
  } catch (_) {
    return null;
  }
}

function legacyRowToAnswersJson(row, activityType) {
  const plain = row.toJSON ? row.toJSON() : { ...row };
  const skip = new Set(['id', 'createdAt', 'updatedAt', 'semester']);
  const answers = {};
  Object.keys(plain).forEach((k) => {
    if (skip.has(k)) return;
    if (plain[k] !== undefined && plain[k] !== null) answers[k] = plain[k];
  });
  answers.__legacyActivityType = activityType;
  return answers;
}

async function ensureSemesterRows() {
  const existing = await Semester.findAll({ attributes: ['code'] });
  const have = new Set(existing.map((r) => r.code));
  let created = 0;
  for (const code of SEMESTER_ORDER) {
    if (have.has(code)) continue;
    const range = SEMESTER_RANGES[code];
    if (!range) continue;
    await Semester.create({
      code,
      name: code,
      startDate: range.start,
      endDate: range.end,
    });
    created += 1;
  }
  return { created, total: await Semester.count() };
}

async function ensureSurveyWithPublishedVersion(spec) {
  const json = loadSurveyJsonByKey(spec.surveyKey);
  let survey = await Survey.findOne({ where: { surveyKey: spec.surveyKey } });
  if (!survey) {
    survey = await Survey.create({
      surveyKey: spec.surveyKey,
      code: spec.surveyKey,
      name: json?.title || spec.surveyKey,
      title: json?.title || spec.surveyKey,
      description: json?.description || null,
      category: 'feedback',
      targetType: spec.activityType,
      status: 'active',
    });
  }

  let version = null;
  if (survey.currentPublishedVersionId) {
    version = await SurveyVersion.findByPk(survey.currentPublishedVersionId);
  }
  if (!version) {
    version = await SurveyVersion.findOne({
      where: { surveyId: survey.id, status: 'published' },
      order: [['versionNumber', 'DESC']],
    });
  }
  if (!version && json) {
    version = await SurveyVersion.create({
      surveyId: survey.id,
      versionNumber: 1,
      schemaJson: json,
      changeSummary: 'Bootstrap from surveys.json (legacy sync)',
      status: 'published',
      isPublished: true,
      publishedAt: new Date(),
    });
    await survey.update({ currentPublishedVersionId: version.id, currentVersionId: version.id });
  } else if (version && !survey.currentPublishedVersionId) {
    await survey.update({ currentPublishedVersionId: version.id, currentVersionId: version.id });
  }

  return { survey, version };
}

async function resolveSemesterId(semesterCode) {
  if (!isValidSemester(semesterCode)) return null;
  const row = await Semester.findOne({ where: { code: semesterCode } });
  return row?.id || null;
}

/**
 * 將 legacy english_* 填答同步至 survey_responses（冪等：同 surveyId+studentId+semester 跳過）
 */
async function syncLegacyResponsesToModule({ semester, dryRun = true } = {}) {
  const semesterFilter = semester && isValidSemester(semester) ? semester : null;
  const stats = {
    dryRun,
    semester: semesterFilter || 'all',
    semesterBootstrap: null,
    surveys: [],
    inserted: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    errors: [],
  };

  if (!dryRun) {
    stats.semesterBootstrap = await ensureSemesterRows();
  }

  for (const spec of SURVEY_SPECS) {
    const surveyReport = { surveyKey: spec.surveyKey, activityType: spec.activityType, processed: 0, inserted: 0, skipped: 0 };
    let survey;
    let version;
    if (!dryRun) {
      const ready = await ensureSurveyWithPublishedVersion(spec);
      survey = ready.survey;
      version = ready.version;
      if (!version) {
        stats.errors.push({ surveyKey: spec.surveyKey, message: 'no published version' });
        stats.surveys.push(surveyReport);
        continue;
      }
    } else {
      survey = await Survey.findOne({ where: { surveyKey: spec.surveyKey } });
      if (!survey) {
        surveyReport.note = 'survey row missing (will be created on execute)';
      }
    }

    const legacyWhere = semesterFilter ? { semester: semesterFilter } : {};
    const legacyRows = await spec.legacyModel.findAll({ where: legacyWhere, order: [['id', 'ASC']] });
    surveyReport.legacyCount = legacyRows.length;

    for (const row of legacyRows) {
      surveyReport.processed += 1;
      const studentId = String(row.studentId || '').trim();
      const sem = row.semester;
      if (!studentId || !isValidSemester(sem)) {
        stats.skippedInvalid += 1;
        surveyReport.skipped += 1;
        continue;
      }

      if (dryRun) {
        stats.inserted += 1;
        surveyReport.inserted += 1;
        continue;
      }

      const semesterId = await resolveSemesterId(sem);
      const existing = await SurveyModuleResponse.findOne({
        where: {
          surveyId: survey.id,
          studentId,
          semester: sem,
        },
      });
      if (existing) {
        stats.skippedExisting += 1;
        surveyReport.skipped += 1;
        continue;
      }

      try {
        await SurveyModuleResponse.create({
          surveyId: survey.id,
          surveyVersionId: version.id,
          semesterId,
          studentId,
          studentName: row.name || null,
          studentEmail: row.email || null,
          activityType: spec.activityType,
          eventType: spec.activityType,
          semesterKey: sem,
          semester: sem,
          submittedAt: row.createdAt || new Date(),
          status: 'completed',
          submissionStatus: 'submitted',
          source: 'legacy_backfill',
          answersJson: legacyRowToAnswersJson(row, spec.activityType),
          metadataJson: { legacyTableId: row.id, syncedAt: new Date().toISOString() },
        });
        stats.inserted += 1;
        surveyReport.inserted += 1;
      } catch (e) {
        stats.errors.push({ surveyKey: spec.surveyKey, legacyId: row.id, message: e.message });
      }
    }
    stats.surveys.push(surveyReport);
  }

  return stats;
}

module.exports = {
  ensureSemesterRows,
  ensureSurveyWithPublishedVersion,
  syncLegacyResponsesToModule,
  SURVEY_SPECS,
};
