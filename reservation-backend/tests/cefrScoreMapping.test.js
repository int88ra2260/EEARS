'use strict';

const {
  inferCefrFromScore,
  inferCefrFromLevel,
  normalizeExamType,
  getMappingMeta,
  isScoreBasedExam,
  isLevelBasedExam,
  MAPPING_VERSION
} = require('../services/learningJourney/utils/cefrScoreMapping');

describe('cefrScoreMapping score_based', () => {
  test('1. TOEIC listening 400 -> B2', () => {
    const r = inferCefrFromScore({ examType: 'TOEIC', skill: 'listening', rawScore: 400 });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('B2');
    expect(r.mappingType).toBe('score_based');
    expect(r.source).toBe('official_ets');
    expect(r.version).toBe(MAPPING_VERSION);
  });

  test('2. TOEIC reading 385 -> B2', () => {
    const r = inferCefrFromScore({ examType: 'TOEIC', skill: 'reading', rawScore: 385 });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('B2');
  });

  test('3. TOEIC_SW speaking 160 -> B2', () => {
    const r = inferCefrFromScore({ examType: 'TOEIC_SW', skill: 'speaking', rawScore: 160 });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('B2');
  });

  test('4. TOEIC_SW writing 70 -> A2', () => {
    const r = inferCefrFromScore({ examType: 'TOEIC_SW', skill: 'writing', rawScore: 70 });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('A2');
  });

  test('5. TOEFL_ITP listening 55 -> B2', () => {
    const r = inferCefrFromScore({ examType: 'TOEFL_ITP', skill: 'listening', rawScore: 55 });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('B2');
  });

  test('6. TOEFL_ITP reading 41 -> B1', () => {
    const r = inferCefrFromScore({ examType: 'TOEFL_ITP', skill: 'reading', rawScore: 41 });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('B1');
  });

  test('7. TOEFL_ITP writing -> UNSUPPORTED_SKILL_FOR_EXAM', () => {
    const r = inferCefrFromScore({ examType: 'TOEFL_ITP', skill: 'writing', rawScore: 50 });
    expect(r.isMapped).toBe(false);
    expect(r.reason).toBe('UNSUPPORTED_SKILL_FOR_EXAM');
  });

  test('8. TOEFL_IBT_LEGACY reading 18 -> B2', () => {
    const r = inferCefrFromScore({ examType: 'TOEFL_IBT_LEGACY', skill: 'reading', rawScore: 18 });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('B2');
  });

  test('9. TOEFL_IBT_LEGACY listening 17 -> B2', () => {
    const r = inferCefrFromScore({ examType: 'TOEFL_IBT_LEGACY', skill: 'listening', rawScore: 17 });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('B2');
  });

  test('10. TOEFL_IBT_2026 reading 4 -> B2', () => {
    const r = inferCefrFromScore({ examType: 'TOEFL_IBT_2026', skill: 'reading', rawScore: 4 });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('B2');
  });

  test('11. IELTS 5.5 -> B2', () => {
    const r = inferCefrFromScore({ examType: 'IELTS', skill: 'listening', rawScore: 5.5 });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('B2');
    expect(r.source).toBe('official_ielts');
  });

  test('12. BESTEP listening 100 -> B2', () => {
    const r = inferCefrFromScore({ examType: 'BESTEP', skill: 'listening', rawScore: 100 });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('B2');
    expect(r.source).toBe('school_policy_bestep');
  });
});

describe('cefrScoreMapping level_based', () => {
  test('13. GEPT 中高級 -> B2', () => {
    const r = inferCefrFromLevel({ examType: 'GEPT', level: '全民英檢中高級' });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('B2');
    expect(r.mappingType).toBe('level_based');
    expect(r.source).toBe('official_gept');
  });

  test('14. CAMBRIDGE FCE -> B2', () => {
    const r = inferCefrFromLevel({ examType: 'CAMBRIDGE', level: 'FCE' });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('B2');
  });

  test('15. CAMBRIDGE C1 Advanced -> C1', () => {
    const r = inferCefrFromLevel({ examType: 'CAMBRIDGE', level: 'C1 Advanced' });
    expect(r.isMapped).toBe(true);
    expect(r.cefr).toBe('C1');
  });
});

describe('cefrScoreMapping normalize & meta', () => {
  test('16. TOEFL iBT + 2026-01-21 -> TOEFL_IBT_2026', () => {
    expect(normalizeExamType('TOEFL iBT', { examDate: '2026-01-21' }).code).toBe('TOEFL_IBT_2026');
  });

  test('17. TOEFL iBT + 2025-12-31 -> TOEFL_IBT_LEGACY', () => {
    expect(normalizeExamType('TOEFL iBT', { examDate: '2025-12-31' }).code).toBe('TOEFL_IBT_LEGACY');
  });

  test('18. 托福 -> AMBIGUOUS_TOEFL_TYPE', () => {
    expect(normalizeExamType('托福', {}).reason).toBe('AMBIGUOUS_TOEFL_TYPE');
  });

  test('19. 多益口說與寫作測驗 -> TOEIC_SW', () => {
    expect(normalizeExamType('多益口說與寫作測驗', {}).code).toBe('TOEIC_SW');
  });

  test('20. 劍橋英檢(Cambridge) -> CAMBRIDGE', () => {
    expect(normalizeExamType('劍橋英檢(Cambridge)', {}).code).toBe('CAMBRIDGE');
  });

  test('getMappingMeta / isScoreBasedExam / isLevelBasedExam', () => {
    expect(isScoreBasedExam('TOEIC')).toBe(true);
    expect(isLevelBasedExam('GEPT')).toBe(true);
    expect(isLevelBasedExam('CAMBRIDGE')).toBe(true);
    const m = getMappingMeta('IELTS');
    expect(m.mappingType).toBe('score_based');
    expect(m.skills).toBeDefined();
  });

  test('全民英檢中高級 normalize -> GEPT（等級另由 inferCefrFromLevel）', () => {
    expect(normalizeExamType('全民英檢中高級', {}).code).toBe('GEPT');
  });
});
