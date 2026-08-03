'use strict';

jest.mock('../models', () => ({
  EnglishLearningPassport: { findOne: jest.fn() },
  EnglishLearningSubmission: { findAll: jest.fn() },
  EnglishLearningPointRule: { findAll: jest.fn() },
}));

jest.mock('../services/englishLearningPassport/auditService', () => ({
  logElpAudit: jest.fn().mockResolvedValue(undefined),
}));

const {
  EnglishLearningPassport,
  EnglishLearningSubmission,
  EnglishLearningPointRule,
} = require('../models');
const {
  buildCertificationCertificateData,
  renderCertificationCertificateHtml,
} = require('../services/englishLearningPassport/certificationCertificateService');

const student = {
  studentId: 'B123456789',
  studentName: '陳竑仰',
  studentEmail: 'test@example.com',
};

describe('certificationCertificateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when certification not approved', async () => {
    EnglishLearningPassport.findOne.mockResolvedValue({
      toJSON: () => ({
        id: 1,
        studentId: student.studentId,
        studentName: student.studentName,
        studentEmail: student.studentEmail,
        certificationStatus: 'pending',
        totalApprovedPoints: 100,
      }),
      studentName: student.studentName,
      studentEmail: student.studentEmail,
      certificationStatus: 'pending',
    });

    await expect(buildCertificationCertificateData(student)).rejects.toMatchObject({
      code: 'CERTIFICATION_NOT_APPROVED',
      status: 403,
    });
  });

  it('builds certificate data with approved submissions', async () => {
    EnglishLearningPassport.findOne.mockResolvedValue({
      toJSON: () => ({
        id: 1,
        studentId: student.studentId,
        studentName: student.studentName,
        studentEmail: student.studentEmail,
        certificationStatus: 'approved',
        certificationReviewedAt: new Date('2026-06-15T10:00:00Z'),
        completedAt: new Date('2026-06-15T10:00:00Z'),
        totalApprovedPoints: 100,
      }),
      studentName: student.studentName,
      studentEmail: student.studentEmail,
      certificationStatus: 'approved',
    });
    EnglishLearningPointRule.findAll.mockResolvedValue([
      { code: 'ENGLISH_COURSE', name: '英語相關課程' },
    ]);
    EnglishLearningSubmission.findAll.mockResolvedValue([
      {
        toJSON: () => ({
          ruleCode: 'ENGLISH_COURSE',
          title: '全英授課',
          activityDate: '114-2',
          pointsApproved: 60,
          reviewedAt: new Date('2026-06-15T04:00:00Z'),
        }),
      },
    ]);

    const data = await buildCertificationCertificateData(student);
    expect(data.passport.studentName).toBe('陳竑仰');
    expect(data.pointsByRule).toEqual([{ code: 'ENGLISH_COURSE', name: '英語相關課程', points: 60 }]);
    expect(data.approvedItems).toHaveLength(1);

    const html = renderCertificationCertificateHtml(data);
    expect(html).toContain('集點完成審核表（精簡版）');
    expect(html).toContain('陳竑仰');
    expect(html).toContain('全英授課');
    expect(html).toContain('英語文能力標準認證');
  });
});
