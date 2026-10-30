import { describe, expect, test } from 'vitest';
import { routerHistoryIndex, surveyBackTarget } from './surveyExit';

describe('surveyBackTarget', () => {
  test('returns -1 when this visit still has an in-app previous page', () => {
    expect(routerHistoryIndex({ idx: 2 })).toBe(2);
    expect(surveyBackTarget({ idx: 2 }, '/survey/choice')).toBe(-1);
  });

  test('uses the fallback when the survey was opened directly', () => {
    expect(routerHistoryIndex(null)).toBe(0);
    expect(routerHistoryIndex({})).toBe(0);
    expect(surveyBackTarget({ idx: 0 }, '/survey/choice')).toBe('/survey/choice');
    expect(surveyBackTarget({ idx: 0 }, '/student/account')).toBe('/student/account');
  });
});
