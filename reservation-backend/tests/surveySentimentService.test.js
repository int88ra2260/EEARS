const {
  analyzeSentimentText,
  mergeOpenTextRows,
  isOpenTextCandidate,
} = require('../services/surveySentimentService');

describe('surveySentimentService', () => {
  describe('analyzeSentimentText', () => {
    it('labels clearly positive Chinese feedback', () => {
      const r = analyzeSentimentText('這次活動很有幫助，收穫很多，非常滿意！');
      expect(r.label).toBe('positive');
      expect(r.score).toBeGreaterThan(0);
      expect(r.positiveHits.length).toBeGreaterThan(0);
    });

    it('labels clearly negative Chinese feedback', () => {
      const r = analyzeSentimentText('內容太難聽不懂，浪費時間，很不滿意。');
      expect(r.label).toBe('negative');
      expect(r.score).toBeLessThan(0);
      expect(r.negativeHits.length).toBeGreaterThan(0);
    });

    it('handles English positive feedback', () => {
      const r = analyzeSentimentText('The session was very helpful and I really enjoyed it.');
      expect(r.label).toBe('positive');
      expect(r.score).toBeGreaterThan(0);
    });

    it('handles English negative with negation flip', () => {
      const r = analyzeSentimentText('It was not helpful and quite confusing.');
      expect(r.label).toBe('negative');
      expect(r.score).toBeLessThan(0);
    });

    it('returns neutral for empty or short text', () => {
      expect(analyzeSentimentText('').label).toBe('neutral');
      expect(analyzeSentimentText('a').label).toBe('neutral');
    });
  });

  describe('isOpenTextCandidate / mergeOpenTextRows', () => {
    it('prefers ability_description and skips department', () => {
      expect(isOpenTextCandidate('ability_description', '進步很多')).toBe(true);
      expect(isOpenTextCandidate('department', '外國語文學系')).toBe(false);
      expect(isOpenTextCandidate('email', 'a@b.com')).toBe(false);
    });

    it('merges answer rows and answersJson without duplicate keys', () => {
      const rows = mergeOpenTextRows({
        answerRows: [
          { responseId: 1, questionKey: 'other_comments', answerText: '很好', createdAt: '2026-01-01' },
        ],
        responses: [
          {
            id: 1,
            answersJson: {
              other_comments: '很好',
              ability_description: '口說進步很多，收穫良多',
              department: '外文系',
            },
            submittedAt: '2026-01-02',
          },
        ],
      });
      expect(rows.some((r) => r.questionKey === 'ability_description')).toBe(true);
      expect(rows.filter((r) => r.questionKey === 'other_comments')).toHaveLength(1);
      expect(rows.some((r) => r.questionKey === 'department')).toBe(false);
    });
  });
});
