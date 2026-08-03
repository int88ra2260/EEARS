const { sanitizeForAudit } = require('../utils/logSanitizer');
const { logExportAudit, estimateReportRowCount } = require('../utils/exportAudit');

const mockLogAuditAsync = jest.fn();

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: (...args) => mockLogAuditAsync(...args),
}));

describe('exportAudit helper', () => {
  beforeEach(() => {
    mockLogAuditAsync.mockClear();
  });

  const req = { requestId: 'req-export-test', user: { id: 9, role: 'admin', name: 'Admin' } };

  it('writes audit with rowCount, filters, and requestId', () => {
    logExportAudit(req, {
      module: 'reports',
      action: 'report_export_class',
      entityId: 'class:1:114-1',
      exportType: 'xlsx',
      reportType: 'class',
      rowCount: 42,
      filters: { semester: '114-1', classId: 1 },
      fileName: 'EEARS_class_114-1.xlsx',
    });

    expect(mockLogAuditAsync).toHaveBeenCalledTimes(1);
    const payload = mockLogAuditAsync.mock.calls[0][0];
    expect(payload.action).toBe('report_export_class');
    expect(payload.afterData.rowCount).toBe(42);
    expect(payload.afterData.filters.semester).toBe('114-1');
    expect(payload.afterData.requestId).toBe('req-export-test');
    expect(payload.req).toBe(req);
  });

  it('audit afterData does not include raw student rows or passwords', () => {
    logExportAudit(req, {
      module: 'bestep',
      action: 'bestep_class_export',
      rowCount: 2,
      filters: {
        studentId: 'B123456789',
        studentEmail: 'secret@nsysu.edu.tw',
        password: 'SecretPass1!',
        answersJson: { q1: 'x' },
        rawPayload: { nested: true },
      },
    });

    const afterData = mockLogAuditAsync.mock.calls[0][0].afterData;
    const sanitized = sanitizeForAudit(afterData);
    const json = JSON.stringify(sanitized);
    expect(json).not.toMatch(/SecretPass1/);
    expect(json).not.toMatch(/B123456789/);
    expect(json).not.toMatch(/secret@nsysu\.edu\.tw/);
    expect(sanitized.filters.password).toBe('[已遮罩]');
    expect(sanitized.filters.answersJson).toBe('[已遮罩]');
    expect(sanitized.filters.rawPayload).toBe('[已遮罩]');
  });

  it('estimateReportRowCount for high-risk report', () => {
    const count = estimateReportRowCount({ risks: [{}, {}, {}] }, 'high-risk');
    expect(count).toBe(3);
  });
});

describe('sanitizeForAudit export-related keys', () => {
  it('masks sensitive keys used in P0/P1 audit payloads', () => {
    const payload = sanitizeForAudit({
      exportType: 'xlsx',
      rowCount: 1,
      studentId: 'B123456789',
      studentEmail: 'a@b.co',
      idNumber: 'A123456789',
      token: 'jwt-abc',
      answersJson: { x: 1 },
      rawPayload: { y: 2 },
    });
    expect(payload.studentId).not.toBe('B123456789');
    expect(payload.studentEmail).not.toBe('a@b.co');
    expect(payload.idNumber).not.toBe('A123456789');
    expect(payload.token).toBe('[已遮罩]');
    expect(payload.answersJson).toBe('[已遮罩]');
    expect(payload.rawPayload).toBe('[已遮罩]');
  });
});
