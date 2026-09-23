'use strict';

jest.mock('../models', () => ({
  EnglishTestRegistration: { findAll: jest.fn() },
  EnglishTestMailTemplate: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  EnglishTestMailSend: {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
  },
}));

jest.mock('../config/email', () => {
  const actual = jest.requireActual('../config/email');
  return {
    ...actual,
    sendRawMail: jest.fn(),
  };
});

jest.mock('../services/emailTemplateService', () => {
  const actual = jest.requireActual('../services/emailTemplateService');
  return {
    ...actual,
    buildMailOptions: jest.fn(),
  };
});

const { EnglishTestRegistration, EnglishTestMailTemplate, EnglishTestMailSend } = require('../models');
const { sendRawMail } = require('../config/email');
const { buildMailOptions } = require('../services/emailTemplateService');
const service = require('../services/englishTestManualMailService');

describe('englishTestManualMailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    EnglishTestMailSend.create.mockResolvedValue({});
    sendRawMail.mockResolvedValue({ ok: true });
  });

  test('rejects empty recipient list', async () => {
    await expect(service.sendToSelected({ ids: [], source: 'adhoc', subject: 'a', body: 'b' }))
      .rejects.toMatchObject({ status: 400, code: 'IDS_REQUIRED' });
  });

  test('rejects verification and admin-only catalog keys', async () => {
    await expect(service.sendToSelected({
      ids: [1],
      source: 'catalog',
      templateKey: 'englishTestEmailVerification',
    })).rejects.toMatchObject({ status: 400, code: 'UNKNOWN_TEMPLATE' });

    await expect(service.sendToSelected({
      ids: [1],
      source: 'catalog',
      templateKey: 'englishTestRegistrationUpdated',
    })).rejects.toMatchObject({ status: 400, code: 'UNKNOWN_TEMPLATE' });
  });

  test('adhoc requires subject and body', async () => {
    await expect(service.sendToSelected({
      ids: [1],
      source: 'adhoc',
      subject: '通知',
      body: '   ',
    })).rejects.toMatchObject({ status: 400, code: 'INVALID_BODY' });
  });

  test('catalog send forces student address and records version', async () => {
    EnglishTestRegistration.findAll.mockResolvedValue([{
      id: 9,
      studentId: 'B123',
      name: 'Wang',
      studentNameZh: '王小明',
      email: 'student@example.com',
      status: 'success',
      examType: 'LR',
    }]);
    buildMailOptions.mockResolvedValue({
      to: 'emicenter@mail.nsysu.edu.tw',
      subject: '報名成功',
      text: 'hello',
    });

    const result = await service.sendToSelected({
      ids: [9],
      source: 'catalog',
      templateKey: 'englishTestRegistrationFinalSuccess',
      userId: 3,
    });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.versionLabel).toBe('郵件設定：報名成功（最終）');
    expect(sendRawMail).toHaveBeenCalledWith(
      'englishTestRegistrationFinalSuccess',
      expect.objectContaining({ to: 'student@example.com', subject: '報名成功' }),
    );
    expect(EnglishTestMailSend.create).toHaveBeenCalledWith(expect.objectContaining({
      registrationId: 9,
      studentId: 'B123',
      email: 'student@example.com',
      sourceType: 'catalog',
      versionLabel: '郵件設定：報名成功（最終）',
      templateKey: 'englishTestRegistrationFinalSuccess',
      status: 'success',
      sentByUserId: 3,
    }));
  });

  test('custom template send uses manual transport key', async () => {
    EnglishTestMailTemplate.findByPk.mockResolvedValue({
      id: 4,
      name: '補件提醒',
      subjectTemplate: '請補件 {{studentNameZh}}',
      bodyTemplate: '學號 {{studentId}}',
    });
    EnglishTestRegistration.findAll.mockResolvedValue([{
      id: 2,
      studentId: 'B999',
      name: 'Lee',
      studentNameZh: '李四',
      email: 'lee@example.com',
      status: 'revision',
      examType: 'SW',
    }]);

    const result = await service.sendToSelected({
      ids: [2],
      source: 'custom',
      customTemplateId: 4,
    });

    expect(result.versionLabel).toBe('自訂範本：補件提醒');
    expect(sendRawMail).toHaveBeenCalledWith(
      'englishTestManualSend',
      expect.objectContaining({
        to: 'lee@example.com',
        subject: '請補件 李四',
        text: '學號 B999',
      }),
    );
    expect(EnglishTestMailSend.create).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: 'custom',
      customTemplateId: 4,
      versionLabel: '自訂範本：補件提醒',
      status: 'success',
    }));
  });

  test('createCustomTemplate rejects a blank name', async () => {
    await expect(service.createCustomTemplate({
      name: '  ',
      subjectTemplate: '主旨',
      bodyTemplate: '內文',
    })).rejects.toMatchObject({ status: 400, code: 'INVALID_TEMPLATE_NAME' });
    expect(EnglishTestMailTemplate.create).not.toHaveBeenCalled();
  });
});
