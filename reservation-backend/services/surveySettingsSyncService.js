/**
 * 過渡期雙寫：legacy survey_settings → 產品化 survey_rules
 *
 * 長期應以「問卷模組」單一入口管理規則；此檔僅為相容舊設定頁之同步，請勿再複製 mapping 至他處。
 */
const { Survey, SurveyRule, SurveySettings, SurveyAdminAuditLog } = require('../models');

// ---------------------------------------------------------------------------
// Legacy surveyId → 產品化 surveys.surveyKey（單一真相來源，勿分散定義）
// ---------------------------------------------------------------------------
const LEGACY_SURVEY_ID_TO_PRODUCT_SURVEY_KEY = Object.freeze({
  survey_1: 'english_table_feedback_114_1',
  survey_2: 'english_club_feedback_114_1',
  english_table_feedback_114_1: 'english_table_feedback_114_1',
  english_club_feedback_114_1: 'english_club_feedback_114_1',
});

const DEFAULT_NEW_RULE_FROM_LEGACY = Object.freeze({
  gatingMode: 'before_reservation',
  retakePolicy: 'once_ever',
  retakeScope: null,
  semesterKey: null,
  targetEventType: null,
  targetEventId: null,
  collectStudentId: true,
  collectStudentName: true,
  collectStudentEmail: true,
  allowEditAfterSubmit: false,
  isAnonymous: false,
  settingsJson: null,
});

function serializeRule(rule) {
  if (!rule) return null;
  const j = typeof rule.toJSON === 'function' ? rule.toJSON() : { ...rule };
  return j;
}

/**
 * @param {import('../models/SurveySettings')} setting
 * @returns {string|null} 產品化 surveyKey；無對應則 null（僅 legacy、不同步 survey_rules）
 */
function resolveSurveyKeyFromLegacySetting(setting) {
  if (!setting || !setting.surveyId) return null;
  const id = String(setting.surveyId).trim();
  return LEGACY_SURVEY_ID_TO_PRODUCT_SURVEY_KEY[id] || null;
}

/**
 * @param {import('../models/SurveySettings')} setting
 * @param {{ actorId?: number|null, transaction?: import('sequelize').Transaction, source?: string }} opts
 * @returns {Promise<{ skipped?: boolean, reason?: string, surveyRuleId?: number, surveyKey?: string, synced?: boolean }>}
 */
async function syncLegacySettingToSurveyRule(setting, opts = {}) {
  const { actorId = null, transaction, source = 'unknown' } = opts;

  const surveyKey = resolveSurveyKeyFromLegacySetting(setting);
  if (!surveyKey) {
    return { skipped: true, reason: 'unmapped_survey_id', synced: false };
  }

  const survey = await Survey.findOne({ where: { surveyKey }, transaction });
  if (!survey) {
    const err = new Error(
      `無法同步：產品化問卷不存在（surveyKey=${surveyKey}）。請先執行問卷模組 migration／bootstrap。`
    );
    err.code = 'PRODUCT_SURVEY_MISSING';
    throw err;
  }

  const existing = await SurveyRule.findOne({ where: { surveyId: survey.id }, transaction });
  const beforeJson = serializeRule(existing);

  const eventType =
    surveyKey === 'english_table_feedback_114_1'
      ? 'English Table'
      : surveyKey === 'english_club_feedback_114_1'
        ? 'English Club'
        : null;
  const activityType = eventType === 'English Table' ? 'ET' : eventType === 'English Club' ? 'EC' : null;

  const mapped = {
    isEnabled: !!setting.isEnabled,
    isRequired: !!setting.isRequired,
    startDate: setting.startDate != null ? setting.startDate : null,
    endDate: setting.endDate != null ? setting.endDate : null,
    startAt: setting.startDate != null ? setting.startDate : null,
    endAt: setting.endDate != null ? setting.endDate : null,
    activityType,
    targetEventType: eventType,
  };

  let rule;
  if (existing) {
    await existing.update(
      {
        ...mapped,
        updatedBy: actorId != null ? actorId : existing.updatedBy,
      },
      { transaction }
    );
    await existing.reload({ transaction });
    rule = existing;
  } else {
    rule = await SurveyRule.create(
      {
        surveyId: survey.id,
        ...DEFAULT_NEW_RULE_FROM_LEGACY,
        ...mapped,
        updatedBy: actorId != null ? actorId : null,
      },
      { transaction }
    );
  }

  const afterJson = serializeRule(rule);

  await SurveyAdminAuditLog.create(
    {
      actorId: actorId != null ? actorId : null,
      action: 'sync_legacy_setting_to_rule',
      entityType: 'survey_rule',
      entityId: String(rule.id),
      beforeJson: beforeJson || null,
      afterJson: afterJson || null,
      summary: 'Sync from legacy survey_settings page',
    },
    { transaction }
  );

  return {
    synced: true,
    surveyRuleId: rule.id,
    surveyKey,
    source,
    skipped: false,
  };
}

/**
 * 批次：將所有 legacy 列同步至 survey_rules（可包在外層 transaction）
 * @param {{ actorId?: number|null, transaction?: import('sequelize').Transaction }} opts
 */
async function syncAllLegacySettingsToSurveyRules(opts = {}) {
  const { actorId = null, transaction } = opts;
  const rows = await SurveySettings.findAll({ order: [['surveyId', 'ASC']], transaction });
  const results = [];
  for (const s of rows) {
    const surveyKey = resolveSurveyKeyFromLegacySetting(s);
    if (!surveyKey) {
      results.push({ surveyId: s.surveyId, skipped: true, reason: 'unmapped_survey_id' });
      continue;
    }
    try {
      const r = await syncLegacySettingToSurveyRule(s, {
        actorId,
        transaction,
        source: 'sync_all',
      });
      results.push({ surveyId: s.surveyId, ...r });
    } catch (e) {
      e.surveyId = s.surveyId;
      throw e;
    }
  }
  return results;
}

function datesEqual(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const ta = a instanceof Date ? a.getTime() : new Date(a).getTime();
  const tb = b instanceof Date ? b.getTime() : new Date(b).getTime();
  return ta === tb;
}

function compareKeyFields(legacy, rule) {
  if (!legacy || !rule) return { match: false, mismatches: ['missing_rule_or_legacy'] };
  const mismatches = [];
  if (!!legacy.isEnabled !== !!rule.isEnabled) mismatches.push('isEnabled');
  if (!!legacy.isRequired !== !!rule.isRequired) mismatches.push('isRequired');
  if (!datesEqual(legacy.startDate, rule.startDate)) mismatches.push('startDate');
  if (!datesEqual(legacy.endDate, rule.endDate)) mismatches.push('endDate');
  return {
    match: mismatches.length === 0,
    mismatches,
  };
}

/**
 * 診斷：legacy 與 product survey_rules 是否對齊（供 admin API / script）
 */
async function getLegacySurveyRuleSyncReport() {
  const legacyRows = await SurveySettings.findAll({ order: [['surveyId', 'ASC']] });
  const report = [];

  for (const leg of legacyRows) {
    const productKey = resolveSurveyKeyFromLegacySetting(leg);
    const entry = {
      legacySurveyId: leg.surveyId,
      productSurveyKey: productKey,
      productSurveyExists: false,
      ruleExists: false,
      keyFieldsMatch: null,
      mismatches: [],
      note: null,
    };

    if (!productKey) {
      entry.note = '此 surveyId 未對應產品化 surveyKey，不同步 survey_rules';
      report.push(entry);
      continue;
    }

    const survey = await Survey.findOne({ where: { surveyKey: productKey } });
    entry.productSurveyExists = !!survey;
    if (!survey) {
      entry.note = '產品化 surveys 表中無此 surveyKey';
      report.push(entry);
      continue;
    }

    const rule = await SurveyRule.findOne({ where: { surveyId: survey.id } });
    entry.ruleExists = !!rule;
    if (!rule) {
      entry.mismatches = ['isEnabled', 'isRequired', 'startDate', 'endDate'];
      entry.note = 'survey_rules 尚未建立';
      entry.keyFieldsMatch = false;
      report.push(entry);
      continue;
    }

    const cmp = compareKeyFields(leg, rule);
    entry.keyFieldsMatch = cmp.match;
    entry.mismatches = cmp.mismatches;
    report.push(entry);
  }

  return {
    generatedAt: new Date().toISOString(),
    mappingKeys: Object.keys(LEGACY_SURVEY_ID_TO_PRODUCT_SURVEY_KEY),
    rows: report,
  };
}

module.exports = {
  LEGACY_SURVEY_ID_TO_PRODUCT_SURVEY_KEY,
  resolveSurveyKeyFromLegacySetting,
  syncLegacySettingToSurveyRule,
  syncAllLegacySettingsToSurveyRules,
  getLegacySurveyRuleSyncReport,
};
