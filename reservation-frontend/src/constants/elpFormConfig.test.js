import { resolveFormFields, validateRuleForm, buildSubmissionPayload, formatRuleLimitHint } from './elpFormConfig';

const softwareForm = {
  activityDate: '2026-10-01',
  softwareType: 'Live ABC',
  sessionCount: '10',
  scoreOrPass: '通過',
};

describe('elpFormConfig self-study software', () => {
  it('does not require an attachment when the rule says so', () => {
    const rule = { requiresAttachment: false, basePoints: 2, maxPointsPerWeek: 20 };
    const fields = resolveFormFields('SELF_STUDY_SOFTWARE', rule);
    expect(fields.find((f) => f.type === 'file').required).toBe(false);
    expect(validateRuleForm('SELF_STUDY_SOFTWARE', softwareForm, {}, { rule })).toBe('');
  });

  it('still requires an attachment when the rule asks for one', () => {
    const rule = { requiresAttachment: true, basePoints: 2, maxPointsPerWeek: 20 };
    const message = validateRuleForm('SELF_STUDY_SOFTWARE', softwareForm, {}, { rule });
    expect(message).toContain('證明附件');
  });

  it('stores the completed round count for point calculation', () => {
    const payload = buildSubmissionPayload('SELF_STUDY_SOFTWARE', softwareForm);
    expect(payload.metadataJson.sessionCount).toBe(10);
  });

  it('uses rule points for course, competition, and external exam labels', () => {
    const course = formatRuleLimitHint({ code: 'ENGLISH_COURSE', basePoints: 40 });
    expect(course).toBe('每門 40 點');

    const competition = resolveFormFields('ENGLISH_COMPETITION', { basePoints: 10, bonusPoints: 30 });
    expect(competition.find((f) => f.key === 'wonAward').options).toEqual([
      { value: false, label: '否（10 點）' },
      { value: true, label: '是（30 點）' },
    ]);

    const exam = formatRuleLimitHint({
      code: 'EXTERNAL_EXAM',
      basePoints: 15,
      bonusPoints: 25,
      isOnceOnly: true,
    });
    expect(exam).toBe('有效成績 15 點 · 達門檻 25 點 · 僅採計一次');
  });

  it('limits rounds to the weekly point cap', () => {
    const rule = { requiresAttachment: false, basePoints: 2, maxPointsPerWeek: 20 };
    const message = validateRuleForm('SELF_STUDY_SOFTWARE', { ...softwareForm, sessionCount: '11' }, {}, { rule });
    expect(message).toContain('1 到 10');
  });
});
