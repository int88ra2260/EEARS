'use strict';

const { buildEnglishTablePracticeNote } = require('../services/etGrouping/englishTablePracticeNote');
const {
  toPublicAttempt,
  keepLatestPair,
  latestByQuestion,
  englishTableDates,
} = require('../services/studentSpeakingPracticeService');

describe('english table practice note', () => {
  test('asks for a reason when the answer stops at a claim', () => {
    const note = buildEnglishTablePracticeNote('I like the campus cafe.');
    expect(note.phraseId).toBe('pb_et_009');
    expect(note.say).toMatch(/because ______/);
    expect(note.kind).toBe('reason');
  });

  test('asks for an example after a reason', () => {
    const note = buildEnglishTablePracticeNote('I like it because the drinks are cheap.');
    expect(note.phraseId).toBe('pb_et_010');
    expect(note.say).toBe('For example, ______.');
  });

  test('gives a stalling line when nothing was heard', () => {
    const note = buildEnglishTablePracticeNote('  ');
    expect(note.phraseId).toBe('pb_et_003');
    expect(note.say).toMatch(/Let me/);
  });
});

describe('student speaking practice privacy', () => {
  const reserved = [{ eventType: 'english_table', date: '2026-10-15' }];

  function row(overrides) {
    return {
      attemptUid: 'att-1',
      transcript: 'I like the library.',
      submittedAt: '2026-10-14T02:00:00.000Z',
      audioPath: 'uploads/secret.webm',
      features: {
        context: {
          source: 'english-table',
          linkedActivity: 'English Table',
          activityPhase: 'pre_activity',
          activityDate: '2026-10-15',
          activityQuestionNumber: '2',
        },
      },
      task: { prompt: 'Where do you study?' },
      ...overrides,
    };
  }

  test('keeps the sentence and phrase card, and leaves the recording out', () => {
    const item = toPublicAttempt(row());
    expect(item).toMatchObject({
      attemptUid: 'att-1',
      activityDate: '2026-10-15',
      activityPhase: 'pre_activity',
      questionNumber: '2',
      heard: 'I like the library.',
      phraseId: 'pb_et_009',
    });
    expect(item.audioPath).toBeUndefined();
    expect(item.say).toMatch(/because ______/);
  });

  test('drops attempts that are not tied to a reserved English Table date', () => {
    const dates = englishTableDates(reserved);
    const otherDay = toPublicAttempt(row({
      features: {
        context: {
          source: 'english-table',
          activityPhase: 'pre_activity',
          activityDate: '2026-10-08',
          activityQuestionNumber: '1',
        },
      },
    }));
    const diagnostic = toPublicAttempt(row({
      features: { context: { source: 'diagnostic', activityPhase: 'diagnostic' } },
    }));
    expect(dates.has(otherDay.activityDate)).toBe(false);
    expect(diagnostic).toBeNull();
    expect(dates.has('2026-10-15')).toBe(true);
  });

  test('keeps the latest pre and post for the same question, and the reservation card uses the newest', () => {
    const preOld = toPublicAttempt(row({ attemptUid: 'pre-old', submittedAt: '2026-10-13T04:00:00.000Z' }));
    const preNew = toPublicAttempt(row({ attemptUid: 'pre-new', submittedAt: '2026-10-14T04:00:00.000Z' }));
    const post = toPublicAttempt(row({
      attemptUid: 'post',
      submittedAt: '2026-10-15T04:00:00.000Z',
      features: {
        context: {
          source: 'english-table',
          activityPhase: 'post_activity',
          activityDate: '2026-10-15',
          activityQuestionNumber: '2',
        },
      },
    }));
    const kept = keepLatestPair([post, preNew, preOld]);
    expect(kept.map((item) => item.attemptUid).sort()).toEqual(['post', 'pre-new']);
    expect(latestByQuestion([preOld, preNew, post])['2'].attemptUid).toBe('post');
  });
});
