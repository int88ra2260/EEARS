const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const {
  Survey,
  SurveyVersion,
  SurveyRule,
  SurveyModuleResponse,
  SurveyAdminAuditLog,
  EnglishTableSurveyResponse,
  EnglishClubSurveyResponse,
} = require('../models');
const { validateSurveyData, processSurveyData } = require('../utils/surveyFormValidation');
const { getCurrentSemester, isValidSemester } = require('../utils/semester');
const { ruleTimeAllows, legacyModelForSurveyKey } = require('./surveyGateService');
const { mergeWhereWithScope } = require('./accessControl/surveyScopeGuard');

const surveysJsonPath = path.join(__dirname, '..', 'surveys.json');
const STUDENT_SURVEY_COPY = {
  english_table_feedback_114_1: {
    title: 'English Table Feedback Questionnaire',
    description: '英語桌活動回饋問卷，協助我們持續優化活動體驗。',
  },
  english_club_feedback_114_1: {
    title: 'English Club Feedback Questionnaire',
    description: 'English Club 活動回饋問卷，協助我們持續優化活動內容。',
  },
};

function loadSurveysFallback() {
  try {
    const raw = fs.readFileSync(surveysJsonPath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return { surveys: [] };
  }
}

const { sanitizeForAudit } = require('../utils/logSanitizer');

async function writeAudit(actorId, action, entityType, entityId, beforeJson, afterJson, summary) {
  await SurveyAdminAuditLog.create({
    actorId: actorId || null,
    action,
    entityType,
    entityId: entityId != null ? String(entityId) : null,
    beforeJson: beforeJson ? sanitizeForAudit(beforeJson) : null,
    afterJson: afterJson ? sanitizeForAudit(afterJson) : null,
    summary: summary || null,
  });
}

function normalizeSchema(schemaJson) {
  if (!schemaJson) return null;
  if (typeof schemaJson === 'string') {
    try {
      return JSON.parse(schemaJson);
    } catch (_) {
      return null;
    }
  }
  return schemaJson;
}

function normalizeStudentFacingSurveyConfig(surveyKey, rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object') return rawConfig;
  const copy = STUDENT_SURVEY_COPY[surveyKey];
  if (!copy) return rawConfig;
  return {
    ...rawConfig,
    title: copy.title,
    description: copy.description,
  };
}

/**
 * 取得前台應使用的已發布問卷結構（DB 優先，無則 surveys.json）
 */
async function getPublishedSurveyPackage(surveyKey) {
  const survey = await Survey.findOne({ where: { surveyKey } }).catch(() => null);
  const fallback = loadSurveysFallback();
  const fromJson = (fallback.surveys || []).find((s) => s.id === surveyKey);

  if (!survey || !survey.currentPublishedVersionId) {
    return fromJson
      ? {
          source: 'json_fallback',
          surveyKey,
          config: normalizeStudentFacingSurveyConfig(surveyKey, fromJson),
          surveyDbId: survey ? survey.id : null,
          versionId: null,
          versionNumber: null,
        }
      : null;
  }

  const ver = await SurveyVersion.findByPk(survey.currentPublishedVersionId).catch(() => null);
  if (!ver || ver.status !== 'published') {
    return fromJson
      ? {
          source: 'json_fallback',
          surveyDbId: survey.id,
          surveyKey,
          config: normalizeStudentFacingSurveyConfig(surveyKey, fromJson),
          versionId: null,
          versionNumber: null,
        }
      : null;
  }

  const config = normalizeSchema(ver.schemaJson);
  if (!config) {
    return fromJson
      ? {
          source: 'json_fallback',
          surveyDbId: survey.id,
          surveyKey,
          config: normalizeStudentFacingSurveyConfig(surveyKey, fromJson),
          versionId: null,
          versionNumber: null,
        }
      : null;
  }

  return {
    source: 'db',
    surveyKey,
    config: normalizeStudentFacingSurveyConfig(surveyKey, config),
    surveyDbId: survey.id,
    versionId: ver.id,
    versionNumber: ver.versionNumber,
    survey,
  };
}

async function getPublicStatusPayload(surveyKey) {
  const currentSemester = getCurrentSemester();
  const pkg = await getPublishedSurveyPackage(surveyKey);
  if (!pkg) {
    return { ok: false, code: 'not_found', message: '找不到問卷', currentSemester };
  }

  const survey = await Survey.findOne({ where: { surveyKey } }).catch(() => null);
  if (!survey) {
    return {
      ok: true,
      code: 'open',
      source: pkg.source,
      versionNumber: pkg.versionNumber,
      message: '可填寫',
      currentSemester,
    };
  }

  const rule = await SurveyRule.findOne({ where: { surveyId: survey.id } }).catch(() => null);
  if (!rule) {
    return {
      ok: true,
      code: 'open',
      source: pkg.source,
      versionNumber: pkg.versionNumber,
      message: '可填寫',
      currentSemester,
    };
  }

  if (!rule.isEnabled) {
    return { ok: false, code: 'disabled', message: '問卷未啟用', currentSemester };
  }

  const t = ruleTimeAllows(rule);
  if (!t.ok) {
    if (t.reason === 'not_started') {
      return {
        ok: false,
        code: 'not_started',
        message: '問卷尚未開始',
        startDate: rule.startDate,
        currentSemester,
      };
    }
    if (t.reason === 'ended') {
      return {
        ok: false,
        code: 'ended',
        message: '問卷已結束',
        endDate: rule.endDate,
        currentSemester,
      };
    }
  }

  if (!pkg.versionId && pkg.source === 'json_fallback') {
    return {
      ok: true,
      code: 'open',
      source: 'json_fallback',
      warning: '尚未發布 DB 版本，使用檔案後援',
      versionNumber: null,
      currentSemester,
    };
  }

  return {
    ok: true,
    code: 'open',
    source: pkg.source,
    versionNumber: pkg.versionNumber,
    message: '可填寫',
    currentSemester,
  };
}

async function assertSubmissionAllowed(surveyKey) {
  const st = await getPublicStatusPayload(surveyKey);
  if (!st.ok) {
    const err = new Error(st.message || '不可提交');
    err.statusCode = st.code === 'not_found' ? 404 : 403;
    err.code = st.code;
    throw err;
  }
  return st;
}

async function legacyDuplicateExists(surveyKey, studentId) {
  const sid = String(studentId || '').trim();
  if (!sid) return false;
  const M = legacyModelForSurveyKey(surveyKey);
  if (!M) return false;
  const semester = getCurrentSemester();
  const row = await M.findOne({ where: { studentId: sid, semester } });
  return !!row;
}

async function moduleDuplicateExists(surveyId, surveyKey, studentId, rule, body) {
  const sid = String(studentId || '').trim();
  if (!sid) return false;
  const policy = rule?.retakePolicy || 'once_ever';
  if (policy === 'unlimited') return false;

  if (policy === 'once_per_event') {
    const eid = body.eventId;
    if (eid == null) return false;
    const row = await SurveyModuleResponse.findOne({
      where: { surveyId, studentId: sid, status: 'completed', eventId: eid },
    });
    return !!row;
  }

  const semester = getCurrentSemester();
  const row = await SurveyModuleResponse.findOne({
    where: { surveyId, studentId: sid, status: 'completed', semester },
  });
  return !!row;
}

/**
 * 公開提交：寫入 legacy 表（ET/EC）+ survey_responses
 */
async function submitPublicResponse(surveyKey, body, req) {
  await assertSubmissionAllowed(surveyKey);

  const pkg = await getPublishedSurveyPackage(surveyKey);
  if (!pkg || !pkg.config) {
    const err = new Error('找不到問卷');
    err.statusCode = 404;
    throw err;
  }

  const surveyConfig = pkg.config;
  if (surveyConfig.id !== surveyKey) {
    const err = new Error('問卷設定不一致');
    err.statusCode = 500;
    throw err;
  }

  if (body.studentId !== undefined && body.studentId !== null) {
    const t = String(body.studentId).trim();
    if (!t) {
      const err = new Error('學號格式不正確');
      err.statusCode = 400;
      err.errorCode = 'INVALID_STUDENT_ID';
      throw err;
    }
  }

  let rule = null;
  if (pkg.surveyDbId) {
    rule = await SurveyRule.findOne({ where: { surveyId: pkg.surveyDbId } }).catch(() => null);
  }

  const validationResult = validateSurveyData(body, surveyConfig);
  if (!validationResult.isValid) {
    const err = new Error(validationResult.error);
    err.statusCode = 400;
    throw err;
  }

  if (body.studentId !== undefined && body.studentId !== null) {
    const trimmed = String(body.studentId).trim();
    if (trimmed) {
      const legDup = await legacyDuplicateExists(surveyKey, trimmed);
      if (legDup) {
        const err = new Error('您已填過此問卷');
        err.statusCode = 400;
        err.errorCode = 'SURVEY_ALREADY_FILLED';
        throw err;
      }
      if (pkg.surveyDbId && rule) {
        const modDup = await moduleDuplicateExists(pkg.surveyDbId, surveyKey, trimmed, rule, body);
        if (modDup) {
          const err = new Error('您已填過此問卷');
          err.statusCode = 400;
          err.errorCode = 'SURVEY_ALREADY_FILLED';
          throw err;
        }
      }
    }
  }

  const processedData = processSurveyData(body, surveyConfig);
  const semester = getCurrentSemester();
  processedData.semester = semester;

  let SurveyModel;
  if (surveyKey === 'english_table_feedback_114_1') {
    SurveyModel = EnglishTableSurveyResponse;
  } else if (surveyKey === 'english_club_feedback_114_1') {
    SurveyModel = EnglishClubSurveyResponse;
  } else {
    const err = new Error('不支援的問卷類型');
    err.statusCode = 400;
    throw err;
  }

  try {
    await SurveyModel.create(processedData);
  } catch (e) {
    if (e && e.name === 'SequelizeUniqueConstraintError') {
      const err = new Error('您已填過此問卷');
      err.statusCode = 400;
      err.errorCode = 'SURVEY_ALREADY_FILLED';
      throw err;
    }
    throw e;
  }

  if (pkg.surveyDbId) {
    let versionId = pkg.versionId;
    if (!versionId) {
      const published = await SurveyVersion.findOne({
        where: { surveyId: pkg.surveyDbId, status: 'published' },
        order: [['versionNumber', 'DESC']],
      }).catch(() => null);
      versionId = published?.id || null;
      if (!versionId) {
        const fallback = await SurveyVersion.findOne({
          where: { surveyId: pkg.surveyDbId },
          order: [['versionNumber', 'DESC']],
        }).catch(() => null);
        versionId = fallback?.id || null;
      }
    }
    if (versionId) {
      const activityType =
        surveyKey === 'english_table_feedback_114_1'
          ? 'English Table'
          : surveyKey === 'english_club_feedback_114_1'
            ? 'English Club'
            : body.eventType || null;
      const answersSnapshot = { ...body };
      await SurveyModuleResponse.create({
        surveyId: pkg.surveyDbId,
        surveyVersionId: versionId,
        studentId: body.studentId != null ? String(body.studentId).trim() : null,
        studentName: body.studentName || body.name || null,
        studentEmail: body.studentEmail || body.email || null,
        eventId: body.eventId != null ? Number(body.eventId) : null,
        eventType: body.eventType || activityType,
        activityType,
        semesterKey: semester,
        semester,
        submittedAt: new Date(),
        status: 'completed',
        submissionStatus: 'submitted',
        source: 'public_submit',
        answersJson: answersSnapshot,
        metadataJson: {
          ip: req?.ip,
          userAgent: req?.get?.('user-agent'),
        },
      }).catch((err) => {
        console.error('[submitPublicResponse] survey_responses dual-write failed:', err.message);
        return null;
      });
    }
  }

  const successMsg =
    (rule && rule.settingsJson && rule.settingsJson.successMessage) ||
    `${surveyConfig.title || '問卷'}已送出，謝謝您的回饋！`;

  return { message: successMsg };
}

async function listSurveysAdmin(options = {}) {
  const rows = await Survey.findAll({
    where: mergeWhereWithScope({}, options.__scopeWhere),
    order: [['updatedAt', 'DESC']],
  }).catch(() => []);
  const semester = getCurrentSemester();

  const out = [];
  for (const s of rows) {
    const key = s.surveyKey;
    const Legacy = legacyModelForSurveyKey(key);
    let legacyCount = 0;
    if (Legacy) {
      legacyCount = await Legacy.count({ where: { semester } }).catch(() => 0);
    }
    const moduleCount = await SurveyModuleResponse.count({ where: { surveyId: s.id, semester } }).catch(() => 0);
    const ver = s.currentPublishedVersionId
      ? await SurveyVersion.findByPk(s.currentPublishedVersionId).catch(() => null)
      : null;
    const rule = await SurveyRule.findOne({ where: { surveyId: s.id } }).catch(() => null);
    out.push({
      id: s.id,
      surveyKey: s.surveyKey,
      name: s.name,
      category: s.category,
      targetType: s.targetType,
      status: s.status,
      currentPublishedVersionId: s.currentPublishedVersionId,
      publishedVersionNumber: ver ? ver.versionNumber : null,
      isEnabled: rule ? rule.isEnabled : null,
      isRequired: rule ? rule.isRequired : null,
      responseCount: Math.max(legacyCount, moduleCount),
      updatedAt: s.updatedAt,
    });
  }
  return out;
}

async function createSurvey(payload, actorId) {
  const row = await Survey.create({
    surveyKey: payload.surveyKey,
    name: payload.name,
    description: payload.description || null,
    category: payload.category || null,
    targetType: payload.targetType || null,
    status: payload.status || 'draft',
    createdBy: actorId || null,
    updatedBy: actorId || null,
  });
  await writeAudit(actorId, 'create', 'Survey', row.id, null, row.toJSON(), `create survey ${row.surveyKey}`);
  return row;
}

async function updateSurvey(id, payload, actorId) {
  const row = await Survey.findByPk(id);
  if (!row) return null;
  const before = row.toJSON();
  await row.update({
    name: payload.name != null ? payload.name : row.name,
    description: payload.description !== undefined ? payload.description : row.description,
    category: payload.category !== undefined ? payload.category : row.category,
    targetType: payload.targetType !== undefined ? payload.targetType : row.targetType,
    status: payload.status != null ? payload.status : row.status,
    updatedBy: actorId || null,
  });
  await writeAudit(actorId, 'update', 'Survey', id, before, row.toJSON(), `update survey ${row.surveyKey}`);
  return row;
}

async function listVersions(surveyId) {
  return SurveyVersion.findAll({
    where: { surveyId },
    order: [['versionNumber', 'DESC']],
  });
}

async function createVersion(surveyId, payload, actorId) {
  const survey = await Survey.findByPk(surveyId);
  if (!survey) return null;
  const maxRow = await SurveyVersion.findOne({
    where: { surveyId },
    order: [['versionNumber', 'DESC']],
  });
  const nextNum = maxRow ? maxRow.versionNumber + 1 : 1;
  const schema = payload.schemaJson != null ? payload.schemaJson : { id: survey.surveyKey, title: survey.name, questions: [] };
  const ver = await SurveyVersion.create({
    surveyId,
    versionNumber: nextNum,
    schemaJson: schema,
    changeSummary: payload.changeSummary || null,
    status: 'draft',
    createdBy: actorId || null,
  });
  await writeAudit(actorId, 'create_version', 'SurveyVersion', ver.id, null, { surveyId, versionNumber: nextNum }, 'draft version');
  return ver;
}

async function updateVersion(surveyId, versionId, payload, actorId) {
  const ver = await SurveyVersion.findOne({ where: { id: versionId, surveyId } });
  if (!ver) return null;
  if (ver.status === 'published') {
    const err = new Error('已發布版本不可修改內容');
    err.statusCode = 400;
    throw err;
  }
  const before = ver.toJSON();
  await ver.update({
    schemaJson: payload.schemaJson != null ? payload.schemaJson : ver.schemaJson,
    changeSummary: payload.changeSummary !== undefined ? payload.changeSummary : ver.changeSummary,
  });
  await writeAudit(actorId, 'update_version', 'SurveyVersion', versionId, before, ver.toJSON(), 'update draft schema');
  return ver;
}

async function publishVersion(surveyId, versionId, actorId) {
  const survey = await Survey.findByPk(surveyId);
  const ver = await SurveyVersion.findOne({ where: { id: versionId, surveyId } });
  if (!survey || !ver) return null;

  await SurveyVersion.update(
    { status: 'archived' },
    { where: { surveyId, status: 'published', id: { [Op.ne]: versionId } } }
  );

  const beforeSurvey = survey.toJSON();
  await ver.update({
    status: 'published',
    publishedAt: new Date(),
    publishedBy: actorId || null,
  });
  await survey.update({
    currentPublishedVersionId: ver.id,
    updatedBy: actorId || null,
  });

  await writeAudit(
    actorId,
    'publish',
    'SurveyVersion',
    versionId,
    beforeSurvey,
    { currentPublishedVersionId: ver.id, versionNumber: ver.versionNumber },
    `publish v${ver.versionNumber}`
  );
  return { survey, version: ver };
}

async function getRules(surveyId) {
  return SurveyRule.findOne({ where: { surveyId } });
}

async function putRules(surveyId, payload, actorId) {
  let rule = await SurveyRule.findOne({ where: { surveyId } });
  const before = rule ? rule.toJSON() : null;
  if (!rule) {
    rule = await SurveyRule.create({
      surveyId,
      isEnabled: payload.isEnabled !== false,
      isRequired: payload.isRequired !== false,
      startDate: payload.startDate || null,
      endDate: payload.endDate || null,
      gatingMode: payload.gatingMode || 'reservation',
      retakePolicy: payload.retakePolicy || 'once_ever',
      retakeScope: payload.retakeScope || null,
      semesterKey: payload.semesterKey || null,
      targetEventType: payload.targetEventType || null,
      targetEventId: payload.targetEventId || null,
      collectStudentId: payload.collectStudentId !== false,
      collectStudentName: payload.collectStudentName !== false,
      collectStudentEmail: payload.collectStudentEmail !== false,
      allowEditAfterSubmit: !!payload.allowEditAfterSubmit,
      isAnonymous: !!payload.isAnonymous,
      settingsJson: payload.settingsJson || null,
      updatedBy: actorId || null,
    });
  } else {
    await rule.update({
      isEnabled: payload.isEnabled !== undefined ? payload.isEnabled : rule.isEnabled,
      isRequired: payload.isRequired !== undefined ? payload.isRequired : rule.isRequired,
      startDate: payload.startDate !== undefined ? payload.startDate : rule.startDate,
      endDate: payload.endDate !== undefined ? payload.endDate : rule.endDate,
      gatingMode: payload.gatingMode || rule.gatingMode,
      retakePolicy: payload.retakePolicy || rule.retakePolicy,
      retakeScope: payload.retakeScope !== undefined ? payload.retakeScope : rule.retakeScope,
      semesterKey: payload.semesterKey !== undefined ? payload.semesterKey : rule.semesterKey,
      targetEventType: payload.targetEventType !== undefined ? payload.targetEventType : rule.targetEventType,
      targetEventId: payload.targetEventId !== undefined ? payload.targetEventId : rule.targetEventId,
      collectStudentId: payload.collectStudentId !== undefined ? payload.collectStudentId : rule.collectStudentId,
      collectStudentName: payload.collectStudentName !== undefined ? payload.collectStudentName : rule.collectStudentName,
      collectStudentEmail: payload.collectStudentEmail !== undefined ? payload.collectStudentEmail : rule.collectStudentEmail,
      allowEditAfterSubmit:
        payload.allowEditAfterSubmit !== undefined ? payload.allowEditAfterSubmit : rule.allowEditAfterSubmit,
      isAnonymous: payload.isAnonymous !== undefined ? payload.isAnonymous : rule.isAnonymous,
      settingsJson: payload.settingsJson !== undefined ? payload.settingsJson : rule.settingsJson,
      updatedBy: actorId || null,
    });
  }
  await writeAudit(actorId, 'update_rules', 'SurveyRule', surveyId, before, rule.toJSON(), 'survey rules');
  return rule;
}

function resolveQuerySemester(query) {
  if (query && query.semester && isValidSemester(query.semester)) {
    return query.semester;
  }
  return getCurrentSemester();
}

async function listResponses(surveyId, query) {
  const where = { surveyId };
  where.semester = resolveQuerySemester(query);
  if (query.versionId) where.surveyVersionId = query.versionId;
  if (query.studentId) where.studentId = query.studentId;
  if (query.eventType) where.eventType = query.eventType;
  if (query.from || query.to) {
    where.submittedAt = {};
    if (query.from) where.submittedAt[Op.gte] = new Date(query.from);
    if (query.to) where.submittedAt[Op.lte] = new Date(query.to);
  }

  const scopedWhere = mergeWhereWithScope(where, query.__scopeWhere);
  const { rows, count } = await SurveyModuleResponse.findAndCountAll({
    where: scopedWhere,
    order: [['submittedAt', 'DESC']],
    limit: Math.min(Number(query.limit) || 50, 200),
    offset: Number(query.offset) || 0,
  });
  const { maskSurveyResponseListForAdminApi } = require('../utils/surveyResponseApiMask');
  const mapped = rows.map((r) => r.toJSON());
  const rowsOut = query.__forExport ? mapped : maskSurveyResponseListForAdminApi(mapped);
  return { rows: rowsOut, count, semester: where.semester };
}

async function analyticsSummary(surveyId, query = {}) {
  const semester = resolveQuerySemester(query);
  const baseWhere = mergeWhereWithScope({ surveyId, status: 'completed', semester }, query.__scopeWhere);
  const total = await SurveyModuleResponse.count({ where: baseWhere });
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const last7 = await SurveyModuleResponse.count({
    where: mergeWhereWithScope({ surveyId, status: 'completed', semester, submittedAt: { [Op.gte]: sevenDaysAgo } }, query.__scopeWhere),
  });
  return {
    semester,
    totalResponses: total,
    last7Days: last7,
    completionRateNote: '完成率需搭配預約人數，此處僅統計已提交筆數',
  };
}

async function analyticsQuestions(surveyId, query = {}) {
  const semester = resolveQuerySemester(query);
  const survey = await Survey.findByPk(surveyId);
  if (!survey || !survey.currentPublishedVersionId) return { semester, questions: [] };
  const ver = await SurveyVersion.findByPk(survey.currentPublishedVersionId).catch(() => null);
  const schema = normalizeSchema(ver?.schemaJson);
  const questions = schema?.questions || [];
  const rows = await SurveyModuleResponse.findAll({
    where: mergeWhereWithScope({ surveyId, status: 'completed', semester }, query.__scopeWhere),
    attributes: ['answersJson'],
  });

  const distributions = [];
  for (const q of questions) {
    if (q.type === 'likert' || q.type === 'radio') {
      const dist = {};
      for (const r of rows) {
        const a = r.answersJson && r.answersJson[q.id];
        if (a == null) continue;
        const k = String(a);
        dist[k] = (dist[k] || 0) + 1;
      }
      distributions.push({ id: q.id, label: q.label, type: q.type, distribution: dist });
    }
    if (q.type === 'checkbox') {
      const dist = {};
      for (const r of rows) {
        const a = r.answersJson && r.answersJson[q.id];
        const arr = Array.isArray(a) ? a : a != null ? [a] : [];
        for (const x of arr) {
          const k = String(x);
          dist[k] = (dist[k] || 0) + 1;
        }
      }
      distributions.push({ id: q.id, label: q.label, type: q.type, distribution: dist });
    }
  }
  return { semester, questions: distributions };
}

async function exportSurveyResponses(surveyId, query, res, actorId) {
  const { rows } = await listResponses(surveyId, { ...query, limit: 10000, offset: 0, __forExport: true });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('responses');
  ws.columns = [
    { header: 'id', key: 'id', width: 8 },
    { header: 'surveyVersionId', key: 'surveyVersionId', width: 10 },
    { header: 'semester', key: 'semester', width: 10 },
    { header: 'studentId', key: 'studentId', width: 15 },
    { header: 'submittedAt', key: 'submittedAt', width: 22 },
    { header: 'answersJson', key: 'answersJson', width: 80 },
  ];
  for (const r of rows) {
    ws.addRow({
      id: r.id,
      surveyVersionId: r.surveyVersionId,
      semester: r.semester,
      studentId: r.studentId,
      submittedAt: r.submittedAt,
      answersJson: typeof r.answersJson === 'object' ? JSON.stringify(r.answersJson) : r.answersJson,
    });
  }
  await writeAudit(actorId, 'export', 'SurveyModuleResponse', surveyId, null, { count: rows.length }, 'export survey responses');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="survey-responses.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}

async function exportSurveyPackageJson(surveyId, actorId) {
  const { SurveyRule } = require('../models');
  const survey = await Survey.findByPk(surveyId);
  if (!survey) return null;

  const [rule, versions] = await Promise.all([
    SurveyRule.findOne({ where: { surveyId } }).catch(() => null),
    listVersions(surveyId).catch(() => []),
  ]);

  const publishedVersion =
    survey.currentPublishedVersionId != null
      ? await SurveyVersion.findByPk(survey.currentPublishedVersionId).catch(() => null)
      : null;

  const pkg = {
    exportedAt: new Date().toISOString(),
    survey: survey.toJSON(),
    rule: rule ? rule.toJSON() : null,
    publishedVersion: publishedVersion ? publishedVersion.toJSON() : null,
    versions: Array.isArray(versions) ? versions.map((v) => v.toJSON()) : [],
  };

  await writeAudit(actorId, 'export_json', 'Survey', surveyId, null, { versionCount: pkg.versions.length }, 'export survey package json');
  return pkg;
}

module.exports = {
  getPublishedSurveyPackage,
  getPublicStatusPayload,
  resolveQuerySemester,
  submitPublicResponse,
  listSurveysAdmin,
  createSurvey,
  updateSurvey,
  listVersions,
  createVersion,
  updateVersion,
  publishVersion,
  getRules,
  putRules,
  listResponses,
  analyticsSummary,
  analyticsQuestions,
  exportSurveyResponses,
  exportSurveyPackageJson,
  writeAudit,
};
