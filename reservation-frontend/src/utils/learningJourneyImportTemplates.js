import * as XLSX from 'xlsx';

function downloadWorkbook(workbook, filename) {
  XLSX.writeFile(workbook, filename);
}

export function downloadEnrollmentTemplate() {
  const wb = XLSX.utils.book_new();
  const header = [['系所', '學院', '班別', '年級', '學號', '姓名']];
  const rows = [
    ['外文系', '文學院', 'A班', '1', 'B11201001', '王小明'],
    ['中文系', '文學院', 'B班', '2', 'B11102002', '陳小華'],
    ['資工系', '電資學院', 'A班', '3', 'B11003003', '李大文']
  ];
  const sheetData = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  XLSX.utils.book_append_sheet(wb, sheetData, '名冊範例');

  const guideRows = [
    ['填寫說明'],
    ['1) semesterId 由系統匯入時指定，不要寫在 Excel'],
    ['2) 請保留欄位順序 A~F'],
    ['3) 學號(E)與姓名(F)為必要欄位']
  ];
  const guide = XLSX.utils.aoa_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(wb, guide, '填寫說明');

  downloadWorkbook(wb, '名冊匯入範例.xlsx');
}

export function downloadExamTemplate() {
  const wb = XLSX.utils.book_new();
  const header = [[
    '系所', '學院', '班別', '年級', '學號', '姓名',
    '英文檢定類別', '檢定時間',
    '聽力成績', '聽力成績(CEFR)',
    '閱讀成績', '閱讀成績(CEFR)',
    '口說成績', '口說成績(CEFR)',
    '寫作成績', '寫作成績(CEFR)'
  ]];
  const rows = [
    ['外文系', '文學院', 'A班', '1', 'B11201001', '王小明', '全民英檢(GEPT)', '2025-01-15', 85, 'B2', 82, 'B2', 78, 'B1', 80, 'B2'],
    ['資工系', '電資學院', 'A班', '3', 'B11003003', '李大文', '多益聽力與閱讀測驗(TOEIC)', '2025-03-22', 430, 'B2', 410, 'B2', '', '', '', ''],
    ['中文系', '文學院', 'B班', '2', 'B11102002', '陳小華', '托福網路化測驗(TOEFL-iBT)', '2025-06-01', 22, 'B2', 24, 'B2', 21, 'B2', 23, 'B2']
  ];
  const sheetData = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  XLSX.utils.book_append_sheet(wb, sheetData, '考試範例');

  const guideRows = [
    ['填寫說明'],
    ['1) semesterId 由系統匯入時指定，不要寫在 Excel'],
    ['2) CEFR 只允許 A1、A2、B1、B2、C1、C2'],
    ['3) 考試類別支援：'],
    ['   - 全民英檢(GEPT)'],
    ['   - 多益聽力與閱讀測驗(TOEIC)'],
    ['   - 托福紙筆測驗(TOEFL ITP)'],
    ['   - 托福網路化測驗(TOEFL-iBT)'],
    ['   - 雅思(IELTS)'],
    ['   - 培力英檢(BESTEP)'],
    ['   - 劍橋英檢(Cambridge)']
  ];
  const guide = XLSX.utils.aoa_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(wb, guide, '填寫說明');

  downloadWorkbook(wb, '考試成績匯入範例.xlsx');
}

export function downloadBaselineTemplate() {
  const wb = XLSX.utils.book_new();
  const header = [['學號', '姓名', '入學學年', '學測英文成績', '測驗年度(選填)']];
  const rows = [
    ['B11201001', '王小明', 2023, 12, 2023],
    ['B11102002', '陳小華', 2022, 11, 2022],
    ['B11003003', '李大文', 2021, 13, 2021],
  ];
  const sheetData = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  XLSX.utils.book_append_sheet(wb, sheetData, '學測baseline範例');

  const guideRows = [
    ['填寫說明'],
    ['1) 不需指定學期；匯入後寫入學習歷程 baseline 事件'],
    ['2) 欄位順序：A 學號 | B 姓名 | C 入學學年 | D 學測英文 | E 測驗年度(選填)'],
    ['3) 學號與學測英文成績為必要；0 分會進 quarantine'],
    ['4) 若學號已存在且姓名不符，該列會進 quarantine'],
  ];
  const guide = XLSX.utils.aoa_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(wb, guide, '填寫說明');

  downloadWorkbook(wb, '學測baseline匯入範例.xlsx');
}

export function downloadCourseTemplate() {
  const wb = XLSX.utils.book_new();
  const header = [[
    '學期', '課號', '課程名稱', '開課單位代碼', '開課單位', '授課教師', '學分', '課程類型',
    '學號', '姓名', '修課狀態', '成績', '是否通過', '學習成果',
  ]];
  const rows = [
    ['114-2', 'GESP207', '實用醫療英語（中高級）', 'FL', '外文系', '王老師', 2, 'GEP',
      'B141010003', '王嘉妤', '修課中', '', '進行中', '聽力,口說'],
    ['114-2', 'ENGL101', '基礎英文', 'FL', '外文系', '李老師', 2, '必修',
      'B11201001', '王小明', '修課中', '', '進行中', ''],
  ];
  const sheetData = XLSX.utils.aoa_to_sheet([...header, ...rows]);
  XLSX.utils.book_append_sheet(wb, sheetData, '修課範例');

  const guideRows = [
    ['填寫說明'],
    ['1) 每列代表一筆「學生 × 課程」選課紀錄'],
    ['2) 必要欄位：學期、課號、課程名稱、學號'],
    ['3) 修課狀態可填：修課中、已修、退選；是否通過可填：通過、未通過、進行中'],
    ['4) 學習成果可填多個，以逗號分隔（選填）'],
    ['5) 匯入成功後會自動重建相關學生的 analytic 衍生層（時間軸修課泳道）'],
  ];
  const guide = XLSX.utils.aoa_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(wb, guide, '填寫說明');

  downloadWorkbook(wb, '修課紀錄匯入範例.xlsx');
}
