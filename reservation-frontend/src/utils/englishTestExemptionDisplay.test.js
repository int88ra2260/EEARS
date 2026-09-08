import {
  hasB2ScoresFilled,
  mapExemptionReviewStatusToLabel,
  mapExemptionVerifiedTypeToZh,
} from './englishTestExemptionDisplay';

describe('englishTestExemptionDisplay', () => {
  test('hasB2ScoresFilled requires hasCEFRB2=是 and at least one score', () => {
    expect(hasB2ScoresFilled({ hasCEFRB2: '是', listeningScore: '6.0' })).toBe(true);
    expect(hasB2ScoresFilled({ hasCEFRB2: '否', listeningScore: '6.0' })).toBe(false);
    expect(hasB2ScoresFilled({ hasCEFRB2: '是', listeningScore: '' })).toBe(false);
  });

  test('status and verified type labels', () => {
    expect(mapExemptionReviewStatusToLabel(null)).toBe('未審核');
    expect(mapExemptionReviewStatusToLabel('pending')).toBe('審核中');
    expect(mapExemptionReviewStatusToLabel('revision')).toBe('退回修正');
    expect(mapExemptionVerifiedTypeToZh('LR')).toBe('聽讀');
    expect(mapExemptionVerifiedTypeToZh('NONE')).toBe('無');
  });
});
