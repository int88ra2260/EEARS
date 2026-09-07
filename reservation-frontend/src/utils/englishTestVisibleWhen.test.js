import {
  evaluateVisibleWhen,
  isFieldVisibleWithLinkage,
  normalizeVisibleWhen,
} from './englishTestVisibleWhen';

describe('englishTestVisibleWhen', () => {
  test('equals rule', () => {
    const rule = { fieldKey: 'hasDisabilityCard', equals: '是' };
    expect(evaluateVisibleWhen(rule, { hasDisabilityCard: '是' })).toBe(true);
    expect(evaluateVisibleWhen(rule, { hasDisabilityCard: '否' })).toBe(false);
    expect(evaluateVisibleWhen(rule, {})).toBe(false);
  });

  test('in rule', () => {
    const rule = normalizeVisibleWhen({ fieldKey: 'x', in: ['A', 'B'] });
    expect(evaluateVisibleWhen(rule, { x: 'B' })).toBe(true);
    expect(evaluateVisibleWhen(rule, { x: 'C' })).toBe(false);
  });

  test('isFieldVisibleWithLinkage falls back when no rule', () => {
    const questions = [{ fieldKey: 'disabilityTypes', visible: true }];
    expect(
      isFieldVisibleWithLinkage(questions, 'disabilityTypes', {}, false)
    ).toBe(false);
    expect(
      isFieldVisibleWithLinkage(questions, 'disabilityTypes', { hasDisabilityCard: '是' }, true)
    ).toBe(true);
  });

  test('schema visibleWhen wins over fallback', () => {
    const questions = [
      {
        fieldKey: 'disabilityTypes',
        visible: true,
        visibleWhen: { fieldKey: 'hasDisabilityCard', equals: '是' },
      },
    ];
    expect(
      isFieldVisibleWithLinkage(questions, 'disabilityTypes', { hasDisabilityCard: '否' }, true)
    ).toBe(false);
    expect(
      isFieldVisibleWithLinkage(questions, 'disabilityTypes', { hasDisabilityCard: '是' }, false)
    ).toBe(true);
  });
});
