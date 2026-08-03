'use strict';

const { Op } = require('sequelize');
const { Survey, SurveyModuleResponse, Event } = require('../../models');
const { buildAccessProfile } = require('../../auth/accessProfile');
const { SCOPE } = require('../../auth/scopes');
const { P } = require('../../auth/permissions');
const { normalizeEventTypeForScope, assertCanAccessEvent } = require('./eventScopeGuard');

const ET_EVENT_TYPE = 'English Table';
const EC_EVENT_TYPE = 'English Club';

function norm(v) {
  return String(v || '').trim();
}

function normLower(v) {
  return norm(v).toLowerCase();
}

function denied(code = 'SURVEY_SCOPE_DENIED', message = '您沒有存取此問卷資料的權限。') {
  return { allowed: false, code, message };
}

function isExecutiveProfile(profile) {
  return profile.role === 'teacher' && profile.teacherLevel === 'executive';
}

function isEtManagerProfile(profile) {
  return profile.role === 'teacher' && profile.teacherLevel === 'et_manager';
}

function isJtManagerProfile(profile) {
  return profile.role === 'teacher' && profile.teacherLevel === 'jt_manager';
}

function hasEtSurveyScope(profile) {
  return profile.finalScopes.includes(SCOPE.SURVEY_ENGLISH_TABLE) || profile.finalScopes.includes(SCOPE.ENGLISH_TABLE);
}

function hasEcSurveyScope(profile) {
  return profile.finalScopes.includes(SCOPE.SURVEY_ENGLISH_CLUB) || profile.finalScopes.includes(SCOPE.ENGLISH_CLUB);
}

function isEnglishTableSurveyLike(survey) {
  const fields = [
    survey?.surveyKey,
    survey?.code,
    survey?.name,
    survey?.title,
    survey?.category,
    survey?.targetType,
    survey?.activityType,
  ].map(normLower);
  return fields.some((value) => (
    value === 'english table' ||
    value === 'english_table' ||
    value.includes('english table') ||
    value.includes('english_table') ||
    value.includes('et_')
  ));
}

function isEnglishClubSurveyLike(survey) {
  const fields = [
    survey?.surveyKey,
    survey?.code,
    survey?.name,
    survey?.title,
    survey?.category,
    survey?.targetType,
    survey?.activityType,
  ].map(normLower);
  return fields.some((value) => (
    value === 'english club' ||
    value === 'english_club' ||
    value.includes('english club') ||
    value.includes('english_club')
  ));
}

function isEnglishTableActivity(value) {
  const normalized = normalizeEventTypeForScope(value);
  if (normalized.scope === SCOPE.ENGLISH_TABLE) return true;
  return normLower(value).includes('english_table') || normLower(value) === 'english table';
}

function isEnglishClubActivity(value) {
  const normalized = normalizeEventTypeForScope(value);
  if (normalized.scope === SCOPE.ENGLISH_CLUB) return true;
  return normLower(value).includes('english_club') || normLower(value) === 'english club';
}

function hasSurveyViewPermission(profile) {
  return profile.permissionSet.has(P.CAN_VIEW_SURVEYS)
    || profile.permissionSet.has(P.CAN_EXPORT_SURVEYS);
}

function profileCanUseSurveyScope(user) {
  const profile = buildAccessProfile(user);
  if (profile.role === 'worker') {
    return { profile, allowed: false };
  }
  if (profile.isAdmin || isExecutiveProfile(profile)) {
    return { profile, allowed: true, unrestricted: true };
  }
  if (profile.finalScopes.includes(SCOPE.ALL)) {
    if (hasSurveyViewPermission(profile)) {
      return { profile, allowed: true, unrestricted: true };
    }
    return { profile, allowed: false };
  }
  if (profile.role === 'office_staff') {
    return { profile, allowed: false };
  }
  if (
    (isEtManagerProfile(profile) || isJtManagerProfile(profile))
    && (hasEtSurveyScope(profile) || hasEcSurveyScope(profile))
  ) {
    return {
      profile,
      allowed: true,
      unrestricted: false,
      allowEt: hasEtSurveyScope(profile),
      allowEc: hasEcSurveyScope(profile),
      scope: SCOPE.SURVEY_ENGLISH_TABLE,
    };
  }
  return { profile, allowed: false };
}

function canAccessSurveyByRecord(user, survey) {
  const scope = profileCanUseSurveyScope(user);
  if (!survey) return denied('MISSING_SURVEY_CONTEXT', '此操作需要指定問卷或資料範圍。');
  if (!scope.allowed) return denied();
  if (scope.unrestricted) return { allowed: true, scope: SCOPE.ALL };
  if (scope.allowEt && isEnglishTableSurveyLike(survey)) {
    return { allowed: true, scope: SCOPE.SURVEY_ENGLISH_TABLE };
  }
  if (scope.allowEc && isEnglishClubSurveyLike(survey)) {
    return { allowed: true, scope: SCOPE.SURVEY_ENGLISH_CLUB };
  }
  return denied();
}

function assertCanAccessSurvey(user, survey) {
  const result = canAccessSurveyByRecord(user, survey);
  if (result.allowed) return result;
  const err = new Error(result.message || '您沒有存取此問卷資料的權限。');
  err.status = 403;
  err.code = result.code || 'SURVEY_SCOPE_DENIED';
  throw err;
}

function buildSurveyScopeWhere(user) {
  const scope = profileCanUseSurveyScope(user);
  if (!scope.allowed) return null;
  if (scope.unrestricted) return {};
  const or = [];
  if (scope.allowEt) {
    or.push(
      { surveyKey: { [Op.like]: '%english_table%' } },
      { code: { [Op.like]: '%english_table%' } },
      { name: { [Op.like]: '%English Table%' } },
      { title: { [Op.like]: '%English Table%' } },
      { category: { [Op.like]: '%English Table%' } },
      { targetType: { [Op.like]: '%English Table%' } },
      { activityType: ET_EVENT_TYPE },
    );
  }
  if (scope.allowEc) {
    or.push(
      { surveyKey: { [Op.like]: '%english_club%' } },
      { code: { [Op.like]: '%english_club%' } },
      { name: { [Op.like]: '%English Club%' } },
      { title: { [Op.like]: '%English Club%' } },
      { category: { [Op.like]: '%English Club%' } },
      { targetType: { [Op.like]: '%English Club%' } },
      { activityType: EC_EVENT_TYPE },
    );
  }
  if (!or.length) return null;
  return { [Op.or]: or };
}

async function findEnglishTableSurveyIds() {
  const where = buildSurveyScopeWhere({ role: 'teacher', teacherLevel: 'et_manager' });
  if (!where) return [];
  const rows = await Survey.findAll({ where, attributes: ['id'] }).catch(() => []);
  return (rows || []).map((row) => Number(row.id)).filter(Number.isInteger);
}

function mergeWhereWithScope(where = {}, scopeWhere = {}) {
  if (!scopeWhere || !Object.keys(scopeWhere).length) return { ...where };
  if (!where || !Object.keys(where).length) return { ...scopeWhere };
  return { [Op.and]: [where, scopeWhere] };
}

async function buildSurveyResponseScopeWhere(user, query = {}) {
  const scope = profileCanUseSurveyScope(user);
  if (!scope.allowed) return null;
  if (scope.unrestricted) return {};

  if (query.surveyId) {
    const survey = await Survey.findByPk(Number(query.surveyId));
    const access = canAccessSurveyByRecord(user, survey);
    if (!access.allowed) return null;
    return { surveyId: Number(query.surveyId) };
  }

  if (query.eventId) {
    const event = await Event.findByPk(Number(query.eventId));
    try {
      assertCanAccessEvent(user, event, { explicitEventContext: true });
      return { eventId: Number(query.eventId) };
    } catch (_) {
      return null;
    }
  }

  const activityType = query.activityType || query.eventType;
  if (activityType) {
    const allowEt = isEnglishTableActivity(activityType);
    const allowEc = isEnglishClubActivity(activityType);
    if (allowEt && scope.allowEt) {
      return {
        [Op.or]: [
          { activityType: ET_EVENT_TYPE },
          { eventType: ET_EVENT_TYPE },
        ],
      };
    }
    if (allowEc && scope.allowEc) {
      return {
        [Op.or]: [
          { activityType: EC_EVENT_TYPE },
          { eventType: EC_EVENT_TYPE },
        ],
      };
    }
    return null;
  }

  const surveyIds = await findEnglishTableSurveyIds();
  const or = [];
  if (scope.allowEt) {
    or.push({ activityType: ET_EVENT_TYPE }, { eventType: ET_EVENT_TYPE });
  }
  if (scope.allowEc) {
    or.push({ activityType: EC_EVENT_TYPE }, { eventType: EC_EVENT_TYPE });
  }
  if (surveyIds.length) {
    or.push({ surveyId: { [Op.in]: surveyIds } });
  }
  if (!or.length) return null;
  return { [Op.or]: or };
}

async function buildSurveyRuleScopeWhere(user, query = {}) {
  const scope = profileCanUseSurveyScope(user);
  if (!scope.allowed) return null;
  if (scope.unrestricted) return {};

  if (query.surveyId) {
    const survey = await Survey.findByPk(Number(query.surveyId));
    const access = canAccessSurveyByRecord(user, survey);
    if (!access.allowed) return null;
    return { surveyId: Number(query.surveyId) };
  }

  if (query.eventId || query.targetEventId) {
    const event = await Event.findByPk(Number(query.eventId || query.targetEventId));
    try {
      assertCanAccessEvent(user, event, { explicitEventContext: true });
      return {
        [Op.or]: [
          { eventId: Number(query.eventId || query.targetEventId) },
          { targetEventId: Number(query.eventId || query.targetEventId) },
        ],
      };
    } catch (_) {
      return null;
    }
  }

  const activityType = query.activityType || query.targetEventType;
  if (activityType) {
    if (!isEnglishTableActivity(activityType)) return null;
    return {
      [Op.or]: [
        { activityType: ET_EVENT_TYPE },
        { targetEventType: ET_EVENT_TYPE },
      ],
    };
  }

  const surveyIds = await findEnglishTableSurveyIds();
  return {
    [Op.or]: [
      { activityType: ET_EVENT_TYPE },
      { targetEventType: ET_EVENT_TYPE },
      ...(surveyIds.length ? [{ surveyId: { [Op.in]: surveyIds } }] : []),
    ],
  };
}

async function canAccessSurveyResponse(user, response) {
  if (!response) return denied('MISSING_SURVEY_CONTEXT', '此操作需要指定問卷或資料範圍。');
  const scope = profileCanUseSurveyScope(user);
  if (!scope.allowed) return denied();
  if (scope.unrestricted) return { allowed: true, scope: SCOPE.ALL };

  if (response.eventId) {
    const event = await Event.findByPk(Number(response.eventId));
    try {
      assertCanAccessEvent(user, event, { explicitEventContext: true });
      return { allowed: true, scope: SCOPE.ENGLISH_TABLE };
    } catch (_) {
      return denied();
    }
  }

  if (isEnglishTableActivity(response.activityType || response.eventType)) {
    return { allowed: true, scope: SCOPE.SURVEY_ENGLISH_TABLE };
  }

  const survey = response.Survey || (response.surveyId ? await Survey.findByPk(Number(response.surveyId)) : null);
  return canAccessSurveyByRecord(user, survey);
}

async function assertCanAccessSurveyResponse(user, response) {
  const result = await canAccessSurveyResponse(user, response);
  if (result.allowed) return result;
  const err = new Error(result.message || '您沒有存取此問卷資料的權限。');
  err.status = 403;
  err.code = result.code || 'SURVEY_SCOPE_DENIED';
  throw err;
}

async function assertCanAccessSurveyById(user, surveyId) {
  const survey = await Survey.findByPk(Number(surveyId));
  if (!survey) {
    const err = new Error('找不到問卷');
    err.status = 404;
    err.code = 'SURVEY_NOT_FOUND';
    throw err;
  }
  assertCanAccessSurvey(user, survey);
  return survey;
}

async function assertCanAccessSurveyRulePayload(user, payload = {}) {
  if (payload.eventId || payload.targetEventId) {
    const event = await Event.findByPk(Number(payload.eventId || payload.targetEventId));
    return assertCanAccessEvent(user, event, { explicitEventContext: true });
  }
  if (payload.surveyId) {
    return assertCanAccessSurveyById(user, payload.surveyId);
  }
  if (payload.surveyKey || payload.name || payload.title || payload.category || payload.targetType || payload.activityType) {
    const access = canAccessSurveyByRecord(user, payload);
    if (access.allowed) return access;
  }
  const activityType = payload.activityType || payload.targetEventType;
  if (activityType) {
    const scope = profileCanUseSurveyScope(user);
    if (scope.unrestricted) return { allowed: true, scope: SCOPE.ALL };
    if (scope.allowed && isEnglishTableActivity(activityType)) return { allowed: true, scope: SCOPE.SURVEY_ENGLISH_TABLE };
  }
  const scope = profileCanUseSurveyScope(user);
  if (scope.unrestricted) return { allowed: true, scope: SCOPE.ALL };
  const err = new Error('此操作需要指定問卷或資料範圍。');
  err.status = 403;
  err.code = 'MISSING_SURVEY_CONTEXT';
  throw err;
}

function sendSurveyScopeDenied(res, err) {
  return res.status(err.status || 403).json({
    success: false,
    errorCode: err.code || 'SURVEY_SCOPE_DENIED',
    message: err.message || '您沒有存取此問卷資料的權限。',
  });
}

module.exports = {
  canAccessSurveyByRecord,
  assertCanAccessSurvey,
  assertCanAccessSurveyById,
  canAccessSurveyResponse,
  assertCanAccessSurveyResponse,
  buildSurveyScopeWhere,
  buildSurveyResponseScopeWhere,
  buildSurveyRuleScopeWhere,
  mergeWhereWithScope,
  assertCanAccessSurveyRulePayload,
  sendSurveyScopeDenied,
};
