// services/bestepClassExportExcel.js
const ExcelJS = require('exceljs');

const TABLE_HEADERS = [
  '學號',
  '姓名',
  '系所',
  '年級',
  '是否有報考',
  '抵免',
  '計次',
  '培力聽力出席',
  '培力閱讀出席',
  '培力口說出席',
  '培力寫作出席'
];

const FILL_STUDENT_ID = 'FFFFE6E6';
const FILL_ATTENDANCE_COL = 'FFFFFFCC';
const FILL_ABSENT = 'FFDAEEF3';
const FILL_TABLE_HEADER = 'FFE0E0E0';

const TABLE_HEADER_ROW = 5;
const DATA_START_ROW = 6;

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00%';
  return `${num.toFixed(2)}%`;
}

function thinBorder() {
  return {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
}

function setLabelValue(worksheet, row, col, label, value) {
  worksheet.getCell(row, col).value = label;
  worksheet.getCell(row, col + 1).value = value;
}

/**
 * 將 buildClassBestepExportData 的結果寫入 Excel 工作表（含上方摘要與列表格式）
 */
function writeClassBestepExportWorkbook(exportData) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('BESTEP資料');

  const classInfo = exportData.classInfo || {};
  const summary = exportData.summary || {};
  const rows = exportData.rows || [];

  worksheet.getCell(1, 1).value = '課程名稱:';
  worksheet.getCell(1, 2).value = classInfo.className || '';

  worksheet.getCell(2, 1).value = '授課教師:';
  worksheet.getCell(2, 2).value = classInfo.teacherName || '';

  setLabelValue(worksheet, 3, 1, '報考率:', formatPercent(summary.registrationRate));
  setLabelValue(worksheet, 3, 4, '修課人數:', summary.enrolledCount ?? 0);
  setLabelValue(worksheet, 3, 7, '報名人數:', summary.registeredCount ?? 0);
  setLabelValue(worksheet, 3, 10, '全程到考人數:', summary.fullAttendanceCount ?? 0);

  setLabelValue(worksheet, 4, 1, '到考率:', formatPercent(summary.attendanceRate));
  setLabelValue(worksheet, 4, 4, '報考人次:', summary.registrationSlots ?? 0);

  const headerRow = worksheet.getRow(TABLE_HEADER_ROW);
  TABLE_HEADERS.forEach((title, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = title;
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: FILL_TABLE_HEADER }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder();
  });

  rows.forEach((row) => {
    worksheet.addRow([
      row.studentId,
      row.studentName,
      row.department,
      row.grade,
      row.registeredExamType,
      row.exemptionCode,
      row.examCount,
      row.listeningAttendance,
      row.readingAttendance,
      row.speakingAttendance,
      row.writingAttendance
    ]);
  });

  const lastRow = worksheet.lastRow ? worksheet.lastRow.number : TABLE_HEADER_ROW;
  const columnWidths = [15, 12, 22, 16, 14, 10, 8, 14, 14, 14, 14];
  columnWidths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  for (let rowNum = TABLE_HEADER_ROW; rowNum <= lastRow; rowNum += 1) {
    for (let col = 1; col <= TABLE_HEADERS.length; col += 1) {
      const cell = worksheet.getCell(rowNum, col);
      cell.border = thinBorder();
      if (rowNum >= DATA_START_ROW) {
        cell.alignment = {
          vertical: 'middle',
          horizontal: col === 3 ? 'left' : 'center'
        };
      }
    }
  }

  for (let rowNum = DATA_START_ROW; rowNum <= lastRow; rowNum += 1) {
    const studentCell = worksheet.getCell(rowNum, 1);
    studentCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: FILL_STUDENT_ID }
    };

    for (let col = 8; col <= 11; col += 1) {
      const cell = worksheet.getCell(rowNum, col);
      const isAbsent = cell.value === '缺席';
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isAbsent ? FILL_ABSENT : FILL_ATTENDANCE_COL }
      };
    }
  }

  return workbook;
}

module.exports = {
  writeClassBestepExportWorkbook
};
