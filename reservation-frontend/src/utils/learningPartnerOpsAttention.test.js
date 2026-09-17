import {
  getLearningPartnerOpsAttentionUserKey,
  hasSeenLearningPartnerOpsAttention,
  isLearningPartnerOpsAttentionAudience,
  markLearningPartnerOpsAttentionSeen,
  shouldShowLearningPartnerOpsAttention,
} from './learningPartnerOpsAttention';

describe('learningPartnerOpsAttention', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('only executive is attention audience', () => {
    expect(isLearningPartnerOpsAttentionAudience({ isExecutive: true })).toBe(true);
    expect(isLearningPartnerOpsAttentionAudience({ isExecutive: false, isAdmin: true })).toBe(false);
    expect(isLearningPartnerOpsAttentionAudience(null)).toBe(false);
  });

  test('marks seen once per user key', () => {
    const profile = { isExecutive: true, username: 'exec1' };
    const key = getLearningPartnerOpsAttentionUserKey(profile);
    expect(shouldShowLearningPartnerOpsAttention(profile)).toBe(true);
    expect(hasSeenLearningPartnerOpsAttention(key)).toBe(false);

    markLearningPartnerOpsAttentionSeen(key);
    expect(hasSeenLearningPartnerOpsAttention(key)).toBe(true);
    expect(shouldShowLearningPartnerOpsAttention(profile)).toBe(false);
  });
});
