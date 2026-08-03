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

  it('ENGLISH_COURSE 建議 60 點', () => {
    expect(calculateSuggestedPoints(RULE_CODES.ENGLISH_COURSE, {})).toBe(60);
  });

  it('ENGLISH_COMPETITION 參賽 20 點、得獎 50 點', () => {
    expect(calculateSuggestedPoints(RULE_CODES.ENGLISH_COMPETITION, { wonAward: false })).toBe(20);
    expect(calculateSuggestedPoints(RULE_CODES.ENGLISH_COMPETITION, { wonAward: true })).toBe(50);
    expect(metadataWonAward({ isWinner: '是' })).toBe(true);
  });

  it('EXTERNAL_EXAM 有效成績 20 點、達加碼門檻 40 點', () => {
    expect(calculateExternalExamPoints({ examType: 'TOEIC_LR', score: 500 })).toBe(20);
    expect(calculateExternalExamPoints({ examType: 'TOEIC_LR', score: 550 })).toBe(40);
    expect(calculateSuggestedPoints(RULE_CODES.EXTERNAL_EXAM, { examType: 'TOEIC_LR', score: 550 })).toBe(40);
  });

  it('EXTERNAL_EXAM 多益 600 達直接通過標準', () => {
    expect(meetsDirectEnglishStandard({ examType: 'TOEIC_LR', score: 600 })).toBe(true);
    expect(meetsDirectEnglishStandard({ examType: 'TOEIC_LR', score: 500 })).toBe(false);
  });

  it('COLLEGE_ENGLISH_CORNER 建議 5 點', () => {
    expect(calculateSuggestedPoints(RULE_CODES.COLLEGE_ENGLISH_CORNER, {})).toBe(5);
  });
});
