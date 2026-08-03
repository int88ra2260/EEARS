'use strict';

const {
  clusterExamDates,
  buildStudentPrePostExportRow,
  enrichExamExportRow,
  EXAM_SESSION_WINDOW_DAYS,
} = require('../services/learningAnalytics/prePostExamExportUtils');

describe('prePostExamExportUtils', () => {
  it('clusters BESTEP split-session dates within window as one round', () => {
    const clusters = clusterExamDates(['2024-03-01', '2024-03-08'], EXAM_SESSION_WINDOW_DAYS);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].dates).toEqual(['2024-03-01', '2024-03-08']);
  });

  it('splits dates beyond window into separate rounds', () => {
    const clusters = clusterExamDates(['2024-03-01', '2024-04-20'], EXAM_SESSION_WINDOW_DAYS);
    expect(clusters).toHaveLength(2);
  });

  it('builds pre/post student export row from two BESTEP rounds', () => {
    const exams = [
      { studentId: 'S1', instrument: 'BESTEP', skill: 'listening', examDate: '2024-03-01', rawScore: 100, cefrLevel: 'B1', excludeFlag: false, registeredNoScoreFlag: false },
      { studentId: 'S1', instrument: 'BESTEP', skill: 'reading', examDate: '2024-03-01', rawScore: 110, cefrLevel: 'B1', excludeFlag: false, registeredNoScoreFlag: false },
      { studentId: 'S1', instrument: 'BESTEP', skill: 'speaking', examDate: '2024-03-08', rawScore: 90, cefrLevel: 'A2', excludeFlag: false, registeredNoScoreFlag: false },
      { studentId: 'S1', instrument: 'BESTEP', skill: 'writing', examDate: '2024-03-08', rawScore: 95, cefrLevel: 'A2', excludeFlag: false, registeredNoScoreFlag: false },
      { studentId: 'S1', instrument: 'BESTEP', skill: 'listening', examDate: '2025-09-01', rawScore: 130, cefrLevel: 'B2', excludeFlag: false, registeredNoScoreFlag: false },
      { studentId: 'S1', instrument: 'BESTEP', skill: 'reading', examDate: '2025-09-01', rawScore: 140, cefrLevel: 'B2', excludeFlag: false, registeredNoScoreFlag: false },
      { studentId: 'S1', instrument: 'BESTEP', skill: 'speaking', examDate: '2025-09-08', rawScore: 120, cefrLevel: 'B2', excludeFlag: false, registeredNoScoreFlag: false },
      { studentId: 'S1', instrument: 'BESTEP', skill: 'writing', examDate: '2025-09-08', rawScore: 125, cefrLevel: 'B2', excludeFlag: false, registeredNoScoreFlag: false },
    ];

    const row = buildStudentPrePostExportRow({ studentId: 'S1', cohort: '112' }, exams);
    expect(row.primaryInstrument).toBe('BESTEP');
    expect(row.examRoundCount).toBe(2);
    expect(row.preTestLabel).toBe('第1梯檢定');
    expect(row.postTestLabel).toBe('第2梯檢定');
    expect(row.preListeningScore).toBe(100);
    expect(row.postListeningScore).toBe(130);
    expect(row.deltaListeningScore).toBe(30);
    expect(row.preTestDateStart).toBe('2024-03-01');
    expect(row.preTestDateEnd).toBe('2024-03-08');
  });

  it('labels exam rows with round and phase', () => {
    const allExams = [
      { studentId: 'S1', instrument: 'BESTEP', skill: 'listening', examDate: '2024-03-01', rawScore: 100, excludeFlag: false, registeredNoScoreFlag: false },
      { studentId: 'S1', instrument: 'BESTEP', skill: 'listening', examDate: '2025-09-01', rawScore: 130, excludeFlag: false, registeredNoScoreFlag: false },
    ];
    const pre = enrichExamExportRow(allExams[0], allExams);
    const post = enrichExamExportRow(allExams[1], allExams);
    expect(pre.testPhase).toBe('前測');
    expect(post.testPhase).toBe('後測');
    expect(pre.examRound).toBe(1);
    expect(post.examRound).toBe(2);
  });
});
