// services/reportService.js
// Phase 4：報表匯出正式化（Excel 多 sheet、檔名規則、高風險名單）
// PDF 仍依 pdfkit 是否存在決定；未安裝時拋錯由 controller 轉 501 + PDF_EXPORT_UNAVAILABLE

const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const classEvaluationService = require('./classEvaluationService');
const teacherEvaluationService = require('./teacherEvaluationService');
const analyticsService = require('./analyticsService');
const riskDetectionService = require('./riskDetectionService');
const { ClassMembership } = require('../models');

/** 單次匯出筆數上限（避免長時間占用連線；非同步 job 見 export spec P5） */
const MAX_HIGH_RISK_EXPORT_ROWS = 8000;

const POPULATION_CLASS_MEMBERSHIP =
  '本學期 class_memberships DISTINCT 學生（班級名冊口徑，非 LJ active roster）';

function tryRequirePdfKit() {
  try {
    return require('pdfkit');
  } catch (e) {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function formatRiskReasonsForCell(reasons) {
  if (!reasons || !reasons.length) return '—';
  return reasons
    .map((x) => `${x.label || x.key}（觀測值 ${x.value}；影響分數 +${x.contribution}）`)
    .join('；');
}

async function enrichHighRiskRowsFromMemberships(semester, risks) {
  const sids = [...new Set(risks.map((r) => String(r.studentId || '').trim()).filter(Boolean))];
  if (sids.length === 0) {
    return risks.map((r) => ({ ...r, exportStudentName: '—', exportDepartment: '—', exportClass: '—' }));
  }
  const rows = await ClassMembership.findAll({
    where: { semester, studentId: { [Op.in]: sids } },
    attributes: ['studentId', 'studentName', 'department', 'classId'],
    raw: true,
  });
  const bySid = {};
  for (const row of rows) {
    const k = String(row.studentId || '').trim().toUpperCase();
    if (!bySid[k]) bySid[k] = { names: [], departments: [], classIds: [] };
    if (row.studentName) bySid[k].names.push(String(row.studentName).trim());
    if (row.department) bySid[k].departments.push(String(row.department).trim());
    if (row.classId != null) bySid[k].classIds.push(String(row.classId));
  }
  return risks.map((r) => {
    const k = String(r.studentId || '').trim().toUpperCase();
    const m = bySid[k];
    const exportStudentName = m?.names?.[0] || '—';
    const exportDepartment = m?.departments?.length ? [...new Set(m.departments)].join('；') : '—';
    const exportClass = m?.classIds?.length ? [...new Set(m.classIds)].join('；') : '—';
    return { ...r, exportStudentName, exportDepartment, exportClass };
  });
}

async function buildClassReportData(classId, semester) {
  const classEval = await classEvaluationService.getClassEvaluation(classId, semester);
  const studentIds = (classEval.bestepOverview?.students || []).map((s) => s.studentId).filter(Boolean);
  const highRisks = await riskDetectionService.getRisksForStudents(studentIds, semester, { onlyHigh: true });

  return {
    scope: 'class',
    classId: Number(classId),
    semester,
    className: classEval.className,
    summary: classEval,
    highRisks,
    reportGeneratedAt: nowIso(),
  };
}

async function buildTeacherReportData(teacherId, semester) {
  const dashboard = await teacherEvaluationService.getTeacherDashboard(teacherId, semester);
  return {
    scope: 'teacher',
    teacherId: Number(teacherId),
    semester,
    dashboard,
    reportGeneratedAt: nowIso(),
  };
}

/** 營運總覽報表資料：活動預約營運 + 班級行政追蹤，不混入正式學習成效 KPI。 */
async function buildOverviewReportData(semester) {
  const overview = await analyticsService.getAdminOverview(semester);
  let reservationOverview = null;
  try {
    reservationOverview = await analyticsService.getReservationOverview(semester);
  } catch (_) {
    reservationOverview = null;
  }
  return {
    scope: 'overview',
    semester,
    overview,
    reservationOverview,
    reportGeneratedAt: nowIso(),
  };
}

async function buildHighRiskReportData(semester) {
  const raw = await riskDetectionService.getHighRisksForSemester(semester);
  if (raw.length > MAX_HIGH_RISK_EXPORT_ROWS) {
    const err = new Error(
      `EXPORT_TOO_LARGE: 高風險名單超過 ${MAX_HIGH_RISK_EXPORT_ROWS} 筆，請洽管理員規劃非同步匯出（P6）。`
    );
    err.code = 'EXPORT_TOO_LARGE';
    throw err;
  }
  const risks = await enrichHighRiskRowsFromMemberships(semester, raw);
  return {
    scope: 'high-risk',
    semester,
    risks,
    reportGeneratedAt: nowIso(),
  };
}

function applyHeaderStyle(row) {
  row.font = { bold: true };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7EEF8' },
  };
}

/** 活動營運總覽：多 sheet 正式欄位 */
async function generateOverviewExcelWorkbook(data) {
  const wb = new ExcelJS.Workbook();
  const { semester, overview, reservationOverview, reportGeneratedAt } = data;

  // --- Sheet 1 報表摘要 ---
  const ws1 = wb.addWorksheet('報表摘要', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws1.columns = [
    { header: '欄位', key: 'k', width: 28 },
    { header: '內容', key: 'v', width: 72 },
  ];
  const h1 = ws1.addRow({ k: '欄位', v: '內容' });
  applyHeaderStyle(h1);
  const s1 = [
    ['報表名稱', 'EEARS 活動營運總覽'],
    ['學期', semester],
    ['報表產生時間（generatedAt）', reportGeneratedAt],
    [
      '說明',
      '本報表只呈現活動營運與行政追蹤資料。正式學習成果、B2 KPI、學生能力軌跡請使用「學習成效分析」。',
    ],
  ];
  s1.forEach(([k, v]) => ws1.addRow({ k, v }));

  // --- Sheet 2 活動預約營運 ---
  const ws2 = wb.addWorksheet('活動預約營運', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws2.columns = [
    { header: '指標名稱', key: 'n', width: 26 },
    { header: '數值', key: 'val', width: 14 },
    { header: '單位', key: 'unit', width: 10 },
    { header: '母體', key: 'pop', width: 36 },
    { header: '指標定義', key: 'def', width: 52 },
    { header: '是否學習成效', key: 'can', width: 14 },
    { header: '備註', key: 'note', width: 36 },
  ];
  const hdr2 = ws2.addRow({
    n: '指標名稱',
    val: '數值',
    unit: '單位',
    pop: '母體',
    def: '指標定義',
    can: '是否學習成效',
    note: '備註',
  });
  applyHeaderStyle(hdr2);
  if (!reservationOverview) {
    ws2.addRow({
      n: '（無法載入）',
      val: '—',
      unit: '—',
      pop: 'reservations / events',
      def: '活動預約與名額資料',
      can: '—',
      note: 'getReservationOverview 失敗或學期不支援',
    });
  } else {
    const ro = reservationOverview;
    ws2.addRow({
      n: '總預約數',
      val: ro.totalReservations,
      unit: '筆',
      pop: '本學期活動日期區間內之 reservations',
      def: '活動預約筆數',
      can: '否',
      note: '',
    });
    ws2.addRow({
      n: '預約率',
      val: ro.bookingRate,
      unit: '%',
      pop: '本學期活動日期區間內 events.maxCapacity 加總',
      def: '總預約數 ÷ 該區間活動名額加總',
      can: '否',
      note: ro.totalEventCapacity != null ? `名額加總（供查核）：${ro.totalEventCapacity}` : '',
    });
    ws2.addRow({
      n: '簽到出席率（預約）',
      val: ro.attendanceRate,
      unit: '%',
      pop: '同上',
      def: '已簽到 ÷ 總預約',
      can: '否',
      note: '',
    });
    ws2.addRow({
      n: '違規率（預約）',
      val: ro.violationRate,
      unit: '%',
      pop: '同上',
      def: '已登記違規 ÷ 總預約',
      can: '否',
      note: '',
    });
  }

  // --- Sheet 3 班級行政追蹤 ---
  const ws3 = wb.addWorksheet('班級行政追蹤', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws3.columns = [
    { header: '指標名稱', key: 'n', width: 28 },
    { header: '數值', key: 'val', width: 14 },
    { header: '單位', key: 'unit', width: 10 },
    { header: '母體', key: 'pop', width: 32 },
    { header: '指標定義', key: 'def', width: 48 },
    { header: '備註', key: 'note', width: 40 },
  ];
  const hdr3 = ws3.addRow({
    n: '指標名稱',
    val: '數值',
    unit: '單位',
    pop: '母體',
    def: '指標定義',
    note: '備註',
  });
  applyHeaderStyle(hdr3);
  const o = overview;
  const adminRows = [
    ['班級名冊 Distinct 學生數', o.totalStudents, '人', POPULATION_CLASS_MEMBERSHIP, 'class_memberships 該學期', ''],
    ['參與率（班級 KPI）', o.participationRate, '%', POPULATION_CLASS_MEMBERSHIP, 'kpiService 活動簽到參與', ''],
    ['平均簽到次數', o.avgParticipationCount, '次', POPULATION_CLASS_MEMBERSHIP, '', ''],
    ['問卷完成率', o.surveyCompletionRate, '%', POPULATION_CLASS_MEMBERSHIP, '', ''],
    ['違規率（行政 KPI）', o.violationRate, '%', POPULATION_CLASS_MEMBERSHIP, 'kpiService 違規統計', ''],
    [
      '班級名冊高風險人數',
      o.highRiskStudentCount,
      '人',
      POPULATION_CLASS_MEMBERSHIP,
      'riskLevel=high 之學生人數',
      '行政追蹤用途；正式學習成果請看學習成效分析',
    ],
  ];
  adminRows.forEach((r) => ws3.addRow({ n: r[0], val: r[1], unit: r[2], pop: r[3], def: r[4], note: r[5] || '' }));

  return wb.xlsx.writeBuffer();
}

async function generateHighRiskExcelWorkbook(data) {
  const wb = new ExcelJS.Workbook();
  const { semester, risks, reportGeneratedAt } = data;

  const ws0 = wb.addWorksheet('報表摘要', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws0.columns = [
    { header: '欄位', key: 'k', width: 28 },
    { header: '內容', key: 'v', width: 72 },
  ];
  const sumRows = [
    ['報表名稱', 'EEARS 高風險學生名單'],
    ['學期', semester],
    ['名單筆數', risks.length],
    ['母體說明', `${POPULATION_CLASS_MEMBERSHIP}；僅匯出 riskLevel=high`],
    ['報表產生時間（generatedAt）', reportGeneratedAt],
    [
      '備註',
      '原因欄位為行政中文摘要；不含中／低風險。若名單為 0，仍產出本報表並於「高風險名單」工作表說明。',
    ],
  ];
  const h0 = ws0.addRow({ k: '欄位', v: '內容' });
  applyHeaderStyle(h0);
  sumRows.forEach(([k, v]) => ws0.addRow({ k, v }));

  const ws = wb.addWorksheet('高風險名單', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: '學期', key: 'semester', width: 10 },
    { header: '學號', key: 'studentId', width: 16 },
    { header: '姓名', key: 'studentName', width: 14 },
    { header: '系所', key: 'department', width: 22 },
    { header: '班級', key: 'classLabel', width: 14 },
    { header: '風險等級', key: 'riskLevel', width: 10 },
    { header: '風險分數', key: 'riskScore', width: 10 },
    { header: '風險原因（行政摘要）', key: 'reasons', width: 56 },
    { header: '母體說明', key: 'population', width: 44 },
    { header: '報表產生時間', key: 'generatedAt', width: 24 },
  ];
  const hdr = ws.addRow({
    semester: '學期',
    studentId: '學號',
    studentName: '姓名',
    department: '系所',
    classLabel: '班級',
    riskLevel: '風險等級',
    riskScore: '風險分數',
    reasons: '風險原因（行政摘要）',
    population: '母體說明',
    generatedAt: '報表產生時間',
  });
  applyHeaderStyle(hdr);

  if (!risks.length) {
    ws.addRow({
      semester,
      studentId: '—',
      studentName: '—',
      department: '—',
      classLabel: '—',
      riskLevel: '—',
      riskScore: '—',
      reasons: '本學期目前沒有高風險學生',
      population: `${POPULATION_CLASS_MEMBERSHIP}；僅 high`,
      generatedAt: reportGeneratedAt,
    });
  } else {
    const levelZh = { high: '高', medium: '中', low: '低' };
    for (const r of risks) {
      ws.addRow({
        semester,
        studentId: r.studentId,
        studentName: r.exportStudentName || '—',
        department: r.exportDepartment || '—',
        classLabel: r.exportClass || '—',
        riskLevel: levelZh[r.riskLevel] || r.riskLevel,
        riskScore: r.riskScore,
        reasons: formatRiskReasonsForCell(r.reasons),
        population: `${POPULATION_CLASS_MEMBERSHIP}；僅 high`,
        generatedAt: reportGeneratedAt,
      });
    }
  }

  return wb.xlsx.writeBuffer();
}

function addKeyValueSheet(wb, sheetName, titleRows) {
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: '欄位名稱', key: 'label', width: 40 },
    { header: '值', key: 'value', width: 56 },
    { header: '備註', key: 'note', width: 40 },
  ];
  const h = ws.addRow({ label: '欄位名稱', value: '值', note: '備註' });
  applyHeaderStyle(h);
  titleRows.forEach((r) => ws.addRow(r));
}

async function generateClassExcelWorkbook(data) {
  const wb = new ExcelJS.Workbook();
  const { classId, semester, className, summary, highRisks, reportGeneratedAt } = data;

  addKeyValueSheet(wb, '班級報表摘要', [
    { label: '報表名稱', value: 'EEARS 單一班級報表', note: '' },
    { label: '班級 ID', value: classId, note: '' },
    { label: '班級名稱', value: className || '', note: '' },
    { label: '學期', value: semester, note: '' },
    { label: '報表產生時間', value: reportGeneratedAt, note: '伺服器匯出時間' },
  ]);

  const ws = wb.addWorksheet('班級KPI', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: '指標名稱', key: 'label', width: 36 },
    { header: '數值', key: 'value', width: 16 },
    { header: '備註', key: 'note', width: 48 },
  ];
  const hr = ws.addRow({ label: '指標名稱', value: '數值', note: '備註' });
  applyHeaderStyle(hr);
  const rows = [
    ['參與率（班級 KPI）', summary.participation?.participationRate, 'class_memberships 母體'],
    ['BESTEP 通過率', summary.bestep?.bestepPassRate, ''],
    ['抵免核准率', summary.bestep?.exemptionApprovedRate, ''],
    ['問卷完成率（估計）', summary.survey?.estimatedCompletionRate, ''],
    ['違規率', summary.violations?.violationRate, ''],
    ['班級名冊高風險人數', highRisks.length, '僅計 high；與 LJ 名冊高風險不同母體'],
  ];
  rows.forEach(([label, value, note]) => ws.addRow({ label, value, note }));

  return wb.xlsx.writeBuffer();
}

async function generateTeacherExcelWorkbook(data) {
  const wb = new ExcelJS.Workbook();
  const { teacherId, semester, dashboard, reportGeneratedAt } = data;
  const s = dashboard.summary || {};

  addKeyValueSheet(wb, '教師報表摘要', [
    { label: '報表名稱', value: 'EEARS 教學儀表板報表', note: '' },
    { label: '教師 ID', value: teacherId, note: '' },
    { label: '學期', value: semester, note: '' },
    { label: '報表產生時間', value: reportGeneratedAt, note: '' },
  ]);

  const ws = wb.addWorksheet('教師儀表板KPI', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: '指標名稱', key: 'label', width: 36 },
    { header: '數值', key: 'value', width: 16 },
    { header: '備註', key: 'note', width: 52 },
  ];
  const hr = ws.addRow({ label: '指標名稱', value: '數值', note: '備註' });
  applyHeaderStyle(hr);
  const rows = [
    ['負責班級數', s.totalClasses, ''],
    ['平均參與率', s.avgParticipationRate, '班級名冊 KPI 平均'],
    ['平均通過率', s.avgPassRate, 'BESTEP 等彙整'],
    ['班級名冊高風險人數（加總）', s.totalRiskStudents, '各負責班級 high 人數加總；非 LJ 名冊母體'],
  ];
  rows.forEach(([label, value, note]) => ws.addRow({ label, value, note }));

  return wb.xlsx.writeBuffer();
}

async function generateExcelReport(data) {
  if (data.scope === 'overview') return generateOverviewExcelWorkbook(data);
  if (data.scope === 'high-risk') return generateHighRiskExcelWorkbook(data);
  if (data.scope === 'class') return generateClassExcelWorkbook(data);
  if (data.scope === 'teacher') return generateTeacherExcelWorkbook(data);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');
  ws.addRow({ a: 'unknown scope', b: data.scope });
  return wb.xlsx.writeBuffer();
}

async function generatePdfReport(data) {
  const PDFDocument = tryRequirePdfKit();
  if (!PDFDocument) {
    throw new Error('PDF engine not installed (pdfkit)');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('EEARS Decision Support Report');
    doc.moveDown();
    doc.fontSize(11).text(`Scope: ${data.scope}`);

    if (data.scope === 'class') {
      doc.text(`Class: ${data.className || data.classId}`);
      doc.text(`Semester: ${data.semester}`);
      doc.text(`ParticipationRate: ${data.summary.participation?.participationRate}`);
      doc.text(`BestepPassRate: ${data.summary.bestep?.bestepPassRate}`);
      doc.text(`ExemptionApprovedRate: ${data.summary.bestep?.exemptionApprovedRate}`);
      doc.text(`班級名冊高風險人數: ${data.highRisks.length}`);
    } else if (data.scope === 'teacher') {
      doc.text(`TeacherId: ${data.teacherId}`);
      doc.text(`Semester: ${data.semester}`);
      doc.text(`TotalClasses: ${data.dashboard.summary?.totalClasses}`);
      doc.text(`AvgParticipationRate: ${data.dashboard.summary?.avgParticipationRate}`);
      doc.text(`AvgPassRate: ${data.dashboard.summary?.avgPassRate}`);
      doc.text(`班級名冊高風險人數加總: ${data.dashboard.summary?.totalRiskStudents}`);
    } else if (data.scope === 'high-risk') {
      doc.text(`Semester: ${data.semester}`);
      doc.text(`HighRiskCount: ${data.risks.length}`);
      doc.text(`報表產生時間: ${data.reportGeneratedAt}`);
    } else {
      doc.text(`Semester: ${data.semester}`);
      doc.text(`TotalStudents: ${data.overview.totalStudents}`);
      doc.text(`ParticipationRate: ${data.overview.participationRate}`);
      doc.text(`BestepPassRate: ${data.overview.bestepPassRate}`);
      doc.text(`班級名冊高風險人數: ${data.overview.highRiskStudentCount}`);
    }

    doc.moveDown();
    doc.end();
  });
}

module.exports = {
  buildClassReportData,
  buildTeacherReportData,
  buildOverviewReportData,
  buildHighRiskReportData,
  generateExcelReport,
  generatePdfReport,
  MAX_HIGH_RISK_EXPORT_ROWS,
};
