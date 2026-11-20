'use strict';

const { buildStudentPrePost, gseForRecordedExam } = require('../services/learningAnalytics/studentPrePostSnapshot');

function exam(overrides) {
  return {
    studentId: 'D001',
    testPhase: 'pre_test',
    instrument: 'IELTS',
    skill: 'listening',
    rawScore: 6,
    cefrLevel: 'B1',
    examDate: '2026-03-01',
    examRound: 1,
    excludeFlag: false,
    registeredNoScoreFlag: false,
    ...overrides,
  };
}

describe('studentPrePostSnapshot', () => {
  it('averages mapped skill GSE and keeps the recorded CEFR', () => {
    const snapshot = buildStudentPrePost([
      exam({ skill: 'listening', rawScore: 6, cefrLevel: 'B1' }),
      exam({ skill: 'reading', rawScore: 6, cefrLevel: 'B1' }),
      exam({ skill: 'listening', testPhase: 'post_test', rawScore: 7, cefrLevel: 'B2', examDate: '2026-06-01', examRound: 2 }),
      exam({ skill: 'reading', testPhase: 'post_test', rawScore: 7, cefrLevel: 'B2', examDate: '2026-06-01', examRound: 2 }),
    ]);

    expect(snapshot.pre).toMatchObject({
      gse: 54,
      cefr: 'B1',
      cefrSource: 'recorded',
      mixedCefr: false,
      instrument: 'IELTS',
      skillCount: 2,
      mappedSkillCount: 2,
    });
    expect(snapshot.post.gse).toBe(66);
    expect(snapshot.post.cefr).toBe('B2');
    const listening = snapshot.skills.find((row) => row.skill === 'listening');
    expect(listening.rawDelta).toBe(1);
    expect(listening.gseDelta).toBe(12);
    expect(listening.sameInstrument).toBe(true);
  });

  it('does not subtract raw scores from different exams, and does not turn 0 into a GSE', () => {
    const snapshot = buildStudentPrePost([
      exam({ rawScore: 0, cefrLevel: null }),
      exam({
        testPhase: 'post_test',
        instrument: 'TOEIC',
        rawScore: 400,
        cefrLevel: 'B2',
        examDate: '2026-06-01',
      }),
      exam({ instrument: 'GSAT', rawScore: 13, examDate: '2025-01-01', cefrLevel: 'A2' }),
    ]);

    const listening = snapshot.skills.find((row) => row.skill === 'listening');
    expect(listening.pre.invalidScore).toBe(true);
    expect(listening.pre.gse).toBeNull();
    expect(listening.pre.rawScore).toBe(0);
    expect(listening.post.gse).toBe(59);
    expect(listening.rawDelta).toBeNull();
    expect(listening.gseDelta).toBeNull();
    expect(listening.sameInstrument).toBe(false);
    expect(snapshot.pre.gse).toBeNull();
    expect(snapshot.pre.skillCount).toBe(1);
  });

  it('uses the earliest pre-test and the latest post-test for each skill', () => {
    const snapshot = buildStudentPrePost([
      exam({ rawScore: 6, examDate: '2026-05-01' }),
      exam({ rawScore: 5, examDate: '2026-03-01', cefrLevel: 'A2' }),
      exam({ testPhase: 'post_test', rawScore: 6.5, examDate: '2026-06-01', cefrLevel: 'B2' }),
      exam({ testPhase: 'post_test', rawScore: 7, examDate: '2026-09-01', cefrLevel: 'B2' }),
    ]);
    const listening = snapshot.skills.find((row) => row.skill === 'listening');
    expect(listening.pre.rawScore).toBe(5);
    expect(listening.pre.examDate).toBe('2026-03-01');
    expect(listening.post.rawScore).toBe(7);
    expect(listening.post.examDate).toBe('2026-09-01');
  });

  it('keeps a single sitting on the pre-test side', () => {
    const snapshot = buildStudentPrePost([
      exam({ testPhase: 'single', rawScore: 6, cefrLevel: 'B1' }),
    ]);
    expect(snapshot.pre.gse).toBe(54);
    expect(snapshot.post.skillCount).toBe(0);
    expect(snapshot.post.gse).toBeNull();
  });

  it('maps a timeline exam without inventing GSE from a missing score', () => {
    expect(gseForRecordedExam(exam({ rawScore: 6 })).gse).toBe(54);
    expect(gseForRecordedExam(exam({ rawScore: null, cefrLevel: 'B1' }))).toEqual({
      gse: null,
      invalidScore: false,
    });
    expect(gseForRecordedExam(exam({ rawScore: 1 })).invalidScore).toBe(true);
    expect(gseForRecordedExam(exam({ instrument: 'GSAT', rawScore: 13 })).gse).toBeNull();
  });
});
