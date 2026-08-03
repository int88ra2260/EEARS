const {
  buildEearsReportBasename,
  buildContentDispositionAttachment,
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

  test('Content-Disposition uses quoted filename', () => {
    const cd = buildContentDispositionAttachment('EEARS_test_114-1_20260101_1200', 'xlsx');
    expect(cd).toMatch(/^attachment; filename="EEARS_test_114-1_20260101_1200.xlsx"$/);
  });
});
