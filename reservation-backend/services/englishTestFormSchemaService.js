'use strict';

const { EnglishTestFormSchema } = require('../models');
const {
  buildDefaultEnglishTestFormSchema,
  ALLOWED_QUESTION_TYPES,
} = require('../data/englishTestFormDefaultSchema');

function cloneSchema(schema) {
  return JSON.parse(JSON.stringify(schema || buildDefaultEnglishTestFormSchema()));
}

function normalizeOption(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const v = raw.trim();
    if (!v) return null;
    return { value: v, label: v };
  }
  if (typeof raw === 'object') {
    const value = String(raw.value ?? raw.label ?? '').trim();
    if (!value) return null;
    const label = String(raw.label ?? raw.value ?? value).trim() || value;
    return { value, label };
  }
  return null;
}

function normalizeQuestion(raw, index) {
  if (!raw || typeof raw !== 'object') {
    const err = new Error(`第 ${index + 1} 題格式無效`);
    err.status = 400;
    err.code = 'INVALID_QUESTION';
    throw err;
  }

  const id = String(raw.id || '').trim();
  const fieldKey = String(raw.fieldKey || '').trim();
  const label = String(raw.label || '').trim();
  const type = String(raw.type || 'text').trim();
  const sectionId = String(raw.sectionId || 'custom').trim();

  if (!id || !fieldKey || !label) {
    const err = new Error(`第 ${index + 1} 題缺少 id、fieldKey 或 label`);
    err.status = 400;
    err.code = 'INVALID_QUESTION';
    throw err;
  }

  if (!ALLOWED_QUESTION_TYPES.includes(type)) {
    const err = new Error(`不支援的題型：${type}`);
    err.status = 400;
    err.code = 'INVALID_QUESTION_TYPE';
    throw err;
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldKey)) {
    const err = new Error(`fieldKey 格式無效：${fieldKey}（須為英數與底線，且以字母開頭）`);
    err.status = 400;
    err.code = 'INVALID_FIELD_KEY';
    throw err;
  }

  const options = Array.isArray(raw.options)
    ? raw.options.map(normalizeOption).filter(Boolean)
    : [];

  const content = normalizeContent(raw.content, type);

  return {
    id,
    fieldKey,
    sectionId,
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index + 1,
    label,
    type,
    required: Boolean(raw.required),
    system: Boolean(raw.system),
    helpText: raw.helpText != null ? String(raw.helpText) : '',
    visible: raw.visible === false ? false : true,
    options,
    content,
  };
}

function normalizeContent(raw, type) {
  if (!raw || typeof raw !== 'object') {
    return type === 'content_block'
      ? { intro: '', imageUrl: '', imageAlt: '', warning: '', officialUrl: '', listItems: [], images: [] }
      : {};
  }
  const listItems = Array.isArray(raw.listItems)
    ? raw.listItems.map((x) => String(x || '').trim()).filter(Boolean)
    : typeof raw.listItemsText === 'string'
      ? String(raw.listItemsText).split('\n').map((l) => l.trim()).filter(Boolean)
      : [];
  const images = Array.isArray(raw.images)
    ? raw.images
        .filter((img) => img && (img.url || img.caption))
        .map((img) => ({
          url: String(img.url || '').trim(),
          alt: String(img.alt || img.caption || '').trim(),
          caption: String(img.caption || '').trim(),
          variant: ['success', 'danger', 'info', 'warning'].includes(img.variant)
            ? img.variant
            : 'info',
        }))
    : [];
  return {
    intro: raw.intro != null ? String(raw.intro) : '',
    imageUrl: raw.imageUrl != null ? String(raw.imageUrl) : '',
    imageAlt: raw.imageAlt != null ? String(raw.imageAlt) : '',
    warning: raw.warning != null ? String(raw.warning) : '',
    officialUrl: raw.officialUrl != null ? String(raw.officialUrl) : '',
    listItems,
    images,
  };
}

function normalizeSections(rawSections, fallback) {
  const list = Array.isArray(rawSections) && rawSections.length > 0 ? rawSections : fallback;
  return list.map((s, i) => ({
    id: String(s.id || `section_${i + 1}`).trim(),
    title: String(s.title || `區塊 ${i + 1}`).trim(),
    order: Number.isFinite(Number(s.order)) ? Number(s.order) : i + 1,
    navLabel: s.navLabel != null ? String(s.navLabel).trim() : '',
  }));
}

function parseSchemaJson(raw) {
  if (raw == null) return buildDefaultEnglishTestFormSchema();
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : buildDefaultEnglishTestFormSchema();
    } catch {
      return buildDefaultEnglishTestFormSchema();
    }
  }
  if (typeof raw === 'object') return raw;
  return buildDefaultEnglishTestFormSchema();
}

/** 僅在完全沒有階段時回填（允許自由刪除／重排既有階段）。 */
function schemaNeedsSystemMerge(raw) {
  return !Array.isArray(raw?.sections) || raw.sections.length === 0;
}

/** 報名主檔／流程仍依賴的建議欄位（僅警告，不阻擋儲存）。 */
function getSuggestedCoreFieldKeys() {
  return [
    'agreedToPrivacyPolicy',
    'studentId',
    'name',
    'idNumber',
    'email',
    'examType',
    'address',
    'idPhoto',
    'agreedToTerms',
  ];
}

function collectSchemaWarnings(schema) {
  const keys = new Set((schema?.questions || []).filter((q) => q.visible !== false).map((q) => q.fieldKey));
  const missing = getSuggestedCoreFieldKeys().filter((k) => !keys.has(k));
  if (missing.length === 0) return [];
  return [
    `以下建議欄位目前不在表單中（或已隱藏），可能影響報名／驗證流程：${missing.join(', ')}`,
  ];
}

/**
 * 正規化 schema（Google Forms 自由度：可刪、可改 fieldKey／題型）。
 * system 僅代表「來自預設範本」標記，不再當鎖定。
 */
function validateAndNormalizeSchema(incoming, previous) {
  const prev = previous || buildDefaultEnglishTestFormSchema();
  const base = cloneSchema(incoming || {});

  // 只補階段殼層（左側導覽），不回填已刪題目
  const withSections = mergeMissingSystemParts({
    ...base,
    questions: Array.isArray(base.questions) ? base.questions : [],
  });

  const sections = normalizeSections(withSections.sections, prev.sections);
  const questions = (Array.isArray(withSections.questions) ? withSections.questions : []).map(
    normalizeQuestion
  );

  const fieldKeys = questions.map((q) => q.fieldKey);
  if (new Set(fieldKeys).size !== fieldKeys.length) {
    const err = new Error('fieldKey 不可重複');
    err.status = 400;
    err.code = 'DUPLICATE_FIELD_KEY';
    throw err;
  }

  const ids = questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) {
    const err = new Error('題目 id 不可重複');
    err.status = 400;
    err.code = 'DUPLICATE_QUESTION_ID';
    throw err;
  }

  questions.sort((a, b) => {
    if (a.sectionId !== b.sectionId) return a.sectionId.localeCompare(b.sectionId);
    return a.order - b.order;
  });

  const normalized = {
    title: String(withSections.title || prev.title || '培力英檢報名表單').trim(),
    version: Number(withSections.version) || prev.version || 1,
    sections: sections.sort((a, b) => a.order - b.order),
    questions,
    departmentOptions:
      withSections.departmentOptions && typeof withSections.departmentOptions === 'object'
        ? withSections.departmentOptions
        : prev.departmentOptions || {},
  };
  normalized.warnings = collectSchemaWarnings(normalized);
  return normalized;
}

async function getPublishedRow() {
  let row = await EnglishTestFormSchema.findOne({
    where: { status: 'published' },
    order: [['version', 'DESC'], ['id', 'DESC']],
  });

  if (!row) {
    row = await EnglishTestFormSchema.create({
      version: 1,
      status: 'published',
      schemaJson: buildDefaultEnglishTestFormSchema(),
      changeSummary: '自動建立預設報名表單',
      updatedBy: null,
    });
  }

  return row;
}

async function getPublishedSchema({ allowPersistMerge = true } = {}) {
  const row = await getPublishedRow();
  const raw = parseSchemaJson(row.schemaJson);
  const schema = mergeMissingSystemParts(raw);

  // 舊 DB 缺步驟 0／1／2 等時：讀取即補齊並寫回，之後台／學生端都看得到
  if (allowPersistMerge && (schemaNeedsSystemMerge(raw) || schemaNeedsAnnouncementMerge(raw))) {
    const nextVersion = (Number(row.version) || 1) + 1;
    const changeSummary = schemaNeedsSystemMerge(raw)
      ? '自動補齊缺漏系統階段（步驟1/2、確認勾選、證件照說明等）'
      : '自動補齊報名須知階段（步驟0）與預設題目';
    const persisted = await EnglishTestFormSchema.create({
      version: nextVersion,
      status: 'published',
      schemaJson: schema,
      changeSummary,
      updatedBy: null,
    });
    return {
      id: persisted.id,
      version: persisted.version,
      status: persisted.status,
      updatedAt: persisted.updatedAt,
      updatedBy: persisted.updatedBy,
      changeSummary: persisted.changeSummary,
      schema,
      systemPartsBackfilled: true,
    };
  }

  return {
    id: row.id,
    version: row.version,
    status: row.status,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    changeSummary: row.changeSummary,
    schema,
    systemPartsBackfilled: false,
  };
}

/** 舊版 schema 可能缺少步驟 0「報名須知」階段或題目。 */
function schemaNeedsAnnouncementMerge(raw) {
  const sections = Array.isArray(raw?.sections) ? raw.sections : [];
  const questions = Array.isArray(raw?.questions) ? raw.questions : [];
  const hasSection = sections.some((s) => s.id === 'announcement');
  const keys = new Set(questions.map((q) => q.fieldKey));
  return !hasSection || !keys.has('announcementDoc') || !keys.has('agreedToAnnouncement');
}

/**
 * 補齊步驟 0「報名須知」階段與預設題目（不影響其他已刪除階段）。
 */
function mergeMissingAnnouncementParts(schema) {
  const defaults = buildDefaultEnglishTestFormSchema();
  const next = cloneSchema(schema || defaults);
  if (!Array.isArray(next.sections)) next.sections = [];
  if (!Array.isArray(next.questions)) next.questions = [];

  const defaultSection = defaults.sections.find((s) => s.id === 'announcement');
  if (defaultSection && !next.sections.some((s) => s.id === 'announcement')) {
    next.sections.push(cloneSchema(defaultSection));
  }

  const existingKeys = new Set(next.questions.map((q) => q.fieldKey));
  for (const question of defaults.questions.filter((q) => q.sectionId === 'announcement')) {
    if (!existingKeys.has(question.fieldKey)) {
      next.questions.push(cloneSchema(question));
    }
  }

  next.sections.sort((a, b) => (a.order || 0) - (b.order || 0));
  return next;
}

/**
 * 確保 schema 結構完整；不強制回填已刪階段／題目（Google Forms 自由度）。
 * 僅當 sections 完全為空時套用預設階段清單；另補齊缺漏的報名須知（步驟 0）。
 */
function mergeMissingSystemParts(schema) {
  const defaults = buildDefaultEnglishTestFormSchema();
  const next = cloneSchema(schema || defaults);

  if (!Array.isArray(next.questions)) next.questions = [];
  if (!Array.isArray(next.sections) || next.sections.length === 0) {
    next.sections = cloneSchema(defaults.sections);
  }

  if (!next.departmentOptions || typeof next.departmentOptions !== 'object') {
    next.departmentOptions = defaults.departmentOptions;
  }
  if (!next.title) next.title = defaults.title;

  return mergeMissingAnnouncementParts(next);
}

/**
 * 以完整 schema 覆寫並遞增版本（Google Forms 式儲存）。
 */
async function savePublishedSchema(schemaJson, { userId = null, changeSummary = null } = {}) {
  const current = await getPublishedSchema({ allowPersistMerge: false });
  const normalized = validateAndNormalizeSchema(schemaJson, current.schema);
  const warnings = normalized.warnings || [];
  delete normalized.warnings;
  normalized.version = (current.version || 1) + 1;

  const row = await EnglishTestFormSchema.create({
    version: normalized.version,
    status: 'published',
    schemaJson: normalized,
    changeSummary: changeSummary || '更新報名表單',
    updatedBy: userId,
  });

  return {
    id: row.id,
    version: row.version,
    status: row.status,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    changeSummary: row.changeSummary,
    schema: normalized,
    warnings,
  };
}

function getCoreRegistrationFieldKeys() {
  return new Set(
    buildDefaultEnglishTestFormSchema()
      .questions.filter((q) => q.system && q.type !== 'content_block')
      .map((q) => q.fieldKey)
  );
}

/** 自訂／額外題：答案進 extraAnswers（非報名主檔欄位、非純圖文區塊）。 */
function getCustomQuestions(schema) {
  const coreKeys = getCoreRegistrationFieldKeys();
  return (schema?.questions || []).filter((q) => {
    if (q.visible === false) return false;
    if (q.type === 'content_block') return false;
    if (coreKeys.has(q.fieldKey)) return false;
    return true;
  });
}

function getQuestionByFieldKey(schema, fieldKey) {
  return (schema?.questions || []).find((q) => q.fieldKey === fieldKey) || null;
}

/**
 * 從公開 schema 抽出選項／標籤（供學生端覆蓋硬編碼 fallback）。
 */
function extractOptionsMap(schema) {
  const optionsByFieldKey = {};
  const optionPairsByFieldKey = {};
  const labelsByFieldKey = {};
  const requiredByFieldKey = {};
  const visibleByFieldKey = {};
  const helpTextByFieldKey = {};
  const sectionsById = {};

  for (const section of schema?.sections || []) {
    if (section?.id) sectionsById[section.id] = section;
  }

  for (const q of schema?.questions || []) {
    if (!q?.fieldKey) continue;
    labelsByFieldKey[q.fieldKey] = q.label;
    requiredByFieldKey[q.fieldKey] = Boolean(q.required);
    visibleByFieldKey[q.fieldKey] = q.visible !== false;
    helpTextByFieldKey[q.fieldKey] = q.helpText || '';
    if (Array.isArray(q.options) && q.options.length > 0) {
      const pairs = q.options.map((o) => {
        if (typeof o === 'string') return { value: o, label: o };
        const value = String(o?.value ?? o?.label ?? '');
        const label = String(o?.label ?? o?.value ?? value);
        return { value, label };
      }).filter((o) => o.value);
      optionPairsByFieldKey[q.fieldKey] = pairs;
      optionsByFieldKey[q.fieldKey] = pairs.map((o) => o.value);
    }
  }

  return {
    optionsByFieldKey,
    optionPairsByFieldKey,
    departmentOptions: schema?.departmentOptions || {},
    labelsByFieldKey,
    requiredByFieldKey,
    visibleByFieldKey,
    helpTextByFieldKey,
    sectionsById,
    questions: schema?.questions || [],
    sections: schema?.sections || [],
  };
}

module.exports = {
  getPublishedSchema,
  savePublishedSchema,
  validateAndNormalizeSchema,
  getCustomQuestions,
  getQuestionByFieldKey,
  getCoreRegistrationFieldKeys,
  getSuggestedCoreFieldKeys,
  collectSchemaWarnings,
  extractOptionsMap,
  mergeMissingSystemParts,
  mergeMissingAnnouncementParts,
  schemaNeedsSystemMerge,
  schemaNeedsAnnouncementMerge,
  parseSchemaJson,
  buildDefaultEnglishTestFormSchema,
  ALLOWED_QUESTION_TYPES,
};
