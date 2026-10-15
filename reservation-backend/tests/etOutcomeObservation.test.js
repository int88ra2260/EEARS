'use strict';

const { computeApplicableCompletion } = require('../services/etGrouping/etTaskCompletion');
const { computeTaskStatsFromMatrix } = require('../services/etGrouping/etGroupingExportService');
const {
  READING_GUIDE,
  summarizeStudentExams,
  classifySessionTiming,
  summarizeEventExamCoverage,
} = require('../services/etGrouping/etExamObservation');

describe('etTaskCompletion', () => {
  const tasks = [
    { id: 1, isRequired: true },
    { id: 2, isRequired: true },
    { id: 3, isRequired: false },
  ];

  test('只計必填且已勾選的適用任務，略過其他任務的勾選', () => {
    const stats = computeApplicableCompletion(tasks, [
      { taskItemId: 1, completed: true },
      { taskItemId: 3, completed: true },
      { taskItemId: 99, completed: true },
    ], { checkedIn: true });
    expect(stats).toEqual({ completed: 1, total: 2, rate: 50 });
  });

  test('未簽到或沒有必填任務時完成率為空', () => {
    expect(computeApplicableCompletion(tasks, [{ taskItemId: 1, completed: true }], { checkedIn: false }).rate).toBeNull();
    expect(computeApplicableCompletion([{ id: 3, isRequired: false }], [], { checkedIn: true }).rate).toBeNull();
  });

  test('單一已簽到學生的完成率與場次矩陣相同', () => {
    const marks = [{ taskItemId: 1, completed: true }];
    const student = computeApplicableCompletion(tasks, marks, { checkedIn: true });
    const matrix = computeTaskStatsFromMatrix({
      students: [{
        checkinStatus: '已簽到',
        tasks: [
          { isRequired: true, completed: true },
          { isRequired: true, completed: false },
          { isRequired: false, completed: true },
        ],
      }],
    });
    expect(student.rate).toBe(matrix.completionRate);
    expect(student.completed).toBe(matrix.completedMarks);
    expect(student.total).toBe(matrix.eligibleMarks);
  });
});

describe('etExamObservation', () => {
  test('閱讀說明包含四個觀察邊界', () => {
    expect(READING_GUIDE).toHaveLength(5);
    expect(READING_GUIDE.join('')).toMatch(/任務完成率/);
    expect(READING_GUIDE.join('')).toMatch(/不是官方英檢成績/);
    expect(READING_GUIDE.join('')).toMatch(/原始分/);
    expect(READING_GUIDE.join('')).toMatch(/不解釋成參加 English Table 造成進步/);
  });

  test('同一測驗前後測會標出場次落在考試時間軸的位置', () => {
    const exams = [
      { id: 1, studentId: 'A001', examDate: '2026-03-01', instrument: 'IELTS', skill: 'writing', rawScore: 5 },
      {
        id: 2,
        studentId: 'A001',
        examDate: '2026-09-01',
        instrument: 'IELTS',
        skill: 'writing',
        rawScore: 6.5,
        previousRawScore: 5,
        previousExamEventId: 1,
        deltaRawScore: 1.5,
        retestFlag: true,
        cefrLevel: 'B2',
      },
    ];
    const summary = summarizeStudentExams(exams);
    expect(summary.hasGrowth).toBe(true);
    expect(summary.preDate).toBe('2026-03-01');
    expect(summary.postDate).toBe('2026-09-01');
    expect(summary.avgRawDelta).toBe(1.5);
    expect(summary.improved).toBe(true);
    expect(classifySessionTiming('2026-01-15', summary).code).toBe('before_pre');
    expect(classifySessionTiming('2026-06-01', summary).code).toBe('between');
    expect(classifySessionTiming('2026-10-01', summary).code).toBe('after_post');
  });

  test('落在兩段前後測中間的空檔時不標成考試之間', () => {
    const summary = summarizeStudentExams([
      { id: 1, examDate: '2025-03-01', instrument: 'IELTS', skill: 'writing' },
      {
        id: 2,
        examDate: '2025-06-01',
        instrument: 'IELTS',
        skill: 'writing',
        rawScore: 6,
        previousRawScore: 5,
        previousExamEventId: 1,
        deltaRawScore: 1,
        retestFlag: true,
      },
      { id: 3, examDate: '2026-03-01', instrument: 'IELTS', skill: 'writing' },
      {
        id: 4,
        examDate: '2026-06-01',
        instrument: 'IELTS',
        skill: 'writing',
        rawScore: 6.5,
        previousRawScore: 6,
        previousExamEventId: 3,
        deltaRawScore: 0.5,
        retestFlag: true,
      },
    ]);
    expect(classifySessionTiming('2025-12-01', summary).code).toBe('between_gap');
    expect(classifySessionTiming('2025-04-01', summary).code).toBe('between');
  });

  test('沒有可計算前後測時不產生時間軸', () => {
    const summary = summarizeStudentExams([
      { id: 1, examDate: '2026-03-01', instrument: 'IELTS', skill: 'writing', rawScore: 5, retestFlag: false },
    ]);
    expect(summary.hasGrowth).toBe(false);
    expect(classifySessionTiming('2026-06-01', summary).code).toBe('no_exam');
  });

  test('原始分明顯變化但 GSE 幾乎不動時標換算解析度不足', () => {
    const summary = summarizeStudentExams([
      { id: 1, examDate: '2026-03-01', instrument: 'NOT_A_REAL_EXAM', skill: 'writing', cefrLevel: 'B1' },
      {
        id: 2,
        examDate: '2026-09-01',
        instrument: 'NOT_A_REAL_EXAM',
        skill: 'writing',
        rawScore: 20,
        previousRawScore: 10,
        previousExamEventId: 1,
        deltaRawScore: 10,
        retestFlag: true,
        cefrLevel: 'B1',
      },
    ]);
    expect(summary.avgRawDelta).toBe(10);
    expect(summary.resolutionWarning?.code).toBe('gse_resolution_low');
  });

  test('可計算成長少於 10 人時不顯示進步人數', () => {
    const small = Array.from({ length: 9 }, () => ({ hasGrowth: true, avgRawDelta: 2 }));
    const hidden = summarizeEventExamCoverage(small);
    expect(hidden.growthSampleSize).toBe(9);
    expect(hidden.privacySuppressed).toBe(true);
    expect(hidden.improvedStudentCount).toBeNull();

    const enough = [
      ...Array.from({ length: 6 }, () => ({ hasGrowth: true, avgRawDelta: 1 })),
      ...Array.from({ length: 4 }, () => ({ hasGrowth: true, avgRawDelta: -1 })),
      { hasGrowth: false, avgRawDelta: null },
    ];
    const shown = summarizeEventExamCoverage(enough);
    expect(shown.growthSampleSize).toBe(10);
    expect(shown.privacySuppressed).toBe(false);
    expect(shown.improvedStudentCount).toBe(6);
  });
});
