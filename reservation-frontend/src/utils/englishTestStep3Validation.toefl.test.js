import {
  validateScoreFormat,
  checkB2Level,
} from './englishTestStep3Validation';
import {
  SCORE_EXAM_TYPE_OPTIONS,
  getScoreExamTypeOptionsForSkill,
} from './englishTestFormOptions';

describe('TOEFL exam type score rules', () => {
  test('legacy TOEFL (舊制) keeps 0–30 integer rules', () => {
    expect(validateScoreFormat('TOEFL', '17', 'listening').isValid).toBe(true);
    expect(validateScoreFormat('TOEFL', '17.5', 'listening').isValid).toBe(false);
    expect(checkB2Level('TOEFL', '17', 'listening')).toBe(true);
    expect(checkB2Level('TOEFL', '16', 'listening')).toBe(false);
  });

  test('new TOEFL iBT 2026 uses 1–6 scale and B2 at 4+', () => {
    expect(validateScoreFormat('TOEFL iBT 2026', '4', 'speaking').isValid).toBe(true);
    expect(validateScoreFormat('TOEFL iBT 2026', '4.5', 'writing').isValid).toBe(true);
    expect(validateScoreFormat('TOEFL iBT 2026', '0.5', 'listening').isValid).toBe(false);
    expect(validateScoreFormat('TOEFL iBT 2026', '7', 'reading').isValid).toBe(false);
    expect(checkB2Level('TOEFL iBT 2026', '4', 'listening')).toBe(true);
    expect(checkB2Level('TOEFL iBT 2026', '3.9', 'listening')).toBe(false);
  });

  test('TOEFL ITP is listening/reading only with 31–68 and skill thresholds', () => {
    expect(validateScoreFormat('TOEFL ITP', '54', 'listening').isValid).toBe(true);
    expect(validateScoreFormat('TOEFL ITP', '30', 'reading').isValid).toBe(false);
    expect(validateScoreFormat('TOEFL ITP', '54', 'speaking').isValid).toBe(false);
    expect(checkB2Level('TOEFL ITP', '54', 'listening')).toBe(true);
    expect(checkB2Level('TOEFL ITP', '53', 'listening')).toBe(false);
    expect(checkB2Level('TOEFL ITP', '56', 'reading')).toBe(true);
    expect(checkB2Level('TOEFL ITP', '55', 'reading')).toBe(false);
    expect(checkB2Level('TOEFL ITP', '60', 'speaking')).toBeNull();
  });

  test('score dropdown hides TOEFL ITP for speaking/writing and includes 其他', () => {
    expect(SCORE_EXAM_TYPE_OPTIONS.some((o) => o.value === '其他')).toBe(true);
    const lr = getScoreExamTypeOptionsForSkill('listening');
    const sw = getScoreExamTypeOptionsForSkill('speaking');
    expect(lr.some((o) => o.value === 'TOEFL ITP')).toBe(true);
    expect(sw.some((o) => o.value === 'TOEFL ITP')).toBe(false);
    expect(getScoreExamTypeOptionsForSkill('writing').some((o) => o.value === '其他')).toBe(true);
  });

  test('其他 accepts free-form score without B2 auto-check', () => {
    expect(validateScoreFormat('其他', '任意成績說明', 'listening').isValid).toBe(true);
    expect(checkB2Level('其他', '任意成績說明', 'listening')).toBeNull();
  });
});
