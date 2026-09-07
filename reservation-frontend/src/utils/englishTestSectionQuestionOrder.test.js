import {
  buildSectionExtraSlots,
  mergeSlotQuestions,
} from './englishTestSectionQuestionOrder';

describe('englishTestSectionQuestionOrder', () => {
  const contactBuiltins = ['email', 'studentNameZh', 'lastNameEn', 'firstNameEn', 'birthDate'];

  test('inserts custom between system fields by order only (not system-first)', () => {
    const questions = [
      { id: 'q1', fieldKey: 'email', sectionId: 'contact', order: 1, system: true, type: 'email' },
      { id: 'q2', fieldKey: 'studentNameZh', sectionId: 'contact', order: 3, system: true, type: 'text' },
      {
        id: 'xc',
        fieldKey: 'extra_confirm',
        sectionId: 'contact',
        order: 2,
        system: false,
        type: 'checkbox_confirm',
        label: '同意',
      },
    ];

    const slots = buildSectionExtraSlots(questions, 'contact', contactBuiltins);
    expect(slots.before).toEqual([]);
    expect(slots.after.email.map((q) => q.id)).toEqual(['xc']);
    expect(slots.after.studentNameZh).toEqual([]);
  });

  test('places customs before first builtin into before', () => {
    const questions = [
      { id: 'xc', fieldKey: 'extra_top', sectionId: 'contact', order: 0, system: false, type: 'text' },
      { id: 'q1', fieldKey: 'email', sectionId: 'contact', order: 1, system: true, type: 'email' },
    ];
    const slots = buildSectionExtraSlots(questions, 'contact', contactBuiltins);
    expect(slots.before.map((q) => q.id)).toEqual(['xc']);
  });

  test('without builtin anchors, customs go to trailing (legacy end-of-section)', () => {
    const questions = [
      { id: 'xc', fieldKey: 'extra_only', sectionId: 'contact', order: 1, system: false, type: 'text' },
    ];
    const slots = buildSectionExtraSlots(questions, 'contact', contactBuiltins);
    expect(slots.before).toEqual([]);
    expect(slots.trailing.map((q) => q.id)).toEqual(['xc']);
  });

  test('mergeSlotQuestions de-dupes across compound address keys', () => {
    const slots = {
      after: {
        postalCode: [{ id: 'a', fieldKey: 'x' }],
        city: [{ id: 'a', fieldKey: 'x' }, { id: 'b', fieldKey: 'y' }],
        address: [{ id: 'c', fieldKey: 'z' }],
      },
    };
    expect(mergeSlotQuestions(slots, ['postalCode', 'city', 'address']).map((q) => q.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
