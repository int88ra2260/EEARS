'use strict';

const {
  normalizeExamTypeCode,
  normalizeExamTypeOptions,
} = require('../utils/englishTestExamType');

describe('englishTestExamType', () => {
  describe('normalizeExamTypeCode', () => {
    it('keeps canonical codes', () => {
      expect(normalizeExamTypeCode('LRSW')).toBe('LRSW');
      expect(normalizeExamTypeCode('LR')).toBe('LR');
      expect(normalizeExamTypeCode('SW')).toBe('SW');
      expect(normalizeExamTypeCode('NON')).toBe('NON');
    });

    it('maps Chinese label values', () => {
      expect(normalizeExamTypeCode('聽說讀寫（LRSW）')).toBe('LRSW');
      expect(normalizeExamTypeCode('四項全考（LRSW）')).toBe('LRSW');
      expect(normalizeExamTypeCode('聽讀（LR）')).toBe('LR');
      expect(normalizeExamTypeCode('說寫（SW）')).toBe('SW');
      expect(normalizeExamTypeCode('不報考（NON）')).toBe('NON');
      expect(normalizeExamTypeCode('不報考（NON）- 作答完前四題即可送出表單。')).toBe('NON');
    });

    it('returns null for empty/unknown', () => {
      expect(normalizeExamTypeCode('')).toBeNull();
      expect(normalizeExamTypeCode(null)).toBeNull();
      expect(normalizeExamTypeCode('TOEIC')).toBeNull();
    });
  });

  describe('normalizeExamTypeOptions', () => {
    it('converts Chinese values to codes and keeps labels', () => {
      const next = normalizeExamTypeOptions(
        [
          { value: '聽說讀寫（LRSW）', label: '聽說讀寫（LRSW）' },
          { value: '聽讀（LR）', label: '聽讀（LR）' },
        ],
        [
          { value: 'LRSW', label: '聽說讀寫（LRSW）' },
          { value: 'LR', label: '聽讀（LR）' },
          { value: 'SW', label: '說寫（SW）' },
          { value: 'NON', label: '不報考（NON）' },
        ]
      );
      expect(next.find((o) => o.value === 'LRSW')).toEqual({
        value: 'LRSW',
        label: '聽說讀寫（LRSW）',
      });
      expect(next.find((o) => o.value === 'LR')?.value).toBe('LR');
      expect(next.map((o) => o.value).sort()).toEqual(['LR', 'LRSW', 'NON', 'SW']);
    });
  });
});
