import { appendExportListParams } from '../utils/englishTestExportParams';

describe('appendExportListParams', () => {
  it('includes status, semester, search, and sort like the list query', () => {
    const params = appendExportListParams(new URLSearchParams(), {
      statusFilter: 'approved',
      searchTerm: '王小明',
      advancedFilters: {
        semester: '115-1',
        dateFrom: '2026-03-01',
        examTypes: ['LR'],
        isLowIncome: '是',
      },
      sortConfig: { key: 'id', direction: 'DESC' },
    });

    expect(params.get('status')).toBe('approved');
    expect(params.get('semester')).toBe('115-1');
    expect(params.get('search')).toBe('王小明');
    expect(params.get('dateFrom')).toBe('2026-03-01');
    expect(params.getAll('examTypes')).toEqual(['LR']);
    expect(params.get('isLowIncome')).toBe('是');
    expect(params.get('sortBy')).toBe('id');
    expect(params.get('sortOrder')).toBe('DESC');
  });

  it('omits status when all', () => {
    const params = appendExportListParams(new URLSearchParams(), {
      statusFilter: 'all',
      advancedFilters: { semester: '114-2' },
    });
    expect(params.has('status')).toBe(false);
    expect(params.get('semester')).toBe('114-2');
  });
});
