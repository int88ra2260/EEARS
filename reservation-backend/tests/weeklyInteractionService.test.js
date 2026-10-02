const mockWeeklyReportFindByPk = jest.fn();
const mockWeeklyInteractionEventFindAll = jest.fn();

jest.mock('../models', () => ({
  WeeklyReport: {
    findByPk: (...args) => mockWeeklyReportFindByPk(...args),
  },
  WeeklyInteractionEvent: {
    findAll: (...args) => mockWeeklyInteractionEventFindAll(...args),
  },
}));

const {
  gradeQuiz,
  getAnalytics,
  normalizeVoterKey,
} = require('../services/weeklyInteractionService');
const { sanitizeBlockProps } = require('../services/weeklyBlockService');

describe('weeklyInteractionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeVoterKey', () => {
    it('accepts valid anonymous keys', () => {
      expect(normalizeVoterKey('abc12345')).toBe('abc12345');
    });
    it('rejects short keys', () => {
      expect(normalizeVoterKey('abc')).toBeNull();
    });
  });

  describe('gradeQuiz', () => {
    const block = {
      props: sanitizeBlockProps('quiz', {
        title: 'Test',
        questions: [
          { id: 'q1', type: 'choice', prompt: 'A or B?', options: ['A', 'B'], correctAnswer: 'A' },
          { id: 'q2', type: 'fill', prompt: 'Cat', correctAnswer: 'cat' },
        ],
      }),
    };

    it('grades choice and fill answers', () => {
      const result = gradeQuiz(block, [
        { questionId: 'q1', value: 'A' },
        { questionId: 'q2', value: 'Cat' },
      ]);
      expect(result.correct).toBe(2);
      expect(result.total).toBe(2);
    });
  });

  describe('getAnalytics', () => {
    it('returns null for missing report', async () => {
      mockWeeklyReportFindByPk.mockResolvedValueOnce(null);
      const data = await getAnalytics(999999);
      expect(data).toBeNull();
      expect(mockWeeklyInteractionEventFindAll).not.toHaveBeenCalled();
    });
  });
});
