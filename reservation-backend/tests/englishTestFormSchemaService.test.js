'use strict';

const {
  validateAndNormalizeSchema,
  buildDefaultEnglishTestFormSchema,
  mergeMissingSystemParts,
} = require('../services/englishTestFormSchemaService');

describe('englishTestFormSchemaService', () => {
  test('default schema has system questions', () => {
    const schema = buildDefaultEnglishTestFormSchema();
    expect(schema.questions.length).toBeGreaterThan(10);
    expect(schema.questions.every((q) => q.id && q.fieldKey && q.label)).toBe(true);
    expect(schema.questions.filter((q) => q.system).length).toBeGreaterThan(5);
  });

  test('default schema includes step 1/2 and photo/address confirm types', () => {
    const schema = buildDefaultEnglishTestFormSchema();
    const sectionIds = schema.sections.map((s) => s.id);
    expect(sectionIds).toEqual(
      expect.arrayContaining(['privacy', 'verify', 'eligibility', 'contact', 'photo'])
    );
    expect(schema.questions.some((q) => q.fieldKey === 'privacyDoc' && q.type === 'content_block')).toBe(true);
    expect(schema.questions.some((q) => q.fieldKey === 'agreedToPrivacyPolicy' && q.type === 'checkbox_confirm')).toBe(true);
    expect(schema.questions.some((q) => q.fieldKey === 'addressConfirmed' && q.type === 'checkbox_confirm')).toBe(true);
    expect(schema.questions.some((q) => q.fieldKey === 'idPhotoGuide' && q.type === 'content_block')).toBe(true);
    const guide = schema.questions.find((q) => q.fieldKey === 'idPhotoGuide');
    expect(guide.content.listItems.length).toBeGreaterThanOrEqual(8);
    expect(guide.content.images.length).toBe(2);
  });

  test('mergeMissingSystemParts backfills privacy/verify without overwriting edits', () => {
    const legacy = {
      title: '舊版',
      version: 1,
      sections: [{ id: 'eligibility', title: '培力', order: 3 }],
      questions: [
        {
          id: 'q_examType',
          fieldKey: 'examType',
          sectionId: 'eligibility',
          order: 1,
          label: '已改過的文案',
          type: 'radio',
          required: true,
          system: true,
          visible: true,
          options: [{ value: 'BESTEP', label: 'BESTEP' }],
          content: {},
        },
      ],
      departmentOptions: {},
    };
    const merged = mergeMissingSystemParts(legacy);
    expect(merged.sections.map((s) => s.id)).toEqual(
      expect.arrayContaining(['privacy', 'verify', 'eligibility'])
    );
    expect(merged.questions.some((q) => q.fieldKey === 'privacyDoc')).toBe(true);
    expect(merged.questions.some((q) => q.fieldKey === 'studentId')).toBe(true);
    expect(merged.questions.find((q) => q.fieldKey === 'examType').label).toBe('已改過的文案');
  });

  test('restores deleted system questions instead of allowing removal', () => {
    const base = buildDefaultEnglishTestFormSchema();
    const withoutSystem = {
      ...base,
      questions: base.questions.filter((q) => !q.system),
    };
    const normalized = validateAndNormalizeSchema(withoutSystem, base);
    const systemCount = base.questions.filter((q) => q.system).length;
    expect(normalized.questions.filter((q) => q.system).length).toBe(systemCount);
    expect(normalized.questions.some((q) => q.fieldKey === 'privacyDoc')).toBe(true);
  });

  test('allows adding custom question', () => {
    const base = buildDefaultEnglishTestFormSchema();
    const next = {
      ...base,
      questions: [
        ...base.questions,
        {
          id: 'q_custom_1',
          fieldKey: 'extra_note',
          sectionId: 'custom',
          order: 1,
          label: '補充說明',
          type: 'textarea',
          required: false,
          system: false,
          helpText: '',
          visible: true,
          options: [],
        },
      ],
    };
    const normalized = validateAndNormalizeSchema(next, base);
    expect(normalized.questions.some((q) => q.fieldKey === 'extra_note')).toBe(true);
  });

  test('rejects custom question using reserved system fieldKey', () => {
    const base = buildDefaultEnglishTestFormSchema();
    const next = {
      ...base,
      questions: [
        ...base.questions,
        {
          id: 'q_custom_bad',
          fieldKey: 'email',
          sectionId: 'custom',
          order: 99,
          label: '假 email',
          type: 'text',
          required: false,
          system: false,
          options: [],
        },
      ],
    };
    expect(() => validateAndNormalizeSchema(next, base)).toThrow(/系統欄位鍵/);
  });

  test('validateAndNormalizeSchema backfills missing privacy/verify on save', () => {
    const base = buildDefaultEnglishTestFormSchema();
    const incomplete = {
      ...base,
      sections: base.sections.filter((s) => s.id !== 'privacy' && s.id !== 'verify'),
      questions: base.questions.filter(
        (q) => q.sectionId !== 'privacy' && q.sectionId !== 'verify'
      ),
    };
    const normalized = validateAndNormalizeSchema(incomplete, incomplete);
    expect(normalized.sections.map((s) => s.id)).toEqual(
      expect.arrayContaining(['privacy', 'verify'])
    );
    expect(normalized.questions.some((q) => q.fieldKey === 'privacyDoc')).toBe(true);
    expect(normalized.questions.some((q) => q.fieldKey === 'studentId')).toBe(true);
  });

  test('schemaNeedsSystemMerge detects missing privacy', () => {
    const { schemaNeedsSystemMerge } = require('../services/englishTestFormSchemaService');
    const base = buildDefaultEnglishTestFormSchema();
    expect(schemaNeedsSystemMerge(base)).toBe(false);
    expect(
      schemaNeedsSystemMerge({
        ...base,
        sections: base.sections.filter((s) => s.id !== 'privacy'),
      })
    ).toBe(true);
  });
});
