'use strict';

const XLSX = require('xlsx');
const {
  parseAcademicCourseRosterWorkbook,
  buildClassDisplayName,
  looksLikeCourseCode,
} = require('../services/learningJourney/academicCourseRosterImportService');

function buildWorkbookBuffer(sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const ESP_HEADER = [
  '序號', '課程名稱', '授課教師', '學號', '姓名', '系所', '性別', '年級', '班別', '電子信箱',
];

describe('academicCourseRosterImportService', () => {
  it('detects GE course code in 序號 column', () => {
    expect(looksLikeCourseCode('GEEN117')).toBe(true);
    expect(looksLikeCourseCode('GEEN117B')).toBe(true);
    expect(looksLikeCourseCode('1')).toBe(false);
    expect(looksLikeCourseCode('19')).toBe(false);
  });

  it('parses ESP rows and assigns stable course codes', () => {
    const buffer = buildWorkbookBuffer({
      ESP: [
        ESP_HEADER,
        [1, '實用醫療英語 （中高級）', '傅安德', 'B141010003', '王嘉妤', '中國文學系', '女', '一年級', '', 'candy@example.com'],
        [2, '實用醫療英語 （中高級）', '傅安德', 'B141010004', '李小華', '中國文學系', '男', '一年級', '', 'a@example.com'],
        [1, '科技英文聽講練習（中高級）', '曾彩楣', 'B113012038', '盧雅琦', '電機工程學系', '女', '四年級', '', 'b@example.com'],
      ],
    });

    const parsed = parseAcademicCourseRosterWorkbook(buffer, '114-2');
    expect(parsed.rows).toHaveLength(3);
    const wang = parsed.rows.find((r) => r.studentId === 'B141010003');
    expect(wang).toMatchObject({
      courseName: '實用醫療英語 （中高級）',
      instructorName: '傅安德',
      courseCode: 'ESP001',
      courseType: 'ESP',
      grade: 1,
    });
    const otherCourse = parsed.rows.find((r) => r.studentId === 'B113012038');
    expect(otherCourse.courseCode).toBe('ESP002');
  });

  it('uses GEEN course code from 序號 when present', () => {
    const buffer = buildWorkbookBuffer({
      GE: [
        ESP_HEADER,
        ['GEEN117', '英文中高級', '溫惠珍', 'B095040045', '金希舁', '海洋環境及工程學系', '男', '四年級', '', 'x@example.com'],
      ],
    });
    const parsed = parseAcademicCourseRosterWorkbook(buffer, '114-2');
    expect(parsed.rows[0].courseCode).toBe('GEEN117');
  });

  it('builds unique class display names per instructor', () => {
    expect(buildClassDisplayName('英文中高級', '溫惠珍')).toBe('英文中高級（溫惠珍）');
  });
});
