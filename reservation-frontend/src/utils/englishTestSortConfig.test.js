import {
  MAX_SORT_LEVELS,
  normalizeSortConfig,
  createPrimarySortConfig,
  createSortConfigFromLevels,
  appendSortQueryParams,
  applyHeaderSortClick,
} from './englishTestSortConfig';

describe('englishTestSortConfig', () => {
  it('normalizes legacy single-key config', () => {
    expect(normalizeSortConfig({ key: 'name', direction: 'desc' })).toEqual({
      levels: [{ key: 'name', direction: 'DESC' }],
      key: 'name',
      direction: 'DESC',
    });
  });

  it('keeps up to five unique levels', () => {
    const cfg = createSortConfigFromLevels([
      { key: 'grade', direction: 'ASC' },
      { key: 'examType', direction: 'ASC' },
      { key: 'name', direction: 'ASC' },
      { key: 'name', direction: 'DESC' },
      { key: 'id', direction: 'ASC' },
      { key: 'studentId', direction: 'ASC' },
      { key: 'createdAt', direction: 'DESC' },
    ]);
    expect(cfg.levels).toHaveLength(MAX_SORT_LEVELS);
    expect(cfg.levels.map((l) => l.key)).toEqual([
      'grade',
      'examType',
      'name',
      'id',
      'studentId',
    ]);
    expect(cfg.key).toBe('grade');
  });

  it('createPrimarySortConfig replaces with one level', () => {
    expect(createPrimarySortConfig('status', 'DESC').levels).toEqual([
      { key: 'status', direction: 'DESC' },
    ]);
  });

  it('appendSortQueryParams writes comma-separated sortBy/sortOrder', () => {
    const params = appendSortQueryParams(new URLSearchParams(), {
      levels: [
        { key: 'createdAt', direction: 'DESC' },
        { key: 'id', direction: 'ASC' },
      ],
    });
    expect(params.get('sortBy')).toBe('createdAt,id');
    expect(params.get('sortOrder')).toBe('DESC,ASC');
  });

  it('applyHeaderSortClick without shift replaces primary level', () => {
    const { config } = applyHeaderSortClick(
      { levels: [{ key: 'name', direction: 'ASC' }] },
      'grade',
      { shiftKey: false }
    );
    expect(config.levels).toEqual([{ key: 'grade', direction: 'ASC' }]);
  });

  it('applyHeaderSortClick with shift appends or toggles', () => {
    const first = applyHeaderSortClick(
      { levels: [{ key: 'grade', direction: 'ASC' }] },
      'name',
      { shiftKey: true }
    );
    expect(first.config.levels.map((l) => l.key)).toEqual(['grade', 'name']);

    const toggled = applyHeaderSortClick(first.config, 'name', { shiftKey: true });
    expect(toggled.config.levels[1].direction).toBe('DESC');
  });
});
