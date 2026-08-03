const {
  normalizeThemeIds,
  validateBlocks,
  sanitizeRichHtml,
  extractModalTeaser,
  defaultBlocksTemplate,
  stripBlocksForPublic,
  sanitizeBlockProps,
} = require('../services/weeklyBlockService');

describe('weeklyBlockService', () => {
  describe('normalizeThemeIds', () => {
    it('parses array input', () => {
      expect(normalizeThemeIds(['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('validateBlocks', () => {
    const baseBlocks = defaultBlocksTemplate({ title: 'T', headline: 'H' });

    it('accepts default template', () => {
      expect(validateBlocks(baseBlocks)).toEqual([]);
    });

    it('requires four theme ids on challenge block', () => {
      const blocks = baseBlocks.map((b) => (
        b.type === 'wordBridgeChallenge'
          ? { ...b, props: { level: 'A2', themeIds: ['a'] } }
          : b
      ));
      expect(validateBlocks(blocks).some((e) => /4/.test(e))).toBe(true);
    });

    it('validates announcement card requires selection', () => {
      const blocks = [...baseBlocks, { id: 'ann-1', type: 'announcementCard', props: {} }];
      expect(validateBlocks(blocks).some((e) => /公告/.test(e))).toBe(true);
    });

    it('validates embed requires https url', () => {
      const blocks = [...baseBlocks, { id: 'emb-1', type: 'embed', props: { url: '' } }];
      expect(validateBlocks(blocks).some((e) => /嵌入/.test(e))).toBe(true);
    });

    it('accepts columns block with slots', () => {
      const blocks = [...baseBlocks, {
        id: 'col-1',
        type: 'columns',
        props: {
          ratio: '50-50',
          left: { kind: 'richText', html: '<p>a</p>' },
          right: { kind: 'image', url: '/uploads/weekly/x.jpg' },
        },
      }];
      expect(validateBlocks(blocks)).toEqual([]);
    });

    it('validates poll requires question and options', () => {
      const blocks = [...baseBlocks, { id: 'poll-1', type: 'poll', props: { question: '', options: [] } }];
      expect(validateBlocks(blocks).length).toBeGreaterThan(0);
    });
  });

  describe('stripBlocksForPublic', () => {
    it('removes quiz answers from public payload', () => {
      const blocks = [{
        id: 'quiz-1',
        type: 'quiz',
        props: sanitizeBlockProps('quiz', {
          title: 'T',
          questions: [{ id: 'q1', type: 'choice', prompt: 'P', options: ['A'], correctAnswer: 'A', explanation: 'E' }],
        }),
      }];
      const stripped = stripBlocksForPublic(blocks);
      expect(stripped[0].props.questions[0].correctAnswer).toBeUndefined();
      expect(stripped[0].props.questions[0].explanation).toBeUndefined();
    });
  });

  describe('sanitizeRichHtml', () => {
    it('strips script tags', () => {
      const out = sanitizeRichHtml('<p>ok</p><script>alert(1)</script>');
      expect(out).not.toContain('script');
      expect(out).toContain('ok');
    });
  });

  describe('extractModalTeaser', () => {
    it('reads hero subtitle and tip callout', () => {
      const blocks = defaultBlocksTemplate({ title: 'T', headline: '副標' });
      const teaser = extractModalTeaser(blocks);
      expect(teaser.headline).toBe('副標');
    });
  });
});
