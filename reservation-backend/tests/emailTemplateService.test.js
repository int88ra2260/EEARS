'use strict';

const {
  interpolateTemplate,
  flattenVars,
  extractPlaceholders,
  enrichMailVars,
  validatePlaceholders,
  buildMailOptions,
  invalidateEmailTemplateOverrideCache,
} = require('../services/emailTemplateService');
const { getEmailTemplateDefaultSource } = require('../services/emailTemplateDefaultSources');
const EmailTemplateOverride = require('../models/EmailTemplateOverride');

jest.mock('../models/EmailTemplateOverride', () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  destroy: jest.fn(),
}));

describe('emailTemplateService', () => {
  beforeEach(() => {
    invalidateEmailTemplateOverrideCache();
    jest.clearAllMocks();
    EmailTemplateOverride.findAll.mockResolvedValue([]);
  });

  test('interpolateTemplate replaces placeholders', () => {
    expect(interpolateTemplate('Hi {{ studentName }} / {{code}}', { studentName: 'Ann', code: '99' }))
      .toBe('Hi Ann / 99');
    expect(interpolateTemplate('Missing {{x}}', {})).toBe('Missing ');
  });

  test('flattenVars flattens nested objects', () => {
    const vars = flattenVars({ a: 1, nested: { b: 2 }, list: ['x', 'y'] });
    expect(vars.a).toBe(1);
    expect(vars['nested.b']).toBe(2);
    expect(vars.list).toBe('x, y');
  });

  test('validatePlaceholders flags unknown keys', () => {
    const result = validatePlaceholders(
      'Hello {{studentName}}',
      'Code {{oops}}',
      ['studentName', 'code']
    );
    expect(result.used).toEqual(expect.arrayContaining(['studentName', 'oops']));
    expect(result.unknown).toEqual(['oops']);
  });

  test('extractPlaceholders finds unique keys', () => {
    expect(extractPlaceholders('{{a}} {{b}} {{a}}')).toEqual(['a', 'b']);
  });

  test('buildMailOptions uses code default when no override', async () => {
    const mail = await buildMailOptions('englishTestEmailVerification', {
      email: 'a@b.com',
      code: '654321',
      expiresInMinutes: 5,
    });
    expect(mail.to).toBe('a@b.com');
    expect(mail.subject).toMatch(/驗證碼/);
    expect(mail.text).toContain('654321');
  });

  test('buildMailOptions applies subject/body override', async () => {
    EmailTemplateOverride.findAll.mockResolvedValue([
      {
        templateKey: 'englishTestEmailVerification',
        subjectTemplate: 'OTP {{code}}',
        bodyTemplate: 'Your code is {{code}} for {{email}}',
        isEnabled: true,
      },
    ]);
    invalidateEmailTemplateOverrideCache();
    const mail = await buildMailOptions('englishTestEmailVerification', {
      email: 'a@b.com',
      code: '111222',
    });
    expect(mail.subject).toBe('OTP 111222');
    expect(mail.text).toBe('Your code is 111222 for a@b.com');
  });

  test('buildMailOptions throws when disabled', async () => {
    EmailTemplateOverride.findAll.mockResolvedValue([
      {
        templateKey: 'englishTestEmailVerification',
        subjectTemplate: null,
        bodyTemplate: null,
        isEnabled: false,
      },
    ]);
    invalidateEmailTemplateOverrideCache();
    await expect(
      buildMailOptions('englishTestEmailVerification', { email: 'a@b.com', code: '1' })
    ).rejects.toMatchObject({ code: 'EMAIL_TEMPLATE_DISABLED' });
  });

  test('default sources use placeholders instead of sample names', () => {
    const source = getEmailTemplateDefaultSource('reservationCancellation');
    expect(source.subject).toContain('{{subjectPrefix}}');
    expect(source.body).toContain('{{studentName}}');
    expect(source.body).toContain('{{studentId}}');
    expect(source.body).not.toContain('王小明');
  });

  test('enrichMailVars fills derived activity fields', () => {
    const vars = enrichMailVars({
      studentName: 'Ann',
      studentId: 'B1',
      eventType: 'English Table',
      startTime: '12:10',
      location: 'Lib',
      cancellationCode: 'X1',
    });
    expect(vars.subjectPrefix).toMatch(/English Table/);
    expect(vars.locationZh).toBe('Lib');
    expect(vars.cancellationCode).toBe('X1');
  });
});
