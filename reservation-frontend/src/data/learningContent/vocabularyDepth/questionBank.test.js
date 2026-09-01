import {
  getQuestionsForLevel,
  shuffleQuestionOptions,
  validateQuestionBank,
  countQuestionsByLevel,
} from './questionBank';
import { VOCABULARY_DEPTH_QUESTIONS_GENERATED } from './questionBankGenerated';

describe('vocabularyDepth questionBank', () => {
  beforeAll(() => {
    validateQuestionBank();
  });

  test('each level has at least 30 questions', () => {
    expect(countQuestionsByLevel('A1')).toBeGreaterThanOrEqual(30);
    expect(countQuestionsByLevel('C1')).toBeGreaterThanOrEqual(30);
  });

  test('getQuestionsForLevel returns shuffled options (correct answer not always first)', () => {
    let sawNonFirstCorrect = false;
    for (let i = 0; i < 40; i += 1) {
      const [question] = getQuestionsForLevel('A1', 1);
      const correctIndex = question.options.findIndex(
        (opt) => opt.id === question.correctOptionId,
      );
      if (correctIndex > 0) {
        sawNonFirstCorrect = true;
        break;
      }
    }
    expect(sawNonFirstCorrect).toBe(true);
  });

  test('shuffleQuestionOptions preserves correctOptionId', () => {
    const base = getQuestionsForLevel('B1', 1)[0];
    const reshuffled = shuffleQuestionOptions({
      ...base,
      options: [...base.options].reverse(),
    });
    expect(reshuffled.correctOptionId).toBe(base.correctOptionId);
    expect(reshuffled.options.map((o) => o.id).sort()).toEqual(
      base.options.map((o) => o.id).sort(),
    );
  });

  test('getQuestionsForLevel can sample different questions across rounds', () => {
    const seen = new Set();
    for (let i = 0; i < 30; i += 1) {
      getQuestionsForLevel('A2', 6).forEach((q) => seen.add(q.id));
    }
    expect(seen.size).toBeGreaterThan(6);
  });

  test('generated A2/B1 context questions include complete bilingual prompts', () => {
    const contextual = VOCABULARY_DEPTH_QUESTIONS_GENERATED.filter(
      (q) => q.level === 'A2' || q.level === 'B1',
    );
    expect(contextual.length).toBeGreaterThan(0);
    for (const q of contextual) {
      expect(q.prompt).toContain('______');
      expect(q.promptZh).toContain('______');
      expect(q.promptZh).toContain('提示：');
      expect(q.promptZh).not.toMatch(/情境填空$/);
    }
  });
});
