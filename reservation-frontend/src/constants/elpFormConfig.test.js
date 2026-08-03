import { buildSubmissionPayload, RULE_FORM_FIELDS } from '../constants/elpFormConfig';

describe('elpFormConfig', () => {
  it('buildSubmissionPayload for ENGLISH_COMPETITION', () => {
    const payload = buildSubmissionPayload('ENGLISH_COMPETITION', {
      activityDate: '2026-06-10',
      competitionName: '演講比賽',
      wonAward: 'true',
      description: 'test',
    });
    expect(payload.ruleCode).toBe('ENGLISH_COMPETITION');
    expect(payload.title).toBe('演講比賽');
    expect(payload.metadataJson.wonAward).toBe(true);
  });

  it('has fields for all rule codes', () => {
    const codes = Object.keys(RULE_FORM_FIELDS);
    expect(codes).toContain('EXTERNAL_EXAM');
    expect(codes).toContain('COLLEGE_ENGLISH_CORNER');
  });
});
