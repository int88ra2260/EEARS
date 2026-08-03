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
      ? { intro: '', imageUrl: '', imageAlt: '', warning: '', listItems: [], images: [] }
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

/** 檢查 raw schema 是否缺少預設系統階段／系統題（例如步驟 1／2）。 */
function schemaNeedsSystemMerge(raw) {
  const defaults = buildDefaultEnglishTestFormSchema();
  const sectionIds = new Set((raw?.sections || []).map((s) => s && s.id).filter(Boolean));
  const fieldKeys = new Set((raw?.questions || []).map((q) => q && q.fieldKey).filter(Boolean));
  for (const section of defaults.sections) {
    if (!sectionIds.has(section.id)) return true;
  }
  const defaultSectionOrder = new Map(defaults.sections.map((s) => [s.id, s.order]));
  for (const section of raw?.sections || []) {
    if (!section?.id) continue;
    if (
      defaultSectionOrder.has(section.id) &&
      Number(section.order) !== Number(defaultSectionOrder.get(section.id))
    ) {
      return true;
    }
  }
  for (const q of defaults.questions) {
    if (!q.system) continue;
    if (!fieldKeys.has(q.fieldKey)) return true;
  }
  return false;
}

/**
 * 合併驗證：系統題不可刪除／不可改 fieldKey；自訂題不可冒充系統欄位名。
 */
function validateAndNormalizeSchema(incoming, previous) {
  const prev = mergeMissingSystemParts(previous || buildDefaultEnglishTestFormSchema());
  // 先補齊缺漏系統階段／題，避免舊後台 payload 存檔時把步驟 1／2 蓋掉
  const base = mergeMissingSystemParts(cloneSchema(incoming));

  const sections = normalizeSections(base.sections, prev.sections);
  const questions = (Array.isArray(base.questions) ? base.questions : []).map(normalizeQuestion);

  const prevSystemById = new Map(
    (prev.questions || []).filter((q) => q.system).map((q) => [q.id, q])
  );
  const nextById = new Map(questions.map((q) => [q.id, q]));

  for (const [id, prevQ] of prevSystemById) {
    const nextQ = nextById.get(id);
    if (!nextQ) {
      const err = new Error(`系統題不可刪除：${prevQ.label}（${prevQ.fieldKey}）`);
      err.status = 400;
      err.code = 'SYSTEM_QUESTION_REQUIRED';
      throw err;
    }
    if (nextQ.fieldKey !== prevQ.fieldKey) {
      const err = new Error(`系統題不可變更 fieldKey：${prevQ.fieldKey}`);
      err.status = 400;
      err.code = 'SYSTEM_FIELD_KEY_LOCKED';
      throw err;
    }
    nextQ.system = true;
  }

  const reservedKeys = new Set(
    (prev.questions || []).filter((q) => q.system).map((q) => q.fieldKey)
  );
  for (const q of questions) {
    if (!q.system && reservedKeys.has(q.fieldKey)) {
      const err = new Error(`自訂題不可使用系統欄位鍵：${q.fieldKey}`);
      err.status = 400;
      err.code = 'FIELD_KEY_RESERVED';
      throw err;
    }
  }

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

  return {
    title: String(base.title || prev.title || '培力英檢報名表單').trim(),
    version: Number(base.version) || prev.version || 1,
    sections: sections.sort((a, b) => a.order - b.order),
    questions,
    departmentOptions:
      base.departmentOptions && typeof base.departmentOptions === 'object'
        ? base.departmentOptions
        : prev.departmentOptions || {},
  };
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

  // 舊 DB 缺步驟 1／2 時：讀取即補齊並寫回，之後台／學生端都看得到
  if (allowPersistMerge && schemaNeedsSystemMerge(raw)) {
    const nextVersion = (Number(row.version) || 1) + 1;
    const persisted = await EnglishTestFormSchema.create({
      version: nextVersion,
      status: 'published',
      schemaJson: schema,
      changeSummary: '自動補齊缺漏系統階段（步驟1/2、確認勾選、證件照說明等）',
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

/**
 * 將預設 schema 中缺漏的系統區塊／題目補進既有 schema（不覆寫已存在的題）。
 * 讓已部署環境自動出現步驟 1／2、確認勾選、證件照說明等，無需強制重設。
 */
function mergeMissingSystemParts(schema) {
  const defaults = buildDefaultEnglishTestFormSchema();
  const next = cloneSchema(schema || defaults);

  if (!Array.isArray(next.sections)) next.sections = [];
  if (!Array.isArray(next.questions)) next.questions = [];

  const sectionIds = new Set(next.sections.map((s) => s.id));
  for (const section of defaults.sections) {
    if (!sectionIds.has(section.id)) {
      next.sections.push({ ...section });
      sectionIds.add(section.id);
    }
  }
  // 對齊系統階段順序（避免舊 DB 的 eligibility.order=1 排在步驟1前面）
  const defaultSectionOrder = new Map(defaults.sections.map((s) => [s.id, s.order]));
  for (const section of next.sections) {
    if (defaultSectionOrder.has(section.id)) {
      section.order = defaultSectionOrder.get(section.id);
    }
  }
  next.sections.sort((a, b) => (a.order || 0) - (b.order || 0));

  const qIds = new Set(next.questions.map((q) => q.id));
  const fieldKeys = new Set(next.questions.map((q) => q.fieldKey));
  for (const q of defaults.questions) {
    if (!q.system) continue;
    if (qIds.has(q.id)) continue;
    if (fieldKeys.has(q.fieldKey)) continue;
    next.questions.push(cloneSchema(q));
    qIds.add(q.id);
    fieldKeys.add(q.fieldKey);
  }

  if (!next.departmentOptions || typeof next.departmentOptions !== 'object') {
    next.departmentOptions = defaults.departmentOptions;
  }
  if (!next.title) next.title = defaults.title;

  return next;
}

/**
 * 以完整 schema 覆寫並遞增版本（Google Forms 式儲存）。
 */
async function savePublishedSchema(schemaJson, { userId = null, changeSummary = null } = {}) {
  const current = await getPublishedSchema({ allowPersistMerge: false });
  const normalized = validateAndNormalizeSchema(schemaJson, current.schema);
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
  };
}

function getCustomQuestions(schema) {
  return (schema?.questions || []).filter((q) => !q.system && q.visible !== false);
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
  extractOptionsMap,
  mergeMissingSystemParts,
  schemaNeedsSystemMerge,
  parseSchemaJson,
  buildDefaultEnglishTestFormSchema,
  ALLOWED_QUESTION_TYPES,
};
