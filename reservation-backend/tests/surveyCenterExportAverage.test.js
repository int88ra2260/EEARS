const {
  computeExportAverageRow,
  pickQuestionCells,
  buildAnswerKvForExport,
} = require('../services/surveyCenterService');

describe('survey export average row', () => {
  const questionColumns = [
    { key: 'grade', header: '年級', type: 'radio', colKey: 'q_grade' },
    { key: 'q1', header: 'Q1 題目一', type: 'likert', colKey: 'q_q1' },
    { key: 'q2', header: 'Q2 題目二', type: 'likert', colKey: 'q_q2' },
  ];

  const rows = [
    { id: 1, answersJson: { grade: '一年級', q1: 4, q2: 5 } },
    { id: 2, answersJson: { grade: '二年級', q1: 2, q2: 3 } },
    { id: 3, answersJson: { grade: '一年級', q1: 5, q2: 4 } },
  ];
  const answersByResponseId = new Map();

  it('computes likert averages and leaves non-likert empty', () => {
    const avg = computeExportAverageRow(rows, questionColumns, answersByResponseId);
    expect(avg.q_grade).toBe('');
    expect(avg.q_q1).toBe(3.67);
    expect(avg.q_q2).toBe(4);
  });

  it('pickQuestionCells maps kv to export columns', () => {
    const kv = buildAnswerKvForExport({ q1: 3, grade: '一年級' }, []);
    const cells = pickQuestionCells(kv, questionColumns);
    expect(cells.q_q1).toBe('3');
    expect(cells.q_grade).toBe('一年級');
  });
});
