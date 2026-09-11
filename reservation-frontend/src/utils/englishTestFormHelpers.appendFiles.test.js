import { appendUniqueFiles, getFileIdentityKey } from './englishTestFormHelpers';

function makeFile({ name, size = 100, lastModified = 1 }) {
  return { name, size, lastModified };
}

describe('appendUniqueFiles', () => {
  it('appends a second pick without replacing the first', () => {
    const first = [makeFile({ name: 'a.pdf', size: 10, lastModified: 1 })];
    const second = [makeFile({ name: 'b.pdf', size: 20, lastModified: 2 })];
    expect(appendUniqueFiles(first, second)).toEqual([...first, ...second]);
  });

  it('skips duplicates by name+size+lastModified', () => {
    const existing = [makeFile({ name: 'a.pdf', size: 10, lastModified: 1 })];
    const incoming = [
      makeFile({ name: 'a.pdf', size: 10, lastModified: 1 }),
      makeFile({ name: 'b.pdf', size: 20, lastModified: 2 }),
    ];
    expect(appendUniqueFiles(existing, incoming)).toEqual([
      existing[0],
      incoming[1],
    ]);
  });

  it('returns existing when incoming is empty', () => {
    const existing = [makeFile({ name: 'a.pdf' })];
    expect(appendUniqueFiles(existing, [])).toBe(existing);
  });

  it('builds a stable identity key', () => {
    expect(getFileIdentityKey(makeFile({ name: 'x.png', size: 3, lastModified: 9 }))).toBe(
      'x.png::3::9',
    );
  });
});
