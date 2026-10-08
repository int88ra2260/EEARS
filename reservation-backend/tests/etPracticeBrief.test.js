'use strict';

const {
  leaderDiscussionCue,
  firstHeardSentence,
  isEnglishTablePractice,
} = require('../services/etGrouping/etPracticeBrief');

describe('etPracticeBrief', () => {
  it('asks the leader to request a reason', () => {
    expect(leaderDiscussionCue('I like the library.')).toBe('他還沒說原因，可以請他用 because 補一句。');
  });

  it('uses a reason as the opening move', () => {
    expect(leaderDiscussionCue('I like it because it is quiet.')).toBe('他有說理由，可以請別人同意或反對。');
  });

  it('keeps only the first sentence', () => {
    expect(firstHeardSentence('I like the library. It is quiet.')).toBe('I like the library.');
  });

  it('matches English Table practice on the same date only', () => {
    const features = {
      context: {
        activityDate: '2026-10-08',
        linkedActivity: 'English Table',
        source: 'english-table',
      },
    };
    expect(isEnglishTablePractice(features, '2026-10-08')).toBe(true);
    expect(isEnglishTablePractice(features, '2026-10-09')).toBe(false);
    expect(isEnglishTablePractice({
      context: { activityDate: '2026-10-08', source: 'english-table' },
    }, '2026-10-08')).toBe(false);
  });
});
