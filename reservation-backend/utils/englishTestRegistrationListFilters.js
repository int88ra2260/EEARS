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
  'status',
  'createdAt',
  'updatedAt',
  'approvedAt',
  'successSequence',
]);

/**
 * 測驗類型：LR／SW 需一併包含 LRSW（與列表 API 相同）。
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
    if (type === 'LR') {
      if (!expandedArray.includes('LR')) expandedArray.push('LR');
      if (!expandedArray.includes('LRSW')) expandedArray.push('LRSW');
    } else if (type === 'SW') {
      if (!expandedArray.includes('SW')) expandedArray.push('SW');
      if (!expandedArray.includes('LRSW')) expandedArray.push('LRSW');
    } else if (!expandedArray.includes(type)) {
      expandedArray.push(type);
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

/**
 * @param {object} query
 * @param {{ preferExportStatusOrder?: boolean }} [options]
 *   preferExportStatusOrder：未指定 sortBy 時，已通過／報名成功沿用匯出專用排序
 * @returns {Array}
 */
function buildRegistrationListOrder(query = {}, options = {}) {
  const { sortBy, sortOrder, status } = query;
  const { preferExportStatusOrder = false } = options;

  if (sortBy && sortOrder) {
    const order = String(sortOrder).toUpperCase();
    if (VALID_SORT_FIELDS.has(sortBy) && (order === 'ASC' || order === 'DESC')) {
      if (sortBy === 'status') {
        return [[
          Sequelize.literal(
            "CASE WHEN status = 'pending' THEN 1 WHEN status = 'approved' THEN 2 WHEN status = 'revision' THEN 3 WHEN status = 'success' THEN 4 WHEN status = 'failed' THEN 5 ELSE 6 END"
          ),
          order,
        ]];
      }
      if (sortBy === 'successSequence') {
        return [
          [Sequelize.literal('COALESCE("successSequence", 2147483647)'), order],
          ['approvedAt', 'ASC'],
          ['id', 'ASC'],
        ];
      }
      return [[sortBy, order]];
    }
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
    filters.sortBy = sortBy;
    filters.sortOrder = sortOrder || 'DESC';
  }
  return filters;
}

module.exports = {
  expandExamTypes,
  buildRegistrationListWhere,
  buildRegistrationListOrder,
  summarizeAppliedFilters,
  VALID_SORT_FIELDS,
};
