'use strict';

const {
  leaderDiscussionCue,
  firstHeardSentence,
  isEnglishTablePractice,
  phraseIdForTranscript,
} = require('../services/etGrouping/etPracticeBrief');
const {
  hasSubstantiveMove,
  summarizeStudentPractice,
  summarizeEventPracticeCoverage,
  describePracticeGain,
  formatPracticeMove,
} = require('../services/etGrouping/etPracticeProgress');

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

  it('points a claim at the because card and a reason at the response card', () => {
    expect(phraseIdForTranscript('I like the library.')).toBe('pb_et_009');
    expect(phraseIdForTranscript('I like it because it is quiet.')).toBe('pb_et_005');
  });
});

describe('etPracticeProgress', () => {
  const pre = {
    submittedAt: '2026-10-07T01:00:00.000Z',
    transcript: 'I like the library.',
    features: {
      context: {
        activityDate: '2026-10-08',
        linkedActivity: 'English Table',
        activityPhase: 'pre_activity',
        activityQuestionNumber: '1',
      },
    },
  };
  const post = {
    ...pre,
    submittedAt: '2026-10-08T05:00:00.000Z',
    transcript: 'I like the library because it is quiet.',
    features: {
      context: { ...pre.features.context, activityPhase: 'post_activity' },
    },
  };

  it('treats a reason or an example as a substantive move', () => {
    expect(hasSubstantiveMove('I like the library.')).toBe(false);
    expect(hasSubstantiveMove('I like it because it is quiet.')).toBe(true);
    expect(hasSubstantiveMove('For example, I go there on Monday.')).toBe(true);
  });

  it('counts a gain only when the same question adds a reason or example', () => {
    expect(summarizeStudentPractice([pre], '2026-10-08')).toEqual({
      hasPre: true,
      hasPair: false,
      gainedMove: null,
    });
    expect(summarizeStudentPractice([pre, post], '2026-10-08').gainedMove).toBe(true);
    expect(describePracticeGain(pre.transcript, post.transcript).gained).toBe(true);
    expect(describePracticeGain(post.transcript, post.transcript).gained).toBe(false);
    expect(formatPracticeMove(summarizeStudentPractice([pre, post], '2026-10-08'))).toBe('活動後多了理由或例子');
  });

  it('hides the gained count when fewer than 10 students have both recordings', () => {
    const nine = Array.from({ length: 9 }, () => ({ hasPre: true, hasPair: true, gainedMove: true }));
    const ten = nine.concat([{ hasPre: true, hasPair: true, gainedMove: false }]);
    expect(summarizeEventPracticeCoverage(nine).privacySuppressed).toBe(true);
    expect(summarizeEventPracticeCoverage(nine).gainedStudentCount).toBeNull();
    expect(summarizeEventPracticeCoverage(ten)).toMatchObject({
      preStudentCount: 10,
      pairStudentCount: 10,
      gainedStudentCount: 9,
      privacySuppressed: false,
    });
  });
});
