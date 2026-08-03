// middlewares/checkSurvey.js
const { Event } = require('../models');
const { resolveGateContext, hasCompletedForGate, ruleTimeAllows } = require('../services/surveyGateService');

/**
 * 預約前問卷 Gate：僅依 survey_rules（後台「啟用規則」）判定
 */
async function checkSurvey(req, res, next) {
  try {
    const { studentId, eventId } = req.body;

    if (!studentId || String(studentId).trim() === '') {
      return next();
    }
    if (!eventId) {
      return next();
    }

    const event = await Event.findByPk(eventId, { attributes: ['id', 'eventType'] });
    if (!event) {
      return res.status(404).json({
        message: '找不到活動資料',
        code: 'EVENT_NOT_FOUND',
      });
    }

    const productCtx = await resolveGateContext(event.eventType);
    if (productCtx.mode !== 'product') {
      return next();
    }

    const { survey, rule, surveyKey } = productCtx;

    if (!rule.isEnabled || !rule.isRequired) {
      return next();
    }

    const time = ruleTimeAllows(rule);
    if (!time.ok) {
      return next();
    }

    const trimmedStudentId = String(studentId).trim();
    if (!trimmedStudentId) {
      return next();
    }

    let completed;
    try {
      completed = await hasCompletedForGate({
        surveyId: survey.id,
        surveyKey,
        rule,
        studentId: trimmedStudentId,
        eventId,
      });
    } catch (e) {
      console.error('[checkSurvey] hasCompletedForGate 失敗:', e);
      return res.status(500).json({
        message: '問卷檢查失敗，請稍後再試',
        code: 'SURVEY_CHECK_FAILED',
      });
    }

    if (completed) {
      return next();
    }

    const surveyName = (rule.settingsJson && rule.settingsJson.surveyName) || survey.name || event.eventType;
    const errorCode =
      event.eventType === 'English Table'
        ? 'ENGLISH_TABLE_SURVEY_REQUIRED'
        : event.eventType === 'English Club'
          ? 'ENGLISH_CLUB_SURVEY_REQUIRED'
          : 'SURVEY_REQUIRED';

    return res.status(409).json({
      error: `請先完成${surveyName}問卷調查才能進行預約`,
      code: errorCode,
      redirectUrl: `/survey/${surveyKey}`,
      surveyId: surveyKey,
    });
  } catch (error) {
    console.error('[checkSurvey] error:', error);
    return res.status(500).json({
      message: '問卷檢查失敗，請稍後再試',
      code: 'SURVEY_CHECK_FAILED',
    });
  }
}

async function checkEnglishTableSurvey(req, res, next) {
  return checkSurvey(req, res, next);
}

async function checkEnglishClubSurvey(req, res, next) {
  return checkSurvey(req, res, next);
}

module.exports = {
  checkSurvey,
  checkEnglishTableSurvey,
  checkEnglishClubSurvey,
};
