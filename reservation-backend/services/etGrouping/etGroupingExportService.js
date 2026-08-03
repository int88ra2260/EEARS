'use strict';

const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const etGroupingService = require('./etGroupingService');
const etSessionTaskService = require('./etSessionTaskService');
const { listGroupLeaders } = require('./etLeaderService');

dayjs.extend(utc);
dayjs.extend(timezone);

const DATA_QUALITY_LABELS = {
  high: '英檢最佳',
  baseline_only: '僅基線',
  missing: '待確認',
};

const SOURCE_LABELS = {
  auto: '能力分組',
  legacy: '預約順序',
  manual: '手動調整',
};

function formatGseCell(assignment) {
  if (!assignment) return '';
  const cefr = assignment.cefrSnapshot || '';
  const gse = assignment.gseSnapshot;
  if (!cefr && gse == null) return '無資料';
  if (gse != null) return `${cefr || '?'} · ${gse}`;
  return cefr || '';
}

async function buildEventExportRows(eventId) {
  const grouping = await etGroupingService.getEventGrouping(eventId);
  const taskMatrix = await etSessionTaskService.getTaskMarksMatrix(eventId, {
    canManage: true,
    canMark: true,
  });

  const groupingRows = (grouping.students || []).map((student) => {
    const assignment = student.assignment;
    return {
      studentId: student.studentId,
      studentName: student.studentName,
      studentEmail: student.studentEmail,
      checkinStatus: student.checkinStatus,
      groupLabel: assignment?.groupLabel || student.currentGroup || '',
      gseDisplay: formatGseCell(assignment),
      dataQuality: DATA_QUALITY_LABELS[assignment?.dataQuality] || assignment?.dataQuality || '',
      source: SOURCE_LABELS[assignment?.source] || assignment?.source || '',
      leaderName: assignment?.leaderName || '',
    };
  });

  const taskItems = taskMatrix.taskItems || [];
  const taskRows = (taskMatrix.students || []).map((student) => {
    const row = {
      studentId: student.studentId,
      studentName: student.studentName,
      groupLabel: student.groupLabel || '',
      checkinStatus: student.checkinStatus,
    };
    for (const task of student.tasks || []) {
      row[`task_${task.taskItemId}`] = task.completed ? 'Y' : 'N';
    }
    return row;
  });

  return {
    event: grouping.event,
    groupingRows,
    taskRows,
    taskItems,
    groupLeaders: grouping.groupLeaders || [],
    slotSummary: grouping.slotSummary,
  };
}

async function buildEventGroupingWorkbook(eventId) {
  const { event, groupingRows, taskRows, taskItems } = await buildEventExportRows(eventId);
  const workbook = new ExcelJS.Workbook();
  const sheet1 = workbook.addWorksheet('分組名單');
  sheet1.columns = [
    { header: '學號', key: 'studentId', width: 14 },
    { header: '姓名', key: 'studentName', width: 14 },
    { header: 'Email', key: 'studentEmail', width: 24 },
    { header: '組別', key: 'groupLabel', width: 10 },
    { header: 'GSE/CEFR', key: 'gseDisplay', width: 16 },
    { header: '資料品質', key: 'dataQuality', width: 12 },
    { header: '分組方式', key: 'source', width: 12 },
    { header: 'Leader', key: 'leaderName', width: 12 },
    { header: '簽到', key: 'checkinStatus', width: 10 },
  ];
  groupingRows.forEach((row) => sheet1.addRow(row));

  const sheet2 = workbook.addWorksheet('任務成效');
  const taskColumns = [
    { header: '學號', key: 'studentId', width: 14 },
    { header: '姓名', key: 'studentName', width: 14 },
    { header: '組別', key: 'groupLabel', width: 10 },
    { header: '簽到', key: 'checkinStatus', width: 10 },
    ...taskItems.map((task) => ({
      header: task.label || task.code,
      key: `task_${task.id}`,
      width: 14,
    })),
  ];
  sheet2.columns = taskColumns;
  taskRows.forEach((row) => sheet2.addRow(row));

  const safeName = `${event?.name || 'ET'}-${event?.date || ''}`.replace(/[\\/:*?"<>|]/g, '_');
  return { workbook, filename: `${safeName}-et-grouping.xlsx` };
}

async function writeEventGroupingExcel(eventId, res) {
  const { workbook, filename } = await buildEventGroupingWorkbook(eventId);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  await workbook.xlsx.write(res);
  res.end();
}

function computeTaskStatsFromMatrix(matrix) {
  let eligible = 0;
  let completed = 0;
  let checkedIn = 0;
  for (const student of matrix.students || []) {
    if ((student.checkinStatus || '未簽到') !== '已簽到') continue;
    checkedIn += 1;
    for (const task of student.tasks || []) {
      if (!task.isRequired) continue;
      eligible += 1;
      if (task.completed) completed += 1;
    }
  }
  const completionRate = eligible > 0 ? Math.round((completed / eligible) * 1000) / 10 : null;
  return { checkedIn, eligibleMarks: eligible, completedMarks: completed, completionRate };
}

module.exports = {
  buildEventExportRows,
  buildEventGroupingWorkbook,
  writeEventGroupingExcel,
  computeTaskStatsFromMatrix,
};
