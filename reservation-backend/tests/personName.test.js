'use strict';

const {
  compactPersonName,
  normalizePersonName,
  personNamesMatch,
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
});
