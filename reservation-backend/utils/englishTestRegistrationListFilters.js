/**
 * 培力英檢報名列表／匯出共用篩選與排序。
 * 與 GET /english-test/registrations 的 where／order 語意對齊。
 */
const { Op, Sequelize } = require('sequelize');

const VALID_SORT_FIELDS = new Set([
  'id',
  'studentId',
  'name',
  'email',
  'college',
  'department',
  'grade',
  'examType',
  'status',
  'createdAt',
  'updatedAt',
  'approvedAt',
  'successSequence',
]);

/** 匯出手動順序：query orderedIds 上限 */
const MAX_ORDERED_IDS = 2000;

const {
  normalizeExamTypeCode,
  EXACT_ALIAS_TO_CODE,
} = require('./englishTestExamType');

function pushUnique(list, value) {
  if (value != null && value !== '' && !list.includes(value)) list.push(value);
}

/** 同一代碼的歷史別名（篩選時一併納入，避免正規化前漏資料） */
function aliasesForCanonicalCode(code) {
  const out = [code];
  Object.entries(EXACT_ALIAS_TO_CODE).forEach(([alias, canonical]) => {
    if (canonical === code) pushUnique(out, alias);
  });
  return out;
}

/**
 * 測驗類型：LR／SW 需一併包含 LRSW（與列表 API 相同）。
 * 會先正規化為代碼，並附帶已知中文舊值別名。
 * @param {string|string[]} examTypes
 * @returns {string[]}
 */
function expandExamTypes(examTypes) {
  const examArray = Array.isArray(examTypes)
    ? examTypes
    : (typeof examTypes === 'string'
      ? examTypes.split(',').map((s) => s.trim()).filter(Boolean)
      : examTypes != null && examTypes !== ''
        ? [examTypes]
        : []);

  if (examArray.length === 0) return [];

  const expandedArray = [];
  examArray.forEach((type) => {
    const code = normalizeExamTypeCode(type) || String(type || '').trim();
    if (code === 'LR') {
      aliasesForCanonicalCode('LR').forEach((v) => pushUnique(expandedArray, v));
      aliasesForCanonicalCode('LRSW').forEach((v) => pushUnique(expandedArray, v));
    } else if (code === 'SW') {
      aliasesForCanonicalCode('SW').forEach((v) => pushUnique(expandedArray, v));
      aliasesForCanonicalCode('LRSW').forEach((v) => pushUnique(expandedArray, v));
    } else if (code === 'LRSW' || code === 'NON') {
      aliasesForCanonicalCode(code).forEach((v) => pushUnique(expandedArray, v));
    } else {
      pushUnique(expandedArray, code);
    }
  });
  return expandedArray;
}

/**
 * @param {object} query - 通常為 req.query
 * @returns {object} Sequelize where
 */
function buildRegistrationListWhere(query = {}) {
  const {
    status,
    search,
    dateFrom,
    dateTo,
    examTypes,
    isLowIncome,
    hasDisabilityCard,
    semester,
  } = query;

  const where = {};

  if (status && status !== 'all') {
    where.status = status;
  }

  if (search) {
    where[Op.or] = [
      { studentId: { [Op.like]: `%${search}%` } },
      { name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt[Op.gte] = new Date(dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt[Op.lte] = endDate;
    }
  }

  const expandedExamTypes = expandExamTypes(examTypes);
  if (expandedExamTypes.length > 0) {
    where.examType = { [Op.in]: expandedExamTypes };
  }

  if (isLowIncome) {
    where.isLowIncome = isLowIncome;
  }
  if (hasDisabilityCard) {
    where.hasDisabilityCard = hasDisabilityCard;
  }
  if (semester) {
    where.semester = semester;
  }

  return where;
}

const MAX_SORT_LEVELS = 5;

/**
 * 解析 sortBy / sortOrder（支援單值、逗號字串、或陣列；最多五層）。
 * @param {object} query
 * @returns {Array<{ key: string, direction: 'ASC'|'DESC' }>}
 */
function parseSortLevels(query = {}) {
  const { sortBy, sortOrder } = query;
  if (sortBy == null || sortBy === '') return [];

  const toList = (value) => {
    if (Array.isArray(value)) {
      return value.flatMap((v) => String(v).split(',')).map((s) => s.trim()).filter(Boolean);
    }
    return String(value).split(',').map((s) => s.trim()).filter(Boolean);
  };

  const keys = toList(sortBy);
  const orders = toList(sortOrder);
  const levels = [];
  const seen = new Set();

  for (let i = 0; i < keys.length && levels.length < MAX_SORT_LEVELS; i += 1) {
    const key = keys[i];
    if (!VALID_SORT_FIELDS.has(key) || seen.has(key)) continue;
    const direction = String(orders[i] || orders[0] || 'DESC').toUpperCase();
    if (direction !== 'ASC' && direction !== 'DESC') continue;
    seen.add(key);
    levels.push({ key, direction });
  }

  return levels;
}

function orderClauseForField(key, direction) {
  if (key === 'status') {
    return [[
      Sequelize.literal(
        "CASE WHEN status = 'pending' THEN 1 WHEN status = 'approved' THEN 2 WHEN status = 'revision' THEN 3 WHEN status = 'success' THEN 4 WHEN status = 'failed' THEN 5 ELSE 6 END"
      ),
      direction,
    ]];
  }
  if (key === 'successSequence') {
    return [[Sequelize.literal('COALESCE("successSequence", 2147483647)'), direction]];
  }
  if (key === 'grade') {
    // 年級自然序：一年級…四年級；其餘依原文再排
    return [[
      Sequelize.literal(
        `CASE
          WHEN grade LIKE '%一年級%' OR grade IN ('1','一年級') THEN 1
          WHEN grade LIKE '%二年級%' OR grade IN ('2','二年級') THEN 2
          WHEN grade LIKE '%三年級%' OR grade IN ('3','三年級') THEN 3
          WHEN grade LIKE '%四年級%' OR grade IN ('4','四年級','四年級以上') THEN 4
          ELSE 99
        END`
      ),
      direction,
    ], ['grade', direction]];
  }
  if (key === 'examType') {
    return [[
      Sequelize.literal(
        `CASE
          WHEN examType IN ('LRSW','聽說讀寫（LRSW）') THEN 1
          WHEN examType IN ('LR','聽讀（LR）') THEN 2
          WHEN examType IN ('SW','說寫（SW）') THEN 3
          WHEN examType IN ('NON','不報考（NON）') THEN 4
          ELSE 99
        END`
      ),
      direction,
    ], ['examType', direction]];
  }
  return [[key, direction]];
}

/**
 * 解析匯出手動順序 ID（query orderedIds）。
 * @param {string|string[]|number[]|null|undefined} raw
 * @returns {number[]}
 */
function parseOrderedIds(raw) {
  if (raw == null || raw === '') return [];
  const toList = (value) => {
    if (Array.isArray(value)) {
      return value.flatMap((v) => String(v).split(',')).map((s) => s.trim()).filter(Boolean);
    }
    return String(value).split(',').map((s) => s.trim()).filter(Boolean);
  };
  const seen = new Set();
  const ids = [];
  for (const token of toList(raw)) {
    const n = Number(token);
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
    if (ids.length >= MAX_ORDERED_IDS) break;
  }
  return ids;
}

/**
 * 依 orderedIds 重排列；未列於 orderedIds 者維持原相對順序接在後面。
 * @param {Array<object>} rows
 * @param {number[]} orderedIds
 * @returns {Array<object>}
 */
function applyOrderedIds(rows, orderedIds) {
  const list = rows || [];
  if (!orderedIds || orderedIds.length === 0) return list;

  const byId = new Map();
  list.forEach((row) => {
    const id = Number(row && row.id);
    if (Number.isInteger(id)) byId.set(id, row);
  });

  const used = new Set();
  const ordered = [];
  orderedIds.forEach((id) => {
    const row = byId.get(id);
    if (!row || used.has(id)) return;
    ordered.push(row);
    used.add(id);
  });
  list.forEach((row) => {
    const id = Number(row && row.id);
    if (!Number.isInteger(id) || used.has(id)) return;
    ordered.push(row);
  });
  return ordered;
}

/**
 * @param {object} query
 * @param {{ preferExportStatusOrder?: boolean }} [options]
 *   preferExportStatusOrder：未指定 sortBy 時，已通過／報名成功沿用匯出專用排序
 * @returns {Array}
 */
function buildRegistrationListOrder(query = {}, options = {}) {
  const { status } = query;
  const { preferExportStatusOrder = false } = options;
  const levels = parseSortLevels(query);

  if (levels.length > 0) {
    const order = levels.flatMap((level) => orderClauseForField(level.key, level.direction));
    // 僅單層 successSequence 時保留舊版平手規則
    if (levels.length === 1 && levels[0].key === 'successSequence') {
      order.push(['approvedAt', 'ASC'], ['id', 'ASC']);
    }
    return order;
  }

  if (preferExportStatusOrder) {
    if (status === 'approved') {
      return [
        [Sequelize.literal('COALESCE("approvedAt", "createdAt")'), 'ASC'],
        ['id', 'ASC'],
      ];
    }
    if (status === 'success') {
      return [
        [Sequelize.literal('COALESCE("successSequence", 2147483647)'), 'ASC'],
        [Sequelize.literal('COALESCE("approvedAt", "createdAt")'), 'ASC'],
      ];
    }
  }

  return [['createdAt', 'DESC']];
}


/**
 * 將 buildRegistrationListWhere 的結果轉成 raw SQL WHERE（供 stats 聚合用）。
 * 卡片要顯示「狀態／測驗類型」分佈，因此預設略過這兩個維度，其餘進階篩選與列表一致。
 *
 * @param {object} where - buildRegistrationListWhere 回傳值
 * @param {{ omitKeys?: string[], paramPrefix?: string }} [options]
 * @returns {{ whereClause: string, replacements: object }}
 */
function buildRegistrationListSqlFilter(where = {}, options = {}) {
  const omit = new Set(options.omitKeys || []);
  const prefix = options.paramPrefix || '';
  const whereConditions = [];
  const replacements = {};
  const p = (name) => `${prefix}${name}`;

  if (!omit.has('status') && where.status) {
    whereConditions.push(`status = :${p('status')}`);
    replacements[p('status')] = where.status;
  }

  if (!omit.has('createdAt') && where.createdAt) {
    if (where.createdAt[Op.gte]) {
      whereConditions.push(`createdAt >= :${p('dateFrom')}`);
      replacements[p('dateFrom')] = where.createdAt[Op.gte];
    }
    if (where.createdAt[Op.lte]) {
      whereConditions.push(`createdAt <= :${p('dateTo')}`);
      replacements[p('dateTo')] = where.createdAt[Op.lte];
    }
  }

  if (!omit.has('examType') && where.examType && where.examType[Op.in]) {
    whereConditions.push(`examType IN (:${p('examTypes')})`);
    replacements[p('examTypes')] = where.examType[Op.in];
  }

  if (!omit.has('isLowIncome') && where.isLowIncome) {
    whereConditions.push(`isLowIncome = :${p('isLowIncome')}`);
    replacements[p('isLowIncome')] = where.isLowIncome;
  }

  if (!omit.has('hasDisabilityCard') && where.hasDisabilityCard) {
    whereConditions.push(`hasDisabilityCard = :${p('hasDisabilityCard')}`);
    replacements[p('hasDisabilityCard')] = where.hasDisabilityCard;
  }

  if (!omit.has('semester') && where.semester) {
    whereConditions.push(`semester = :${p('semester')}`);
    replacements[p('semester')] = where.semester;
  }

  if (!omit.has('search') && where[Op.or]) {
    const orConditions = [];
    where[Op.or].forEach((condition, index) => {
      if (condition.studentId && condition.studentId[Op.like]) {
        orConditions.push(`studentId LIKE :${p(`search${index}`)}`);
        replacements[p(`search${index}`)] = condition.studentId[Op.like];
      } else if (condition.name && condition.name[Op.like]) {
        orConditions.push(`name LIKE :${p(`search${index}`)}`);
        replacements[p(`search${index}`)] = condition.name[Op.like];
      } else if (condition.email && condition.email[Op.like]) {
        orConditions.push(`email LIKE :${p(`search${index}`)}`);
        replacements[p(`search${index}`)] = condition.email[Op.like];
      }
    });
    if (orConditions.length > 0) {
      whereConditions.push(`(${orConditions.join(' OR ')})`);
    }
  }

  return {
    whereClause: whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '',
    replacements,
  };
}

/**
 * 供稽核 log 記錄實際套用的篩選（不含空值）。
 */
function summarizeAppliedFilters(query = {}) {
  const {
    status,
    search,
    dateFrom,
    dateTo,
    examTypes,
    isLowIncome,
    hasDisabilityCard,
    semester,
    sortBy,
    sortOrder,
  } = query;

  const filters = {
    status: status && status !== 'all' ? status : 'all',
  };
  if (search) filters.search = search;
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;
  if (examTypes) {
    filters.examTypes = Array.isArray(examTypes)
      ? examTypes
      : String(examTypes).split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (isLowIncome) filters.isLowIncome = isLowIncome;
  if (hasDisabilityCard) filters.hasDisabilityCard = hasDisabilityCard;
  if (semester) filters.semester = semester;
  if (sortBy) {
    const levels = parseSortLevels(query);
    if (levels.length > 0) {
      filters.sortBy = levels.map((l) => l.key);
      filters.sortOrder = levels.map((l) => l.direction);
    } else {
      filters.sortBy = sortBy;
      filters.sortOrder = sortOrder || 'DESC';
    }
  }
  const orderedIds = parseOrderedIds(query.orderedIds);
  if (orderedIds.length > 0) {
    filters.orderedIdsCount = orderedIds.length;
  }
  return filters;
}

module.exports = {
  expandExamTypes,
  buildRegistrationListWhere,
  buildRegistrationListOrder,
  buildRegistrationListSqlFilter,
  parseSortLevels,
  parseOrderedIds,
  applyOrderedIds,
  summarizeAppliedFilters,
  VALID_SORT_FIELDS,
  MAX_SORT_LEVELS,
  MAX_ORDERED_IDS,
};
