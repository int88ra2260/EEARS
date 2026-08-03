'use strict';

const {
  parseCourseMeta,
  parseStudentsFromText,
  buildClassDisplayName,
} = require('../services/classRosterPdfParseService');

describe('classRosterPdfParseService', () => {
  it('parses course header metadata', () => {
    const meta = parseCourseMeta(
      '114學年上學期 GEAIE610 賞析音樂學英語（中級） 修課學生名單 教師：王品惠\n序號'
    );
    expect(meta).toEqual(expect.objectContaining({
      semester: '114-1',
      courseCode: 'GEAIE610',
      courseName: '賞析音樂學英語（中級）',
      teacherName: '王品惠',
    }));
  });

  it('builds class display name from course name and code', () => {
    expect(buildClassDisplayName('賞析音樂學英語（中級）', 'GEAIE610'))
      .toBe('賞析音樂學英語（中級） GEAIE610');
  });

  it('parses student rows with department and grade', () => {
    const text = `
1 114 1 B101060003 陳奐霖
劇場
藝術
學系
男
四
年
級
b101060003@student.nsysu.edu.tw
2 114 1 B102020043 劉紫若 化學
系 女
四
年
級
b102020043@student.nsysu.edu.tw
3 114 1 I141020008 Erzsebet
KOSSUTH
外國
語文學系
女
三
年
級
I141020008@student.mail.nsysu.edu.tw
`;
    const { students, warnings } = parseStudentsFromText(text);
    expect(warnings).toEqual([]);
    expect(students).toHaveLength(3);
    expect(students[0]).toEqual(expect.objectContaining({
      studentId: 'B101060003',
      studentName: '陳奐霖',
      department: '劇場藝術學系',
      grade: 4,
    }));
    expect(students[1]).toEqual(expect.objectContaining({
      studentId: 'B102020043',
      studentName: '劉紫若',
      department: '化學系',
      grade: 4,
    }));
    expect(students[2]).toEqual(expect.objectContaining({
      studentId: 'I141020008',
      studentName: 'Erzsebet KOSSUTH',
      department: '外國語文學系',
      grade: 3,
    }));
  });
});
