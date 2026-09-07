const { Op } = require('sequelize');
const {
  expandExamTypes,
  buildRegistrationListWhere,
  buildRegistrationListOrder,
  summarizeAppliedFilters,
} = require('../utils/englishTestRegistrationListFilters');

describe('englishTestRegistrationListFilters', () => {
  describe('expandExamTypes', () => {
    it('expands LR to include LRSW', () => {
      expect(expandExamTypes(['LR'])).toEqual(['LR', 'LRSW']);
    });

    it('expands SW to include LRSW', () => {
      expect(expandExamTypes('SW')).toEqual(['SW', 'LRSW']);
    });

    it('keeps NON and LRSW as-is', () => {
      expect(expandExamTypes(['NON', 'LRSW'])).toEqual(['NON', 'LRSW']);
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
      expect(where.examType[Op.in]).toEqual(['LR', 'LRSW']);
    });
  });

  describe('buildRegistrationListOrder', () => {
    it('uses explicit sortBy/sortOrder', () => {
      expect(buildRegistrationListOrder({ sortBy: 'id', sortOrder: 'DESC' })).toEqual([['id', 'DESC']]);
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

  describe('summarizeAppliedFilters', () => {
    it('includes semester and status', () => {
      expect(summarizeAppliedFilters({ status: 'pending', semester: '115-1' })).toEqual({
        status: 'pending',
        semester: '115-1',
      });
    });
  });
});
