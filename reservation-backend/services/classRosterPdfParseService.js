'use strict';

const STUDENT_ID_RE = /[A-Za-z]\d{9}/;
const ROW_START_RE = /(\d+)\s+(\d{3})\s+([12])\s+([A-Za-z]\d{9})\s+/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
let PDFParseCtor = null;

function getPdfParseCtor() {
  if (!PDFParseCtor) {
    ({ PDFParse: PDFParseCtor } = require('pdf-parse'));
  }
  return PDFParseCtor;
}
const GRADE_MAP = Object.freeze({
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
});

/** 選課系統 PDF 常把常用字抽成康熙部首／相容字形 */
function normalizeCjkCompat(value) {
  return String(value || '')
    .replace(/⼀/g, '一')
    .replace(/⼆/g, '二')
    .replace(/⼈/g, '人')
    .replace(/⼥/g, '女')
    .replace(/⼯/g, '工')
    .replace(/⽂/g, '文')
    .replace(/⿈/g, '黃')
    .replace(/⼠/g, '士')
    .replace(/⽣/g, '生')
    .replace(/⼠/g, '士');
}

function cleanText(value) {
  return normalizeCjkCompat(String(value || ''))
    .replace(/\u3000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeCompact(value) {
  return cleanText(value).replace(/\s+/g, '');
}

function stripGenderAndGradeFromDepartment(department) {
  if (!department) return null;
  return normalizeCompact(department)
    .replace(/[男女]\s*/g, '')
    .replace(/[一二三四五六]年級/g, '')
    .replace(/(甲|乙|丙|丁)?班/g, '')
    .replace(/全英班?/g, '')
    .trim() || null;
}

function parseSemesterFromHeader(headerLine) {
  const m = String(headerLine || '').match(/(\d{3})\s*學年\s*(?:上|下)?\s*學期/);
  if (!m) return null;
  const year = m[1];
  const term = /下學期/.test(headerLine) ? '2' : (/上學期/.test(headerLine) ? '1' : null);
  if (!term) return null;
  return `${year}-${term}`;
}

function parseCourseMeta(text) {
  const firstLine = String(text || '')
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .find(Boolean) || '';

  const semester = parseSemesterFromHeader(firstLine);
  const courseCodeMatch = firstLine.match(/\b([A-Z]{2,}[A-Z0-9]{2,})\b/);
  const teacherMatch = firstLine.match(/教師[：:]\s*([^\s]+)/);
  let courseName = '';
  if (courseCodeMatch) {
    const afterCode = firstLine.slice(courseCodeMatch.index + courseCodeMatch[0].length);
    courseName = cleanText(afterCode.replace(/修課學生名單.*$/, '').replace(/教師[：:].*$/, ''));
  }

  return {
    semester,
    courseCode: courseCodeMatch ? courseCodeMatch[1] : null,
    courseName: courseName || null,
    teacherName: teacherMatch ? cleanText(teacherMatch[1]) : null,
    headerLine: firstLine,
  };
}

function extractGrade(chunk) {
  const compact = normalizeCompact(chunk);
  const joined = compact.match(/([一二三四五六])年級/);
  if (joined) return GRADE_MAP[joined[1]] || null;
  const split = compact.match(/([一二三四五六])年級?/) || compact.match(/([一二三四五六])年?級/);
  if (split) return GRADE_MAP[split[1]] || null;
  // 四\n年\n級
  const multiline = String(chunk).match(/([一二三四五六])\s*年\s*級/);
  if (multiline) return GRADE_MAP[multiline[1]] || null;
  return null;
}

function extractEmail(chunk) {
  const m = String(chunk).match(EMAIL_RE);
  return m ? m[0] : null;
}

function extractGenderIndex(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const t = normalizeCompact(lines[i]);
    if (t === '男' || t === '女') return i;
  }
  return -1;
}

function isLikelyFooterOrNoise(line) {
  const t = cleanText(line);
  if (!t) return true;
  if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(t)) return true;
  if (/selcrs\.nsysu\.edu\.tw/i.test(t)) return true;
  if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(t) && /查詢/.test(t)) return true;
  if (/^\d+\/\d+$/.test(t)) return true;
  return false;
}

/**
 * 從單一學生區塊抽出姓名與系所。
 * 規則：性別前為姓名+系所；姓名優先取開頭中文（可含空白二字名）或拉丁姓名。
 */
function extractNameAndDepartment(chunk) {
  const lines = String(chunk)
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter((line) => line && !isLikelyFooterOrNoise(line));

  const genderIdx = extractGenderIndex(lines);
  const beforeGender = genderIdx >= 0 ? lines.slice(0, genderIdx) : lines;

  // 去掉 email / 班別殘片
  const filtered = beforeGender.filter((line) => {
    if (EMAIL_RE.test(line)) return false;
    const c = normalizeCompact(line);
    if (/^(甲|乙|丙|丁)?班$/.test(c)) return false;
    if (c === '全英班' || c === '全英') return false;
    return true;
  });

  if (!filtered.length) {
    return { studentName: null, department: null };
  }

  // 外籍：開頭為拉丁文
  if (/^[A-Za-z]/.test(filtered[0])) {
    const nameParts = [];
    let i = 0;
    while (i < filtered.length && /^[A-Za-z .'-]+$/.test(filtered[i])) {
      nameParts.push(filtered[i]);
      i += 1;
    }
    return {
      studentName: cleanText(nameParts.join(' ')),
      department: stripGenderAndGradeFromDepartment(filtered.slice(i).join('')),
    };
  }

  // 本籍：第一段為姓名。二字名可能是「朱 希」同一行，或「林」「勻」拆行較少見。
  const first = filtered[0];
  const firstCompact = normalizeCompact(first);
  let studentName = first;
  let deptStart = 1;

  // 「劉紫若 化學」同行：姓名後接空白再接系所開頭
  const inline = first.match(/^([\u4e00-\u9fff]{2,4}(?:\s+[\u4e00-\u9fff])?)\s+(.+)$/);
  if (inline) {
    studentName = cleanText(inline[1].replace(/\s+/g, ''));
    const restDept = [inline[2], ...filtered.slice(1)];
    return {
      studentName,
      department: stripGenderAndGradeFromDepartment(restDept.join('')),
    };
  }

  // 「朱 希」→ 去空白
  if (/^[\u4e00-\u9fff]\s+[\u4e00-\u9fff]$/.test(first) || /^[\u4e00-\u9fff]{2,4}$/.test(firstCompact)) {
    studentName = firstCompact;
    deptStart = 1;
  }

  const department = stripGenderAndGradeFromDepartment(filtered.slice(deptStart).join(''));
  return { studentName, department };
}

function parseStudentChunk(seq, academicYear, term, studentId, chunk) {
  const email = extractEmail(chunk);
  const grade = extractGrade(chunk);
  const { studentName, department } = extractNameAndDepartment(chunk);
  return {
    seq: Number(seq),
    academicYear: String(academicYear),
    term: String(term),
    studentId: String(studentId).toUpperCase(),
    studentName,
    department,
    grade,
    email,
  };
}

function parseStudentsFromText(text) {
  const source = String(text || '');
  const matches = [...source.matchAll(ROW_START_RE)];
  const students = [];
  const warnings = [];

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const start = match.index + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const chunk = source.slice(start, end);
    const student = parseStudentChunk(match[1], match[2], match[3], match[4], chunk);
    if (!student.studentName) {
      warnings.push(`序號 ${student.seq}（${student.studentId}）：無法解析姓名`);
    }
    students.push(student);
  }

  // 序號連續性檢查
  for (let i = 0; i < students.length; i += 1) {
    if (students[i].seq !== i + 1) {
      warnings.push(`序號不連續：預期 ${i + 1}，實際 ${students[i].seq}（${students[i].studentId}）`);
      break;
    }
  }

  return { students, warnings };
}

async function extractPdfText(fileBuffer) {
  const PDFParse = getPdfParseCtor();
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const result = await parser.getText();
    return {
      text: String(result?.text || ''),
      pageCount: Number(result?.total || 0),
    };
  } finally {
    if (typeof parser.destroy === 'function') {
      await parser.destroy().catch(() => {});
    }
  }
}

/**
 * 解析選課系統（selcrs）修課名單 PDF。
 * @param {Buffer} fileBuffer
 * @returns {Promise<object>}
 */
async function parseClassRosterPdf(fileBuffer) {
  if (!Buffer.isBuffer(fileBuffer) || !fileBuffer.length) {
    const err = new Error('PDF 檔案為空');
    err.code = 'PDF_EMPTY';
    throw err;
  }

  const { text, pageCount } = await extractPdfText(fileBuffer);
  if (!cleanText(text)) {
    const err = new Error('無法從 PDF 抽出文字（可能是掃描檔）。請改用 Excel 匯入，或提供可選取文字的 PDF。');
    err.code = 'PDF_NO_TEXT';
    throw err;
  }

  const course = parseCourseMeta(text);
  const { students, warnings } = parseStudentsFromText(text);

  if (!students.length) {
    const err = new Error('PDF 中找不到學生列（需含學號格式）。請確認為選課系統修課名單。');
    err.code = 'PDF_NO_STUDENTS';
    throw err;
  }

  const missingName = students.filter((s) => !s.studentName).length;
  if (missingName > Math.max(2, Math.floor(students.length * 0.2))) {
    const err = new Error(`姓名解析失敗過多（${missingName}/${students.length}）。請改用 Excel 匯入，或檢查 PDF 格式。`);
    err.code = 'PDF_PARSE_UNRELIABLE';
    throw err;
  }

  return {
    source: 'selcrs_pdf',
    pageCount,
    course: {
      semester: course.semester,
      courseCode: course.courseCode,
      courseName: course.courseName,
      teacherName: course.teacherName,
    },
    students: students.map((s) => ({
      studentId: s.studentId,
      studentName: s.studentName,
      department: s.department,
      grade: s.grade,
      email: s.email,
      seq: s.seq,
    })),
    warnings,
    stats: {
      studentCount: students.length,
      withDepartment: students.filter((s) => s.department).length,
      withGrade: students.filter((s) => s.grade != null).length,
      withEmail: students.filter((s) => s.email).length,
      missingName,
    },
  };
}

function buildClassDisplayName(courseName, courseCode) {
  const name = cleanText(courseName);
  const code = cleanText(courseCode);
  if (name && code) return `${name} ${code}`.slice(0, 100);
  return (name || code || '').slice(0, 100);
}

module.exports = {
  parseClassRosterPdf,
  parseCourseMeta,
  parseStudentsFromText,
  buildClassDisplayName,
  STUDENT_ID_RE,
};
