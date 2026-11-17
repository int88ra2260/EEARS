'use strict';

const {
  buildItemRelations,
  decorateDistributionQuestions,
  indexAnswersByResponse,
  spearmanRho,
} = require('../utils/surveyAssociationMath');

function likert(id, label) {
  return { id, type: 'likert', label, options: [], scale: ['1', '2', '3', '4', '5'] };
}

function record(id, answers, extra = {}) {
  return {
    responseId: id,
    activityType: extra.activityType || 'English Table',
    eventId: extra.eventId || null,
    semester: extra.semester || '114-1',
    answers,
  };
}

function score(value, text = String(value)) {
  return { text, score: value };
}

describe('surveyAssociationMath', () => {
  it('computes Spearman rho of 1, -1, and a tied series', () => {
    expect(spearmanRho([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBe(1);
    expect(spearmanRho([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBe(-1);
    expect(spearmanRho([1, 2, 2, 4], [1, 2, 2, 4])).toBe(1);
    expect(spearmanRho([1, 2, 3], [1, 2, 4])).toBe(1);
    expect(spearmanRho([1, 2, 3, 4], [1, 3, 2, 4])).toBe(0.8);
  });

  it('hides a single score below the sample threshold and keeps the group mean', () => {
    const schema = [
      { id: 'times_this_semester', type: 'radio', label: '本學期參與 ET 次數', options: ['5次以下', '6-10次', '11次以上'], scale: [] },
      likert('q7', '說英文更有自信'),
      likert('q18', '總體有益'),
    ];
    const low = Array.from({ length: 10 }, (_, index) => record(index + 1, {
      times_this_semester: { text: '5次以下', score: null },
      q7: score(4),
      q18: score(3),
    }));
    const high = Array.from({ length: 3 }, (_, index) => record(100 + index, {
      times_this_semester: { text: '11次以上', score: null },
      q7: score(5),
      q18: score(5),
    }));
    const result = buildItemRelations({
      records: [...high, ...low],
      schemaQuestions: schema,
      minN: 10,
      versionId: 4,
    });

    expect(result.groupBy).toBe('times_this_semester');
    expect(result.groups.map((group) => group.key)).toEqual(['5次以下', '11次以上']);
    expect(result.groups[0].cells.q7).toMatchObject({ n: 10, mean: 4, suppressed: false });
    expect(result.groups[1].cells.q7).toMatchObject({ n: 3, mean: null, suppressed: true, reason: 'MIN_N' });
    expect(JSON.stringify(result)).not.toContain('4.73');
    expect(result.note).toContain('不是因果');
  });

  it('does not publish an individual likert score when the cell is suppressed', () => {
    const schema = [likert('q7', '自信')];
    const result = buildItemRelations({
      records: [record(7, { q7: score(4.73) })],
      schemaQuestions: schema,
      groupBy: 'activityType',
      minN: 10,
    });
    expect(result.groups[0].cells.q7.mean).toBeNull();
    expect(JSON.stringify(result)).not.toContain('4.73');
    expect(JSON.stringify(result)).not.toContain('responseId');
  });

  it('correlates paired likert items and suppresses pairs under the threshold', () => {
    const schema = [likert('q7', '自信'), likert('q18', '總體')];
    const records = Array.from({ length: 10 }, (_, index) => record(index + 1, {
      q7: score(index < 5 ? 2 : 5),
      q18: score(index < 5 ? 1 : 4),
    }));
    records.push(record(99, { q7: score(3) }));
    const result = buildItemRelations({ records, schemaQuestions: schema, groupBy: 'semester', minN: 10 });
    expect(result.matrix.q7.q18).toMatchObject({ n: 10, rho: 1, suppressed: false });
    expect(result.matrix.q7.q7.rho).toBe(1);
    const sparse = buildItemRelations({
      records: records.slice(0, 4),
      schemaQuestions: schema,
      groupBy: 'semester',
      minN: 10,
    });
    expect(sparse.matrix.q7.q18).toMatchObject({ suppressed: true, rho: null, reason: 'MIN_N' });
  });

  it('suggests ET constructs and does not apply EC constructs to the ET item set', () => {
    const schema = Array.from({ length: 18 }, (_, index) => likert(`q${index + 1}`, `題${index + 1}`));
    const result = buildItemRelations({
      records: [record(1, { q7: score(3), q18: score(3) })],
      schemaQuestions: schema,
      minN: 10,
    });
    expect(result.suggestedQuestionKeys).toEqual(['q7', 'q17', 'q18']);
    expect(result.constructs.map((item) => item.id)).toEqual(['speaking', 'confidence', 'motivation', 'overall']);
    expect(result.constructs.find((item) => item.id === 'speaking').keys).toContain('q13');
  });

  it('suggests EC constructs only for the shorter club item set', () => {
    const schema = Array.from({ length: 10 }, (_, index) => likert(`q${index + 1}`, `題${index + 1}`));
    const result = buildItemRelations({ records: [], schemaQuestions: schema, minN: 10 });
    expect(result.constructs.map((item) => item.id)).toEqual([
      'ec_arrangement',
      'ec_teacher',
      'ec_learning',
      'ec_continue',
    ]);
    expect(result.suggestedQuestionKeys).toEqual(['q1', 'q8', 'q10']);
  });

  it('lets answer rows override answersJson and drops respondent fields', () => {
    const schema = [
      likert('q7', '自信'),
      { id: 'grade', type: 'radio', label: '年級', options: ['一年級', '二年級'], scale: [] },
    ];
    const index = indexAnswersByResponse({
      responses: [{
        id: '15',
        answersJson: {
          q7: 5,
          grade: '二年級',
          email: 'secret@example.com',
          name: '王小明',
          studentId: 'B12345678',
        },
      }],
      answerRows: [{ responseId: 15, questionKey: 'q7', answerText: '2', scoreValue: 2 }],
      schemaQuestions: schema,
    });
    const answers = index.get(15);
    expect(answers.q7.score).toBe(2);
    expect(answers.grade.text).toBe('二年級');
    const encoded = JSON.stringify(answers);
    expect(encoded).not.toContain('secret@example.com');
    expect(encoded).not.toContain('王小明');
    expect(encoded).not.toContain('B12345678');
  });

  it('orders likert distribution on the 1–5 scale and uses the question label', () => {
    const decorated = decorateDistributionQuestions(
      [{ questionKey: 'q7', questionType: 'likert', distribution: { 5: 2, 3: 4 }, averageScore: 3.5 }],
      [likert('q7', '說英文更有自信')],
    );
    expect(decorated[0].label).toBe('說英文更有自信');
    expect(decorated[0].optionOrder).toEqual(['1', '2', '3', '4', '5']);
  });

  it('reads likert scores from answersJson and skips respondent fields', () => {
    const { collectQLikertScores } = require('../utils/surveyAssociationMath');
    expect(collectQLikertScores({
      q7: 4,
      q18: 5,
      email: 'secret@example.com',
      grade: '一年級',
      studentId: 'R151010035',
    })).toEqual([4, 5]);
  });
});
