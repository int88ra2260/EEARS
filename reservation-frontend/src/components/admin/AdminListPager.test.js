import { clampPage, slicePage } from './AdminListPager';

describe('slicePage', () => {
  const items = [1, 2, 3, 4, 5, 6, 7];

  it('returns the first page', () => {
    expect(slicePage(items, 1, 3)).toMatchObject({
      current: 1,
      pages: 3,
      rows: [1, 2, 3],
    });
  });

  it('clamps a page past the end', () => {
    expect(clampPage(9, items.length, 3)).toBe(3);
    expect(slicePage(items, 9, 3).rows).toEqual([7]);
  });
});
