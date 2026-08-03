import * as XLSX from 'xlsx';

function downloadWorkbook(workbook, filename) {
  XLSX.writeFile(workbook, filename);
}

/**
 * 培力英檢成績匯入範例（表頭與 bestepImportService FIELD_MAPPINGS.scores 對齊）
 */
export function downloadBestepScoreTemplate() {
  const wb = XLSX.utils.book_new();
  const header = [[
    '學號',
    '姓名',
    '聽力分數',
    '閱讀分數',
    '口說分數',
    '寫作分數',
    '聽力等級',
    '閱讀等級',
    '口說等級',
    '寫作等級',
    '總分',
  ]];
  const rows = [
    ['B123456789', '王小明', 128, 112, 280, 320, 'B2+', 'B2', 'B2', 'C1', 840],
    ['B123456790', '陳小華', 95, 88, 0, 250, 'B1', 'B1', 'A2', 'B2', 433],
    ['B123456791', '李大文', 120, 115, 300, 310, 'B2', 'B2', 'B2', 'B2', 845],
  ];
  const sheetData = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  XLSX.utils.book_append_sheet(wb, sheetData, '成績範例');

  const guideRows = [
    ['填寫說明'],
    ['1) 學期於匯入頁面選擇，不要寫在 Excel'],
    ['2) 僅「報名成功」的學號會寫入；請先在培力英檢管理完成審核'],
    ['3) 分數範圍：聽力/閱讀 0–140；口說/寫作 0–360（0 分為有效分數）'],
    ['4) CEFR 等級：A1、A2、B1、B2、C1、C2；B2+ 會正規化為 B2'],
    ['5) 總分可省略；四科分數齊全時系統自動加總'],
    ['6) 若填寫總分，須與四科加總相差不超過 1 分'],
    ['7) 系統會自動計算整體等級（取最低項）與達標狀態（四科皆 ≥ B2）'],
    [''],
    ['官方成績單表頭亦支援（擇一即可）：'],
    ['  考生姓名、聽力總分、聽力CEFR級數、閱讀總分、閱讀CEFR級數'],
    ['  口說總分、口說CEFR級數、寫作總分、寫作CEFR級數'],
  ];
  const guide = XLSX.utils.aoa_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(wb, guide, '填寫說明');

  downloadWorkbook(wb, '培力英檢成績匯入範例.xlsx');
}

/**
 * 培力英檢出席匯入範例（表頭與 bestepImportService FIELD_MAPPINGS.attendance 對齊）
 */
export function downloadBestepAttendanceTemplate() {
  const wb = XLSX.utils.book_new();
  const header = [[
    '學號',
    '姓名',
    '報考項目',
    'L出缺席',
    'R出缺席',
    'S出缺席',
    'W出缺席',
    '缺席原因',
  ]];
  const rows = [
    ['B123456789', '王小明', 'LR', '出席', '出席', '', '', ''],
    ['B123456790', '陳小華', 'LR', '缺席', '出席', '', '', '遲到'],
    ['B123456791', '李大文', 'SW', '', '', '出席', '缺席', ''],
    ['B123456792', '林小美', 'LR,S,W', '出席', '出席', '出席', '缺席', ''],
  ];
  const sheetData = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  XLSX.utils.book_append_sheet(wb, sheetData, '出席範例');

  const guideRows = [
    ['填寫說明'],
    ['1) 學期、考試日期於匯入頁面選擇，不要寫在 Excel'],
    ['2) 建議使用官方出缺席表格式（本範例工作表）'],
    ['3) 報考項目範例：LR、SW、L、R、S、W、LR,S,W（多項以逗號分隔）'],
    ['4) L/R/S/W 出缺席欄位填「出席」或「缺席」；未報考該項可留空（視為出席）'],
    ['5) 僅「報名成功」的學號會寫入'],
    ['6) 若 Excel 含報考項目，匯入頁的考試類型僅作輔助；以每列報考項目為準'],
    [''],
    ['簡易格式亦支援（每場 LR 或 SW 分別匯入時可用）：'],
    ['  學號、姓名、出席狀態（出席、缺席、是、否）'],
  ];
  const guide = XLSX.utils.aoa_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(wb, guide, '填寫說明');

  downloadWorkbook(wb, '培力英檢出席匯入範例.xlsx');
}
