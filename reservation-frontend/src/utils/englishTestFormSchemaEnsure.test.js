import { ensureEnglishTestFormSystemParts } from './englishTestFormSchemaEnsure';

describe('englishTestFormSchemaEnsure', () => {
  it('backfills announcement section and questions for legacy schema', () => {
    const legacy = {
      title: '培力英檢報名表單',
      sections: [
        { id: 'privacy', title: '個資使用同意書', order: 1, navLabel: '步驟 1' },
        { id: 'verify', title: '身分驗證', order: 2, navLabel: '步驟 2' },
      ],
      questions: [],
    };
    const { schema, changed } = ensureEnglishTestFormSystemParts(legacy);
    expect(changed).toBe(true);
    expect(schema.sections.some((s) => s.id === 'announcement')).toBe(true);
    expect(schema.questions.some((q) => q.fieldKey === 'announcementDoc')).toBe(true);
    expect(schema.questions.some((q) => q.fieldKey === 'agreedToAnnouncement')).toBe(true);
  });
});
