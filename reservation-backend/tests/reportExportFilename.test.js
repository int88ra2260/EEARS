const {
  buildEearsReportBasename,
  buildContentDispositionAttachment,
  attachmentContentDisposition,
  sanitizeFilenameSegment,
} = require('../utils/reportExportFilename');

describe('reportExportFilename', () => {
  test('builds ASCII basename with timestamp suffix', () => {
    const { basename, ext } = buildEearsReportBasename({
      reportType: 'overview',
      semester: '114-1',
      ext: 'xlsx',
    });
    expect(ext).toBe('xlsx');
    expect(basename).toMatch(/^EEARS_overview_114-1_\d{8}_\d{4}$/);
  });

  test('sanitizes unsafe segments', () => {
    expect(sanitizeFilenameSegment('a b/c', 'x')).toBe('a_b_c');
  });

  test('Content-Disposition uses quoted ASCII filename', () => {
    const cd = buildContentDispositionAttachment('EEARS_test_114-1_20260101_1200', 'xlsx');
    expect(cd).toContain('filename="EEARS_test_114-1_20260101_1200.xlsx"');
    expect(cd).toMatch(/^[\x00-\x7F]+$/);
  });

  test('Chinese display name stays ASCII in the header', () => {
    const cd = attachmentContentDisposition('英文中級_明細_115-1.xlsx');
    expect(cd).toMatch(/^[\x00-\x7F]+$/);
    expect(cd).toContain('filename*=UTF-8\'\'');
    expect(cd).not.toMatch(/[\u4e00-\u9fff]/);
  });
});
