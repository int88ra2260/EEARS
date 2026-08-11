'use strict';

const {
  validateAndNormalizeSchema,
  buildDefaultEnglishTestFormSchema,
  mergeMissingSystemParts,
  getCustomQuestions,
  schemaNeedsSystemMerge,
} = require('../services/englishTestFormSchemaService');

describe('englishTestFormSchemaService', () => {
  test('default schema has preset questions and navLabel', () => {
    const schema = buildDefaultEnglishTestFormSchema();
    expect(schema.questions.length).toBeGreaterThan(10);
    expect(schema.sections.every((s) => s.navLabel)).toBe(true);
    expect(schema.questions.filter((q) => q.system).length).toBeGreaterThan(5);
  });

  test('default schema includes step 1/2 and photo/address confirm types', () => {
    const schema = buildDefaultEnglishTestFormSchema();
    const sectionIds = schema.sections.map((s) => s.id);
    expect(sectionIds).toEqual(
      expect.arrayContaining(['privacy', 'verify', 'eligibility', 'contact', 'photo'])
    );
    expect(schema.questions.some((q) => q.fieldKey === 'privacyDoc' && q.type === 'content_block')).toBe(true);
    expect(schema.questions.some((q) => q.fieldKey === 'idPhotoGuide' && q.type === 'content_block')).toBe(true);
  });

  test('mergeMissingSystemParts does not re-add deleted sections', () => {
    const legacy = {
      title: '舊版',
      version: 1,
      sections: [{ id: 'eligibility', title: '培力', order: 3, navLabel: '步驟 3' }],
      questions: [],
      departmentOptions: {},
    };
    const merged = mergeMissingSystemParts(legacy);
    expect(merged.sections.map((s) => s.id)).toEqual(['eligibility']);
  });

  test('mergeMissingSystemParts fills default sections only when empty', () => {
    const empty = { title: 'x', sections: [], questions: [], departmentOptions: {} };
    const merged = mergeMissingSystemParts(empty);
    expect(merged.sections.map((s) => s.id)).toEqual(
      expect.arrayContaining(['privacy', 'verify', 'eligibility'])
    );
  });

  test('allows deleting preset questions', () => {
    const base = buildDefaultEnglishTestFormSchema();
    const withoutPreset = {
      ...base,
      questions: base.questions.filter((q) => !q.system),
    };
    const normalized = validateAndNormalizeSchema(withoutPreset, base);
    expect(normalized.questions.filter((q) => q.system).length).toBe(0);
    expect(normalized.warnings?.length).toBeGreaterThan(0);
  });

  test('allows section CRUD fields (navLabel/title/order)', () => {
    const base = buildDefaultEnglishTestFormSchema();
    const next = {
      ...base,
      sections: [
        ...base.sections.filter((s) => s.id !== 'custom'),
        { id: 'block_g', title: 'G. 新區塊', order: 99, navLabel: '步驟 4 · G' },
      ],
    };
    const normalized = validateAndNormalizeSchema(next, base);
    expect(normalized.sections.some((s) => s.id === 'custom')).toBe(false);
    expect(normalized.sections.find((s) => s.id === 'block_g').navLabel).toBe('步驟 4 · G');
  });

  test('validateAndNormalizeSchema keeps intentionally removed sections', () => {
    const base = buildDefaultEnglishTestFormSchema();
    const incomplete = {
      ...base,
      sections: base.sections.filter((s) => s.id !== 'privacy' && s.id !== 'verify'),
      questions: base.questions.filter(
        (q) => q.sectionId !== 'privacy' && q.sectionId !== 'verify'
      ),
    };
    const normalized = validateAndNormalizeSchema(incomplete, incomplete);
    expect(normalized.sections.some((s) => s.id === 'privacy')).toBe(false);
    expect(normalized.sections.some((s) => s.id === 'verify')).toBe(false);
  });

  test('schemaNeedsSystemMerge only when sections empty', () => {
    const base = buildDefaultEnglishTestFormSchema();
    expect(schemaNeedsSystemMerge(base)).toBe(false);
    expect(
      schemaNeedsSystemMerge({
        ...base,
        sections: base.sections.filter((s) => s.id !== 'privacy'),
      })
    ).toBe(false);
    expect(schemaNeedsSystemMerge({ ...base, sections: [] })).toBe(true);
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
          options: [],
        },
      ],
    };
    const normalized = validateAndNormalizeSchema(next, base);
    expect(getCustomQuestions(normalized).some((q) => q.fieldKey === 'extra_note')).toBe(true);
  });
});
