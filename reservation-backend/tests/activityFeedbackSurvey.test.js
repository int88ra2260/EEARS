'use strict';

const { buildActivityFeedbackSchema } = require('../constants/activityFeedbackSurvey');
const { validateSurveyData } = require('../utils/surveyFormValidation');
const { applySurveyVisibility, isQuestionVisible } = require('../utils/surveyVisibility');

const schema = buildActivityFeedbackSchema();

function visibleIds(answers) {
  const data = applySurveyVisibility(answers, schema.questions);
  return schema.questions
    .filter((question) => isQuestionVisible(question, data))
    .map((question) => question.id);
}

describe('activity website feedback survey', () => {
  it('沒參加、也沒想約的人不必回答活動過程', () => {
    const answers = {
      af_grade: '大學一年級',
      af_attended: ['都沒有出席過'],
      af_missed: ['沒有這種情況'],
      af_absent_reason: '時間和課表衝突',
      af_device: '手機',
      af_site_friction: '目前都還順',
      af_saw_topic: '有看到，而且是在預約前',
      af_et_speak: '5',
    };
    const ids = visibleIds(answers);
    expect(ids).toContain('af_absent_reason');
    expect(ids).not.toContain('af_et_speak');
    expect(ids).not.toContain('af_saw_topic');
    expect(ids).not.toContain('af_primary');
    expect(validateSurveyData(answers, schema).isValid).toBe(true);
  });

  it('出席 English Table 時會出現會前練習，缺題不能送出', () => {
    const answers = {
      af_grade: '大學二年級',
      af_attended: ['English Table'],
      af_missed: ['沒有這種情況'],
    };
    expect(visibleIds(answers)).toContain('af_did_practice');
    expect(visibleIds(answers)).toContain('af_et_speak');
    expect(validateSurveyData(answers, schema).isValid).toBe(false);
  });

  it('不需要回饋時不必再選看到回饋的位置', () => {
    const answers = {
      af_grade: '碩博士',
      af_attended: ['Job Talk'],
      af_missed: ['沒有這種情況'],
      af_feedback_kind: '不需要額外回饋',
    };
    expect(visibleIds(answers)).not.toContain('af_feedback_where');
    expect(visibleIds({
      ...answers,
      af_feedback_kind: '結束前一句口頭建議',
    })).toContain('af_feedback_where');
  });

  it('同時選「都沒有出席」和具體活動時不通過', () => {
    const result = validateSurveyData({
      af_grade: '大學三年級',
      af_attended: ['English Table', '都沒有出席過'],
      af_missed: ['沒有這種情況'],
    }, schema);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('都沒有出席過');
  });
});
