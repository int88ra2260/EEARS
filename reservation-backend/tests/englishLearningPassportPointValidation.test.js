'use strict';

const {
  calculateSuggestedPoints,
  calculateExternalExamPoints,
  meetsDirectEnglishStandard,
  metadataWonAward,
} = require('../services/englishLearningPassport/pointValidationService');
const { RULE_CODES } = require('../services/englishLearningPassport/constants');

describe('englishLearningPassport pointValidationService', () => {
  it('TUTOR_CONSULTATION 建議 2 點', () => {
    expect(calculateSuggestedPoints(RULE_CODES.TUTOR_CONSULTATION, {})).toBe(2);
  });

  it('ENGLISH_COURSE 建議 60 點，並可改讀規則預設點數', () => {
    expect(calculateSuggestedPoints(RULE_CODES.ENGLISH_COURSE, {})).toBe(60);
    expect(calculateSuggestedPoints(RULE_CODES.ENGLISH_COURSE, {}, { basePoints: 40 })).toBe(40);
  });

  it('ENGLISH_COMPETITION 參賽 20 點、得獎 50 點，並可改讀規則', () => {
    expect(calculateSuggestedPoints(RULE_CODES.ENGLISH_COMPETITION, { wonAward: false })).toBe(20);
    expect(calculateSuggestedPoints(RULE_CODES.ENGLISH_COMPETITION, { wonAward: true })).toBe(50);
    const rule = { basePoints: 10, bonusPoints: 30 };
    expect(calculateSuggestedPoints(RULE_CODES.ENGLISH_COMPETITION, { wonAward: false }, rule)).toBe(10);
    expect(calculateSuggestedPoints(RULE_CODES.ENGLISH_COMPETITION, { wonAward: true }, rule)).toBe(30);
    expect(metadataWonAward({ isWinner: '是' })).toBe(true);
  });

  it('EXTERNAL_EXAM 有效成績 20 點、達加碼門檻 40 點，並可改讀規則', () => {
    expect(calculateExternalExamPoints({ examType: 'TOEIC_LR', score: 500 })).toBe(20);
    expect(calculateExternalExamPoints({ examType: 'TOEIC_LR', score: 550 })).toBe(40);
    expect(calculateSuggestedPoints(RULE_CODES.EXTERNAL_EXAM, { examType: 'TOEIC_LR', score: 550 })).toBe(40);
    const rule = { basePoints: 15, bonusPoints: 25 };
    expect(calculateExternalExamPoints({ examType: 'TOEIC_LR', score: 500 }, rule)).toBe(15);
    expect(calculateSuggestedPoints(RULE_CODES.EXTERNAL_EXAM, { examType: 'TOEIC_LR', score: 550 }, rule)).toBe(25);
  });

  it('EXTERNAL_EXAM 多益 600 達直接通過標準', () => {
    expect(meetsDirectEnglishStandard({ examType: 'TOEIC_LR', score: 600 })).toBe(true);
    expect(meetsDirectEnglishStandard({ examType: 'TOEIC_LR', score: 500 })).toBe(false);
  });

  it('COLLEGE_ENGLISH_CORNER 建議 5 點', () => {
    expect(calculateSuggestedPoints(RULE_CODES.COLLEGE_ENGLISH_CORNER, {})).toBe(5);
  });

  it('SELF_STUDY_SOFTWARE 依完成回數乘上每回點數', () => {
    expect(calculateSuggestedPoints(RULE_CODES.SELF_STUDY_SOFTWARE, {})).toBe(2);
    expect(calculateSuggestedPoints(RULE_CODES.SELF_STUDY_SOFTWARE, { sessionCount: 10 }, { basePoints: 2 })).toBe(20);
    expect(calculateSuggestedPoints(RULE_CODES.SELF_STUDY_SOFTWARE, { sessionCount: '10' })).toBe(20);
  });
});
