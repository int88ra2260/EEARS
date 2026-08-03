const assert = require('node:assert/strict');
const {
  getFieldValue,
  normalizeCefrLevel,
  parseNullableScore
} = require('../services/bestepImportService');

test('BESTEP score import recognizes official score sheet headers', () => {
  const row = {
    考生姓名: '王小明',
    學號: 'B123456789',
    聽力總分: 128,
    聽力CEFR級數: 'B2+',
    閱讀總分: 112,
    閱讀CEFR級數: 'B2',
    口說總分: 0,
    口說CEFR級數: null,
    寫作總分: 320,
    寫作CEFR級數: 'C1'
  };

  assert.equal(getFieldValue(row, 'scores', 'name'), '王小明');
  assert.equal(getFieldValue(row, 'scores', 'listeningScore'), 128);
  assert.equal(getFieldValue(row, 'scores', 'readingScore'), 112);
  assert.equal(getFieldValue(row, 'scores', 'speakingScore'), 0);
  assert.equal(getFieldValue(row, 'scores', 'writingScore'), 320);
  assert.equal(getFieldValue(row, 'scores', 'listeningLevel'), 'B2+');
  assert.equal(getFieldValue(row, 'scores', 'writingLevel'), 'C1');
});

test('BESTEP score import keeps zero scores and normalizes CEFR plus levels', () => {
  assert.equal(parseNullableScore(0), 0);
  assert.equal(parseNullableScore('0'), 0);
  assert.equal(parseNullableScore('360'), 360);
  assert.equal(parseNullableScore(''), null);
  assert.equal(normalizeCefrLevel('B2+'), 'B2');
  assert.equal(normalizeCefrLevel('A2+'), 'A2');
  assert.equal(normalizeCefrLevel('未達A1'), 'A1');
  assert.equal(normalizeCefrLevel(null), null);
});
