const { Op } = require('sequelize');
const {
  expandExamTypes,
  buildRegistrationListWhere,
  buildRegistrationListOrder,
  buildRegistrationListSqlFilter,
  summarizeAppliedFilters,
  parseOrderedIds,
  applyOrderedIds,
  MAX_SORT_LEVELS,
} = require('../utils/englishTestRegistrationListFilters');

describe('englishTestRegistrationListFilters', () => {
  describe('expandExamTypes', () => {
    it('expands LR to include LRSW (and known aliases)', () => {
      const expanded = expandExamTypes(['LR']);
      expect(expanded).toEqual(expect.arrayContaining(['LR', 'LRSW', '聽讀（LR）', '聽說讀寫（LRSW）']));
    });

    it('expands SW to include LRSW (and known aliases)', () => {
      const expanded = expandExamTypes('SW');
      expect(expanded).toEqual(expect.arrayContaining(['SW', 'LRSW', '說寫（SW）']));
    });

    it('keeps NON and LRSW codes and aliases', () => {
      const expanded = expandExamTypes(['NON', 'LRSW']);
      expect(expanded).toEqual(expect.arrayContaining(['NON', 'LRSW', '不報考（NON）', '聽說讀寫（LRSW）']));
    });

    it('normalizes Chinese filter values before expand', () => {
      const expanded = expandExamTypes(['聽讀（LR）']);
      expect(expanded).toEqual(expect.arrayContaining(['LR', 'LRSW']));
    });
  });

  describe('buildRegistrationListWhere', () => {
    it('applies status and semester', () => {
      const where = buildRegistrationListWhere({ status: 'approved', semester: '115-1' });
      expect(where).toEqual({ status: 'approved', semester: '115-1' });
    });

    it('ignores status=all', () => {
      const where = buildRegistrationListWhere({ status: 'all', semester: '115-1' });
      expect(where).toEqual({ semester: '115-1' });
    });

    it('applies search OR on studentId/name/email', () => {
      const where = buildRegistrationListWhere({ search: 'A123' });
      expect(where[Op.or]).toHaveLength(3);
      expect(where[Op.or][0].studentId[Op.like]).toBe('%A123%');
    });

    it('applies date range inclusive of end day', () => {
      const where = buildRegistrationListWhere({ dateFrom: '2026-03-01', dateTo: '2026-03-31' });
      expect(where.createdAt[Op.gte]).toEqual(new Date('2026-03-01'));
      expect(where.createdAt[Op.lte].getHours()).toBe(23);
      expect(where.createdAt[Op.lte].getMinutes()).toBe(59);
    });

    it('applies examTypes with LR expansion', () => {
      const where = buildRegistrationListWhere({ examTypes: ['LR'] });
      expect(where.examType[Op.in]).toEqual(expect.arrayContaining(['LR', 'LRSW']));
    });

    it('applies single grade equality', () => {
      const where = buildRegistrationListWhere({ grades: ['一年級'] });
      expect(where.grade).toBe('一年級');
    });

    it('applies multiple grades with Op.in', () => {
      const where = buildRegistrationListWhere({ grades: ['一年級', '二年級'] });
      expect(where.grade[Op.in]).toEqual(['一年級', '二年級']);
    });

    it('accepts singular grade query param', () => {
      const where = buildRegistrationListWhere({ grade: '三年級' });
      expect(where.grade).toBe('三年級');
    });
  });

  describe('buildRegistrationListSqlFilter', () => {
    it('omits status and examType for stats cards while keeping advanced filters', () => {
      const where = buildRegistrationListWhere({
        status: 'pending',
        semester: '115-1',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-31',
        examTypes: ['LR'],
        search: 'A123',
        isLowIncome: '低收入戶',
      });
      const { whereClause, replacements } = buildRegistrationListSqlFilter(where, {
        omitKeys: ['status', 'examType'],
      });

      expect(whereClause).toContain('semester = :semester');
      expect(whereClause).toContain('createdAt >= :dateFrom');
      expect(whereClause).toContain('createdAt <= :dateTo');
      expect(whereClause).toContain('isLowIncome = :isLowIncome');
      expect(whereClause).toContain('studentId LIKE');
      expect(whereClause).not.toContain('status =');
      expect(whereClause).not.toContain('examType IN');
      expect(replacements.semester).toBe('115-1');
      expect(replacements.isLowIncome).toBe('低收入戶');
      expect(replacements.status).toBeUndefined();
      expect(replacements.examTypes).toBeUndefined();
    });

    it('includes grade IN when multiple grades selected', () => {
      const where = buildRegistrationListWhere({
        grades: ['一年級', '二年級'],
        semester: '115-1',
      });
      const { whereClause, replacements } = buildRegistrationListSqlFilter(where);
      expect(whereClause).toContain('grade IN (:grades)');
      expect(replacements.grades).toEqual(['一年級', '二年級']);
    });

    it('status stats omit only status and keep examTypes', () => {
      const where = buildRegistrationListWhere({
        status: 'approved',
        examTypes: ['SW'],
        semester: '115-1',
      });
      const { whereClause, replacements } = buildRegistrationListSqlFilter(where, {
        omitKeys: ['status'],
        paramPrefix: 'st_',
      });
      expect(whereClause).toContain('examType IN (:st_examTypes)');
      expect(whereClause).toContain('semester = :st_semester');
      expect(whereClause).not.toContain('status =');
      expect(replacements.st_examTypes).toEqual(expect.arrayContaining(['SW', 'LRSW']));
      expect(replacements.st_status).toBeUndefined();
    });

    it('exam stats omit only examType and keep status', () => {
      const where = buildRegistrationListWhere({
        status: 'approved',
        examTypes: ['SW'],
        semester: '115-1',
      });
      const { whereClause, replacements } = buildRegistrationListSqlFilter(where, {
        omitKeys: ['examType'],
        paramPrefix: 'ex_',
      });
      expect(whereClause).toContain('status = :ex_status');
      expect(whereClause).toContain('semester = :ex_semester');
      expect(whereClause).not.toContain('examType IN');
      expect(replacements.ex_status).toBe('approved');
      expect(replacements.ex_examTypes).toBeUndefined();
    });

    it('includes status and examType when not omitted', () => {
      const where = buildRegistrationListWhere({
        status: 'approved',
        examTypes: ['NON'],
        semester: '115-1',
      });
      const { whereClause, replacements } = buildRegistrationListSqlFilter(where);

      expect(whereClause).toContain('status = :status');
      expect(whereClause).toContain('examType IN (:examTypes)');
      expect(replacements.status).toBe('approved');
      expect(replacements.examTypes).toEqual(expect.arrayContaining(['NON']));
    });
  });

  describe('buildRegistrationListOrder', () => {
    it('uses explicit sortBy/sortOrder', () => {
      expect(buildRegistrationListOrder({ sortBy: 'id', sortOrder: 'DESC' })).toEqual([['id', 'DESC']]);
    });

    it('supports multi-level comma-separated sort', () => {
      const order = buildRegistrationListOrder({
        sortBy: 'createdAt,name,id',
        sortOrder: 'DESC,ASC,ASC',
      });
      expect(order).toEqual([
        ['createdAt', 'DESC'],
        ['name', 'ASC'],
        ['id', 'ASC'],
      ]);
    });

    it('supports up to five comma-separated sort levels', () => {
      const order = buildRegistrationListOrder({
        sortBy: 'grade,examType,name,studentId,id,createdAt',
        sortOrder: 'ASC,ASC,ASC,ASC,ASC,DESC',
      });
      expect(order.length).toBeGreaterThanOrEqual(MAX_SORT_LEVELS);
      // grade / examType each contribute an extra literal + column
      expect(order[0][0]).toEqual(expect.anything());
    });

    it('accepts grade and examType sort keys', () => {
      const order = buildRegistrationListOrder({
        sortBy: 'grade,examType',
        sortOrder: 'ASC,DESC',
      });
      expect(order.length).toBe(4);
    });

    it('ignores duplicate and invalid sort keys', () => {
      const order = buildRegistrationListOrder({
        sortBy: 'name,name,bogus,studentId',
        sortOrder: 'ASC,DESC,ASC,DESC',
      });
      expect(order).toEqual([
        ['name', 'ASC'],
        ['studentId', 'DESC'],
      ]);
    });

    it('keeps successSequence tie-breakers only for single-level sort', () => {
      const single = buildRegistrationListOrder({
        sortBy: 'successSequence',
        sortOrder: 'ASC',
      });
      expect(single).toHaveLength(3);

      const multi = buildRegistrationListOrder({
        sortBy: 'successSequence,name',
        sortOrder: 'ASC,ASC',
      });
      expect(multi).toHaveLength(2);
    });

    it('falls back to export status order for approved when no sort', () => {
      const order = buildRegistrationListOrder(
        { status: 'approved' },
        { preferExportStatusOrder: true }
      );
      expect(order).toHaveLength(2);
      expect(order[1]).toEqual(['id', 'ASC']);
    });

    it('defaults to createdAt DESC', () => {
      expect(buildRegistrationListOrder({})).toEqual([['createdAt', 'DESC']]);
    });
  });

  describe('parseOrderedIds / applyOrderedIds', () => {
    it('parses and dedupes orderedIds', () => {
      expect(parseOrderedIds('3,1,3,2,x,-1')).toEqual([3, 1, 2]);
    });

    it('reorders rows and appends missing ids in original relative order', () => {
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      expect(applyOrderedIds(rows, [3, 1]).map((r) => r.id)).toEqual([3, 1, 2, 4]);
    });

    it('returns original rows when orderedIds empty', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      expect(applyOrderedIds(rows, [])).toBe(rows);
    });
  });

  describe('summarizeAppliedFilters', () => {
    it('includes semester and status', () => {
      expect(summarizeAppliedFilters({ status: 'pending', semester: '115-1' })).toEqual({
        status: 'pending',
        semester: '115-1',
      });
    });

    it('includes grades when provided', () => {
      expect(summarizeAppliedFilters({ grades: ['一年級', '四年級以上'] }).grades).toEqual([
        '一年級',
        '四年級以上',
      ]);
    });

    it('includes orderedIdsCount when provided', () => {
      expect(summarizeAppliedFilters({ orderedIds: '1,2,3' }).orderedIdsCount).toBe(3);
    });
  });
});
