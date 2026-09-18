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
        grades: ['一年級', '二年級'],
        isLowIncome: '是',
      },
      sortConfig: { key: 'id', direction: 'DESC' },
    });

    expect(params.get('status')).toBe('approved');
    expect(params.get('semester')).toBe('115-1');
    expect(params.get('search')).toBe('王小明');
    expect(params.get('dateFrom')).toBe('2026-03-01');
    expect(params.getAll('examTypes')).toEqual(['LR']);
    expect(params.getAll('grades')).toEqual(['一年級', '二年級']);
    expect(params.get('isLowIncome')).toBe('是');
    expect(params.get('sortBy')).toBe('id');
    expect(params.get('sortOrder')).toBe('DESC');
  });

  it('serializes multi-level sort for export', () => {
    const params = appendExportListParams(new URLSearchParams(), {
      statusFilter: 'all',
      advancedFilters: {},
      sortConfig: {
        levels: [
          { key: 'createdAt', direction: 'DESC' },
          { key: 'name', direction: 'ASC' },
        ],
      },
    });
    expect(params.get('sortBy')).toBe('createdAt,name');
    expect(params.get('sortOrder')).toBe('DESC,ASC');
  });

  it('omits status when all', () => {
    const params = appendExportListParams(new URLSearchParams(), {
      statusFilter: 'all',
      advancedFilters: { semester: '114-2' },
    });
    expect(params.has('status')).toBe(false);
    expect(params.get('semester')).toBe('114-2');
  });

  it('appends orderedIds when provided', () => {
    const params = appendExportListParams(new URLSearchParams(), {
      statusFilter: 'approved',
      orderedIds: [10, 20, 'x', 30],
    });
    expect(params.get('orderedIds')).toBe('10,20,30');
  });
});
