import {
  getQuestionsForLevel,
  shuffleQuestionOptions,
  validateQuestionBank,
  countQuestionsByLevel,
} from './questionBank';
import { VOCABULARY_DEPTH_QUESTIONS_GENERATED } from './questionBankGenerated';
import { VOCABULARY_DEPTH_QUESTIONS_EXTENDED } from './questionBankExtended';
import { validateA2ContextQuestion } from './a2ContextRules';
import { validateB1SynonymQuestion } from './b1SynonymRules';

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

  test('generated A2 questions do not leak answers in prompts', () => {
    const a2Generated = VOCABULARY_DEPTH_QUESTIONS_GENERATED.filter(
      (q) => q.level === 'A2' && q.type === 'context',
    );
    expect(a2Generated.length).toBeGreaterThan(0);
    for (const question of a2Generated) {
      validateA2ContextQuestion(question);
    }
  });

  test('available A2 question does not leak Chinese gloss in prompt', () => {
    const available = VOCABULARY_DEPTH_QUESTIONS_EXTENDED.find((q) => q.word === 'available');
    validateA2ContextQuestion(available);
    expect(available.promptZh).not.toMatch(/有空/);
  });

  test('generated B1 brand question does not leak answer in prompt or options', () => {
    const brand = VOCABULARY_DEPTH_QUESTIONS_GENERATED.find((q) => q.word === 'brand');
    validateB1SynonymQuestion(brand);
    expect(brand.promptZh).not.toMatch(/品牌/);
    expect(brand.options.find((o) => o.id === brand.correctOptionId).textZh).not.toMatch(/品牌/);
    expect(brand.options.every((o) => !o.textZh?.includes('相關'))).toBe(true);
  });
});
