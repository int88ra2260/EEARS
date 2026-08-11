'use strict';

const EmailTemplateOverride = require('../models/EmailTemplateOverride');
const {
  EMAIL_TEMPLATE_CATALOG,
  getEmailTemplateCatalogEntry,
  getEmailTemplateSampleData,
} = require('./emailTemplateCatalog');
const { getEmailTemplateDefaultSource } = require('./emailTemplateDefaultSources');

/** 覆寫快取：避免每次寄信都打 DB */
let overrideCache = null;
let overrideCacheAt = 0;
const CACHE_TTL_MS = 15_000;

function invalidateEmailTemplateOverrideCache() {
  overrideCache = null;
  overrideCacheAt = 0;
}

/**
 * {{var}} / {{ var }} 插值；缺值以空字串取代（避免把 placeholder 原樣寄出）。
 */
function interpolateTemplate(template, vars) {
  if (template == null) return template;
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return '';
    const v = vars[key];
    if (v == null) return '';
    if (Array.isArray(v)) return v.join(', ');
    return String(v);
  });
}

function flattenVars(data, prefix = '', out = {}) {
  if (data == null || typeof data !== 'object') return out;
  if (data instanceof Date) {
    if (prefix) out[prefix] = data.toISOString();
    return out;
  }
  for (const [k, v] of Object.entries(data)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      flattenVars(v, key, out);
    } else if (Array.isArray(v)) {
      out[key] = v.join(', ');
      if (!prefix) out[k] = out[key];
    } else {
      out[key] = v instanceof Date ? v.toISOString() : v;
      if (!prefix) out[k] = out[key];
    }
  }
  return out;
}

function formatDateTime(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatRejectionReasons(data) {
  const reasons = data.rejectionReasons;
  if (!reasons) return data.rejectionReason || data.failureReason || '未提供';
  if (Array.isArray(reasons)) {
    let text = reasons.join('、');
    if (data.rejectionOther && String(data.rejectionOther).trim()) {
      text += `、其他：${data.rejectionOther}`;
    }
    return text || '未提供';
  }
  return String(reasons);
}

/**
 * 為覆寫模板補齊衍生變數（活動類型前綴、地點、英檢顯示名等）。
 */
function enrichMailVars(data = {}) {
  // eslint-disable-next-line global-require
  const emailMod = require('../config/email');
  const vars = flattenVars(data);

  try {
    const activity = emailMod.getActivitySpecificContent?.(data.eventType, data.startTime) || {};
    const location = emailMod.getEventLocationForEmail?.(data) || {};
    vars.subjectPrefix = activity.subjectPrefix || '';
    vars.chineseDescription = activity.chineseDescription || '';
    vars.englishDescription = activity.englishDescription || '';
    vars.chineseReminder = activity.chineseReminder || '';
    vars.englishReminder = activity.englishReminder || '';
    vars.checkInTime = activity.checkInTime || '';
    vars.locationZh = location.zh || data.location || '';
    vars.locationEn = location.en || data.location || '';
  } catch (_) {
    /* ignore */
  }

  const statusMap = emailMod.BESTEP_STATUS_MAP || {};
  const examMap = emailMod.BESTEP_EXAM_TYPE_MAP || {};
  vars.statusZh = statusMap[data.status]?.zh || data.status || '';
  vars.statusEn = statusMap[data.status]?.en || data.status || '';
  vars.examTypeZh = examMap[data.examType]?.zh || data.examType || '';
  vars.examTypeEn = examMap[data.examType]?.en || data.examType || '';

  vars.studentDisplayName =
    data.lastNameEn && data.firstNameEn
      ? `${data.lastNameEn} ${data.firstNameEn}`.trim()
      : data.studentNameZh || data.studentName || data.name || '';

  if (!vars.studentName) vars.studentName = vars.studentDisplayName;
  if (!vars.name) vars.name = vars.studentDisplayName;
  if (!vars.email && data.studentEmail) vars.email = data.studentEmail;
  if (!vars.studentEmail && data.email) vars.studentEmail = data.email;

  vars.cancellationCode = data.cancellationCode || 'N/A';
  vars.expiresInMinutes = data.expiresInMinutes || data.expiresMinutes || 10;
  vars.teamSize = data.teamSize != null ? data.teamSize : '未知';
  vars.expiresAtHours = data.expiresAtHours || 24;
  vars.memberList = data.memberList || '';
  vars.registrationShortLink =
    data.registrationShortLink ||
    data.groupRegistrationLink ||
    'http://emieears-siwan.nsysu.edu.tw/register/english-test/group';
  vars.phone = data.phone || '未提供';
  vars.reason = data.reason || '';
  vars.rejectionReasonsText = formatRejectionReasons(data);
  vars.rejectionReasonsTextEn = formatRejectionReasons(data);
  vars.registrationDateFormatted = formatDateTime(data.registrationDate);
  vars.updatedAtFormatted = formatDateTime(data.updatedAt || data.registrationDate);

  return vars;
}

function extractPlaceholders(template) {
  if (!template) return [];
  const found = new Set();
  String(template).replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    found.add(key);
    return '';
  });
  return [...found];
}

function validatePlaceholders(subjectTemplate, bodyTemplate, allowedVarNames) {
  const allowed = new Set(allowedVarNames || []);
  const used = [
    ...extractPlaceholders(subjectTemplate),
    ...extractPlaceholders(bodyTemplate),
  ];
  const unknown = [...new Set(used)].filter((k) => allowed.size > 0 && !allowed.has(k));
  return { used: [...new Set(used)], unknown };
}

async function loadOverrideMap({ force = false } = {}) {
  const now = Date.now();
  if (!force && overrideCache && now - overrideCacheAt < CACHE_TTL_MS) {
    return overrideCache;
  }
  const rows = await EmailTemplateOverride.findAll();
  const map = new Map();
  for (const row of rows) {
    map.set(row.templateKey, row);
  }
  overrideCache = map;
  overrideCacheAt = now;
  return map;
}

async function getOverride(templateKey) {
  const map = await loadOverrideMap();
  return map.get(templateKey) || null;
}

function getEmailTemplatesFn() {
  // 延遲載入避免與 config/email.js 循環依賴
  // eslint-disable-next-line global-require
  return require('../config/email').emailTemplates;
}

function renderCodeDefault(templateKey, data) {
  const templates = getEmailTemplatesFn();
  const fn = templates && templates[templateKey];
  if (typeof fn !== 'function') {
    const err = new Error(`UNKNOWN_EMAIL_TEMPLATE:${templateKey}`);
    err.code = 'UNKNOWN_EMAIL_TEMPLATE';
    throw err;
  }
  return fn(data || {});
}

/**
 * 組出實際寄信內容：程式預設 → 套用 DB 覆寫（主旨／正文）。
 * isEnabled === false 時丟 EMAIL_TEMPLATE_DISABLED。
 */
async function buildMailOptions(templateKey, data) {
  const catalog = getEmailTemplateCatalogEntry(templateKey);
  if (!catalog && !getEmailTemplatesFn()?.[templateKey]) {
    const err = new Error(`UNKNOWN_EMAIL_TEMPLATE:${templateKey}`);
    err.code = 'UNKNOWN_EMAIL_TEMPLATE';
    throw err;
  }

  const override = await getOverride(templateKey);
  if (override && override.isEnabled === false) {
    const err = new Error('EMAIL_TEMPLATE_DISABLED');
    err.code = 'EMAIL_TEMPLATE_DISABLED';
    err.template = templateKey;
    throw err;
  }

  const built = renderCodeDefault(templateKey, data);
  const vars = enrichMailVars(data || {});

  if (override) {
    if (override.subjectTemplate != null && String(override.subjectTemplate).trim() !== '') {
      built.subject = interpolateTemplate(override.subjectTemplate, vars);
    }
    if (override.bodyTemplate != null && String(override.bodyTemplate).trim() !== '') {
      built.text = interpolateTemplate(override.bodyTemplate, vars);
    }
  }

  return built;
}

function serializeOverride(row) {
  if (!row) return null;
  return {
    templateKey: row.templateKey,
    subjectTemplate: row.subjectTemplate,
    bodyTemplate: row.bodyTemplate,
    isEnabled: row.isEnabled !== false,
    notes: row.notes || null,
    updatedByUserId: row.updatedByUserId || null,
    updatedAt: row.updatedAt || null,
    createdAt: row.createdAt || null,
  };
}

async function listEmailTemplates() {
  const map = await loadOverrideMap({ force: true });
  return EMAIL_TEMPLATE_CATALOG.map((entry) => {
    const override = map.get(entry.key);
    let codeDefaultSubject = null;
    let codeDefaultBody = null;
    try {
      const built = renderCodeDefault(entry.key, getEmailTemplateSampleData(entry.key));
      codeDefaultSubject = built.subject || null;
      codeDefaultBody = built.text || null;
    } catch (e) {
      codeDefaultSubject = `(無法預覽預設：${e.message})`;
      codeDefaultBody = null;
    }

    const hasSubjectOverride = !!(override && override.subjectTemplate != null && String(override.subjectTemplate).trim() !== '');
    const hasBodyOverride = !!(override && override.bodyTemplate != null && String(override.bodyTemplate).trim() !== '');
    const sample = getEmailTemplateSampleData(entry.key) || {};
    const vars = enrichMailVars(sample);
    const source = getEmailTemplateDefaultSource(entry.key);
    const baselineEditableSubject = source?.subject || codeDefaultSubject || '';
    const baselineEditableBody = source?.body || codeDefaultBody || '';
    const effectiveSubject = hasSubjectOverride
      ? interpolateTemplate(override.subjectTemplate, vars)
      : codeDefaultSubject;
    const effectiveBody = hasBodyOverride
      ? interpolateTemplate(override.bodyTemplate, vars)
      : codeDefaultBody;

    const editableSubject = hasSubjectOverride
      ? override.subjectTemplate
      : baselineEditableSubject;
    const editableBody = hasBodyOverride
      ? override.bodyTemplate
      : baselineEditableBody;

    // 合併目錄變數 + 預設稿用到的變數
    const sourceVars = [
      ...extractPlaceholders(baselineEditableSubject),
      ...extractPlaceholders(baselineEditableBody),
    ];
    const varMap = new Map((entry.variables || []).map((v) => [v.name, v]));
    for (const name of sourceVars) {
      if (!varMap.has(name)) varMap.set(name, { name, description: '系統衍生／模板變數' });
    }

    return {
      key: entry.key,
      category: entry.category,
      categoryLabel: entry.categoryLabel,
      name: entry.name,
      description: entry.description,
      channel: entry.channel,
      variables: [...varMap.values()],
      isEnabled: override ? override.isEnabled !== false : true,
      hasOverride: !!(hasSubjectOverride || hasBodyOverride || (override && override.isEnabled === false)),
      hasSubjectOverride,
      hasBodyOverride,
      override: serializeOverride(override),
      codeDefaultSubject,
      codeDefaultBody,
      baselineEditableSubject,
      baselineEditableBody,
      editableSubject,
      editableBody,
      effectiveSubject,
      effectiveBody,
      sampleData: sample,
    };
  });
}

async function getEmailTemplateDetail(templateKey) {
  const entry = getEmailTemplateCatalogEntry(templateKey);
  if (!entry) {
    const err = new Error('EMAIL_TEMPLATE_NOT_FOUND');
    err.code = 'EMAIL_TEMPLATE_NOT_FOUND';
    throw err;
  }
  const list = await listEmailTemplates();
  return list.find((t) => t.key === templateKey) || null;
}

async function previewEmailTemplate(templateKey, { subjectTemplate, bodyTemplate, data } = {}) {
  const entry = getEmailTemplateCatalogEntry(templateKey);
  if (!entry) {
    const err = new Error('EMAIL_TEMPLATE_NOT_FOUND');
    err.code = 'EMAIL_TEMPLATE_NOT_FOUND';
    throw err;
  }
  const sample = { ...getEmailTemplateSampleData(templateKey), ...(data || {}) };
  const codeBuilt = renderCodeDefault(templateKey, sample);
  const vars = enrichMailVars(sample);
  const source = getEmailTemplateDefaultSource(templateKey);
  const allowed = [
    ...(entry.variables || []).map((v) => v.name),
    ...extractPlaceholders(source?.subject),
    ...extractPlaceholders(source?.body),
  ];
  const validation = validatePlaceholders(subjectTemplate, bodyTemplate, allowed);

  const subject =
    subjectTemplate != null && String(subjectTemplate).trim() !== ''
      ? interpolateTemplate(subjectTemplate, vars)
      : codeBuilt.subject;
  const body =
    bodyTemplate != null && String(bodyTemplate).trim() !== ''
      ? interpolateTemplate(bodyTemplate, vars)
      : codeBuilt.text;

  return {
    to: codeBuilt.to,
    subject,
    body,
    sampleData: sample,
    warnings: validation.unknown.length
      ? [`未在變數清單中的 placeholder：${validation.unknown.join(', ')}`]
      : [],
    placeholders: validation.used,
  };
}

async function upsertEmailTemplateOverride(templateKey, payload, userId) {
  const entry = getEmailTemplateCatalogEntry(templateKey);
  if (!entry) {
    const err = new Error('EMAIL_TEMPLATE_NOT_FOUND');
    err.code = 'EMAIL_TEMPLATE_NOT_FOUND';
    throw err;
  }

  const subjectTemplate =
    payload.subjectTemplate === undefined
      ? undefined
      : payload.subjectTemplate == null || String(payload.subjectTemplate).trim() === ''
        ? null
        : String(payload.subjectTemplate).slice(0, 500);

  const bodyTemplate =
    payload.bodyTemplate === undefined
      ? undefined
      : payload.bodyTemplate == null || String(payload.bodyTemplate).trim() === ''
        ? null
        : String(payload.bodyTemplate);

  const allowed = new Set([
    ...(entry.variables || []).map((v) => v.name),
    ...extractPlaceholders(getEmailTemplateDefaultSource(templateKey)?.subject),
    ...extractPlaceholders(getEmailTemplateDefaultSource(templateKey)?.body),
  ]);
  const validation = validatePlaceholders(
    subjectTemplate === undefined ? '' : subjectTemplate,
    bodyTemplate === undefined ? '' : bodyTemplate,
    [...allowed]
  );

  const existing = await EmailTemplateOverride.findOne({ where: { templateKey } });
  const next = {
    templateKey,
    updatedByUserId: userId || null,
  };
  if (subjectTemplate !== undefined) next.subjectTemplate = subjectTemplate;
  if (bodyTemplate !== undefined) next.bodyTemplate = bodyTemplate;
  if (payload.isEnabled !== undefined) next.isEnabled = !!payload.isEnabled;
  if (payload.notes !== undefined) {
    next.notes = payload.notes == null ? null : String(payload.notes).slice(0, 500);
  }

  let row;
  if (existing) {
    await existing.update(next);
    row = existing;
  } else {
    row = await EmailTemplateOverride.create({
      templateKey,
      subjectTemplate: subjectTemplate === undefined ? null : subjectTemplate,
      bodyTemplate: bodyTemplate === undefined ? null : bodyTemplate,
      isEnabled: payload.isEnabled === undefined ? true : !!payload.isEnabled,
      notes: payload.notes == null ? null : String(payload.notes).slice(0, 500),
      updatedByUserId: userId || null,
    });
  }

  invalidateEmailTemplateOverrideCache();

  return {
    override: serializeOverride(row),
    warnings: validation.unknown.length
      ? [`未在變數清單中的 placeholder：${validation.unknown.join(', ')}`]
      : [],
  };
}

async function resetEmailTemplateOverride(templateKey) {
  const entry = getEmailTemplateCatalogEntry(templateKey);
  if (!entry) {
    const err = new Error('EMAIL_TEMPLATE_NOT_FOUND');
    err.code = 'EMAIL_TEMPLATE_NOT_FOUND';
    throw err;
  }
  await EmailTemplateOverride.destroy({ where: { templateKey } });
  invalidateEmailTemplateOverrideCache();
  return { ok: true };
}

async function sendTestEmail(templateKey, { to, subjectTemplate, bodyTemplate, data } = {}) {
  const entry = getEmailTemplateCatalogEntry(templateKey);
  if (!entry) {
    const err = new Error('EMAIL_TEMPLATE_NOT_FOUND');
    err.code = 'EMAIL_TEMPLATE_NOT_FOUND';
    throw err;
  }
  if (!to || !String(to).includes('@')) {
    const err = new Error('TEST_EMAIL_TO_REQUIRED');
    err.code = 'TEST_EMAIL_TO_REQUIRED';
    throw err;
  }

  const sample = { ...getEmailTemplateSampleData(templateKey), ...(data || {}) };
  sample.studentEmail = to;
  sample.email = to;

  const override = await getOverride(templateKey);
  const preview = await previewEmailTemplate(templateKey, {
    subjectTemplate: subjectTemplate !== undefined ? subjectTemplate : override?.subjectTemplate,
    bodyTemplate: bodyTemplate !== undefined ? bodyTemplate : override?.bodyTemplate,
    data: sample,
  });

  // eslint-disable-next-line global-require
  const { sendRawMail } = require('../config/email');
  const subject = `[測試] ${preview.subject || templateKey}`;
  await sendRawMail(templateKey, {
    to,
    subject,
    text: preview.body || '',
  });

  return {
    ok: true,
    to,
    subject,
    warnings: preview.warnings,
  };
}

module.exports = {
  interpolateTemplate,
  flattenVars,
  enrichMailVars,
  extractPlaceholders,
  validatePlaceholders,
  invalidateEmailTemplateOverrideCache,
  buildMailOptions,
  listEmailTemplates,
  getEmailTemplateDetail,
  previewEmailTemplate,
  upsertEmailTemplateOverride,
  resetEmailTemplateOverride,
  sendTestEmail,
};
