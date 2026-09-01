'use strict';

const {
  validateAndNormalizeSchema,
  buildDefaultEnglishTestFormSchema,
  mergeMissingSystemParts,
  mergeMissingAnnouncementParts,
  schemaNeedsAnnouncementMerge,
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

  test('default schema includes step 0 announcement and step 1/2', () => {
    const schema = buildDefaultEnglishTestFormSchema();
    const sectionIds = schema.sections.map((s) => s.id);
    expect(sectionIds).toEqual(
      expect.arrayContaining(['announcement', 'privacy', 'verify', 'eligibility', 'contact', 'photo'])
    );
    expect(schema.questions.some((q) => q.fieldKey === 'announcementDoc' && q.type === 'content_block')).toBe(true);
    expect(schema.questions.some((q) => q.fieldKey === 'agreedToAnnouncement' && q.type === 'checkbox_confirm')).toBe(true);
    expect(schema.questions.some((q) => q.fieldKey === 'privacyDoc' && q.type === 'content_block')).toBe(true);
    expect(schema.questions.some((q) => q.fieldKey === 'idPhotoGuide' && q.type === 'content_block')).toBe(true);
  });

  test('mergeMissingAnnouncementParts backfills legacy schema without announcement', () => {
    const base = buildDefaultEnglishTestFormSchema();
    const legacy = {
      ...base,
      sections: base.sections.filter((s) => s.id !== 'announcement'),
      questions: base.questions.filter((q) => q.sectionId !== 'announcement'),
    };
    expect(schemaNeedsAnnouncementMerge(legacy)).toBe(true);
    const merged = mergeMissingAnnouncementParts(legacy);
    expect(merged.sections.some((s) => s.id === 'announcement')).toBe(true);
    expect(merged.questions.some((q) => q.fieldKey === 'announcementDoc')).toBe(true);
    expect(merged.questions.some((q) => q.fieldKey === 'agreedToAnnouncement')).toBe(true);
    expect(schemaNeedsAnnouncementMerge(merged)).toBe(false);
  });

  test('mergeMissingSystemParts backfills announcement but keeps other deleted sections removed', () => {
    const legacy = {
      title: '舊版',
      version: 1,
      sections: [{ id: 'eligibility', title: '培力', order: 3, navLabel: '步驟 3' }],
      questions: [],
      departmentOptions: {},
    };
    const merged = mergeMissingSystemParts(legacy);
    expect(merged.sections.map((s) => s.id)).toEqual(
      expect.arrayContaining(['announcement', 'eligibility'])
    );
    expect(merged.sections.some((s) => s.id === 'privacy')).toBe(false);
  });

  test('mergeMissingSystemParts fills default sections only when empty', () => {
    const empty = { title: 'x', sections: [], questions: [], departmentOptions: {} };
    const merged = mergeMissingSystemParts(empty);
    expect(merged.sections.map((s) => s.id)).toEqual(
      expect.arrayContaining(['privacy', 'verify', 'eligibility'])
    );
  });

  test('allows deleting preset questions except bootstrap announcement', () => {
    const base = buildDefaultEnglishTestFormSchema();
    const withoutPreset = {
      ...base,
      questions: base.questions.filter((q) => !q.system),
    };
    const normalized = validateAndNormalizeSchema(withoutPreset, base);
    expect(
      normalized.questions.filter((q) => q.system && q.sectionId !== 'announcement').length
    ).toBe(0);
    expect(normalized.questions.some((q) => q.fieldKey === 'announcementDoc')).toBe(true);
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
