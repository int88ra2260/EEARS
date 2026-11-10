'use strict';

const {
  compactPersonName,
  normalizePersonName,
  personNamesMatch,
  isCampusPersonName,
} = require('../utils/personName');

describe('personName', () => {
  it('treats a space between Chinese characters as the same name', () => {
    expect(compactPersonName('杜 威')).toBe('杜威');
    expect(compactPersonName('杜　威')).toBe('杜威');
    expect(compactPersonName('王 小 明')).toBe('王小明');
    expect(personNamesMatch('杜 威', '杜威')).toBe(true);
    expect(personNamesMatch('王 小明', '王小明')).toBe(true);
  });

  it('keeps spaces between English words', () => {
    expect(compactPersonName('Mary Ann')).toBe('Mary Ann');
    expect(personNamesMatch('Mary Ann', 'MaryAnn')).toBe(false);
    expect(personNamesMatch('Mary Ann', 'mary ann')).toBe(true);
  });

  it('still distinguishes different Chinese names', () => {
    expect(personNamesMatch('杜威', '杜維')).toBe(false);
    expect(normalizePersonName('王小明')).toBe('王小明');
    expect(normalizePersonName('王小華')).toBe('王小華');
  });

  it('replaces the campus private-use character for 祺', () => {
    expect(compactPersonName('曾\uE273鈞')).toBe('曾祺鈞');
    expect(personNamesMatch('曾\uE273鈞', '曾祺鈞')).toBe(true);
    expect(compactPersonName('曾\uE123鈞')).toBe('曾\uE123鈞');
  });

  it('accepts a campus name that uses a private-use character', () => {
    expect(isCampusPersonName('曾\uE273鈞')).toBe(true);
    expect(isCampusPersonName('王小明')).toBe(true);
    expect(isCampusPersonName('')).toBe(false);
    expect(isCampusPersonName('a0908338229@gmail.com')).toBe(false);
    expect(isCampusPersonName('B122030033')).toBe(false);
  });
});
