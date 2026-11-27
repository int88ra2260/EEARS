const assert = require('node:assert/strict');
const {
  getFieldValue,
  normalizeCefrLevel,
  parseNullableScore,
  calculateOverallLevel,
  isPassed,
  officialPartColumnsPresent,
  readOfficialPartColumns,
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

test('BESTEP score import keeps plus levels and part scores', () => {
  assert.equal(parseNullableScore(0), 0);
  assert.equal(parseNullableScore('0'), 0);
  assert.equal(parseNullableScore('360'), 360);
  assert.equal(parseNullableScore(''), null);
  assert.equal(normalizeCefrLevel('B1+'), 'B1+');
  assert.equal(normalizeCefrLevel('B2+'), 'B2+');
  assert.equal(normalizeCefrLevel('A2+'), 'A2+');
  assert.equal(normalizeCefrLevel('C1+'), 'C1+');
  assert.equal(normalizeCefrLevel('C1'), 'C1');
  assert.equal(normalizeCefrLevel(' c2 '), 'C2');
  assert.notEqual(normalizeCefrLevel('B2+'), 'C1');
  assert.equal(normalizeCefrLevel('未達A1'), 'A1');
  assert.equal(normalizeCefrLevel(null), null);
  assert.equal(calculateOverallLevel(['B2', 'B1+', 'C1', 'A2+']), 'A2+');
  assert.equal(isPassed(['B2+', 'B2', 'C1', 'B2']), true);
  assert.equal(isPassed(['B1+', 'B2', 'B2', 'B2']), false);
  assert.equal(isPassed(['B2', 'B2', 'B2']), false);

  const row = {
    學號: 'B123456789',
    聽力總分: 84,
    聽力達成率: 60,
    聽力第一部分分數: 32,
    聽力第一部分達成率: 80,
    聽力第二部分分數: 24,
    聽力第二部分達成率: 60,
    聽力第三部分分數: 28,
    聽力第三部分達成率: 47,
    閱讀總分: 80,
    閱讀第一部分分數: 16,
    閱讀第一部分達成率: 80,
    閱讀第二部分分數: 44,
    閱讀第二部分達成率: 73,
    閱讀第三部分分數: 20,
    閱讀第三部分達成率: 33,
    口說總分: 200,
    口說第一部分分數: 40,
    口說第一部分達成率: 50,
    口說第二部分分數: 70,
    口說第二部分達成率: 54,
    口說第三部分分數: 90,
    口說第三部分達成率: 60,
    寫作總分: 285,
    寫作第一部分分數: 80,
    寫作第一部分達成率: 100,
    寫作第二部分分數: 90,
    寫作第二部分達成率: 69,
    寫作第三部分分數: 115,
    寫作第三部分達成率: 77,
  };
  assert.equal(officialPartColumnsPresent([row]), true);
  const parsed = readOfficialPartColumns(row, {
    listening: 84,
    reading: 80,
    speaking: 200,
    writing: 285,
  });
  assert.equal(parsed.error, null);
  assert.equal(parsed.columns.listeningPart1Score, 32);
  assert.equal(parsed.columns.listeningPart3Rate, 47);
  assert.equal(parsed.columns.speakingPart3Score, 90);
  assert.equal(parsed.columns.writingAchievementRate, null);
  assert.equal(officialPartColumnsPresent([{ 聽力總分: 10 }]), false);
});

test('BESTEP part scores that do not add up to the skill total are rejected', () => {
  const row = {
    聽力第一部分分數: 10,
    聽力第二部分分數: 10,
    聽力第三部分分數: 10,
    閱讀第一部分分數: 0,
    閱讀第二部分分數: 0,
    閱讀第三部分分數: 0,
    口說第一部分分數: 0,
    口說第二部分分數: 0,
    口說第三部分分數: 0,
    寫作第一部分分數: 80,
    寫作第二部分分數: 110,
    寫作第三部分分數: 115,
  };
  const parsed = readOfficialPartColumns(row, {
    listening: 30,
    reading: 0,
    speaking: 0,
    writing: 285,
  });
  assert.match(parsed.error, /寫作三部分分數總和與總分不符/);
});
