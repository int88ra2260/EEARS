'use strict';

/**
 * 將 BESTEP 成績推進到學習分析可讀層：
 *   A) bestep_exam_scores → exam_attempts（LJ sync）
 *   B) bestep_exam_scores → et_exam_attempts（英檢匯入格式／投影來源）
 *   C) rebuild analytics（lj_student_events / lj_analytic_*）
 *
 * 用法：
 *   node scripts/promote-bestep-to-learning-analytics.js --semesterId=114-2 --dry-run
 *   node scripts/promote-bestep-to-learning-analytics.js --semesterId=114-2 --apply
 *   node scripts/promote-bestep-to-learning-analytics.js --semesterId=114-2 --apply --skip-sync
 *   node scripts/promote-bestep-to-learning-analytics.js --semesterId=114-2 --apply --skip-et-import
 *   node scripts/promote-bestep-to-learning-analytics.js --semesterId=114-2 --apply --skip-rebuild
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const XLSX = require('xlsx');
const { Op } = require('sequelize');
const {
  sequelize,
  BestepExamScore,
  BestepAttendance,
  Student,
} = require('../models');
const { runSync } = require('../services/learningJourney/syncService');
const { importExam } = require('../services/learningJourney/importExamService');
const { rebuildAnalyticsInBatches } = require('../services/learningJourney/analytics/analyticRebuildService');
const { getStudentTimeline } = require('../services/learningJourney/analytics/timelineReadService');

function parseArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : null;
}

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

function normSid(v) {
  return String(v || '').trim().toUpperCase();
}

function pickExamDate(attendanceRows, fallback = '2026-05-16') {
  if (!attendanceRows?.length) return fallback;
  const lr = attendanceRows.find((r) => String(r.examType).toUpperCase() === 'LR' && r.examDate);
  if (lr?.examDate) return String(lr.examDate).slice(0, 10);
  const dated = attendanceRows
    .map((r) => (r.examDate ? String(r.examDate).slice(0, 10) : null))
    .filter(Boolean)
    .sort();
  return dated[dated.length - 1] || fallback;
}

async function buildExamImportBuffer(semesterId) {
  const scores = await BestepExamScore.findAll({ where: { semester: semesterId } });
  const sids = [...new Set(scores.map((r) => normSid(r.studentId)).filter(Boolean))];
  const students = await Student.findAll({
    where: { studentId: { [Op.in]: sids } },
    attributes: ['studentId', 'nameZh', 'departmentName', 'grade'],
  });
  const studentMap = new Map(students.map((s) => [normSid(s.studentId), s]));

  const attendance = await BestepAttendance.findAll({
    where: { semester: semesterId, studentId: { [Op.in]: sids } },
    attributes: ['studentId', 'examType', 'examDate'],
  });
  const attMap = new Map();
  for (const row of attendance) {
    const sid = normSid(row.studentId);
    if (!attMap.has(sid)) attMap.set(sid, []);
    attMap.get(sid).push(row);
  }

  const header = [
    '系所', '學院', '班別', '年級', '學號', '姓名',
    '英文檢定類別', '檢定時間',
    '聽力成績', '聽力成績(CEFR)',
    '閱讀成績', '閱讀成績(CEFR)',
    '口說成績', '口說成績(CEFR)',
    '寫作成績', '寫作成績(CEFR)',
  ];
  const matrix = [header];
  const missingName = [];

  for (const score of scores) {
    const sid = normSid(score.studentId);
    const student = studentMap.get(sid);
    const name = String(student?.nameZh || '').trim().replace(/\s+/g, ' ');
    if (!name) {
      missingName.push(sid);
      continue;
    }
    const examDate =
      (score.examDate && String(score.examDate).slice(0, 10)) ||
      pickExamDate(attMap.get(sid));

    matrix.push([
      student?.departmentName || '',
      '',
      '',
      student?.grade ?? '',
      sid,
      name,
      'BESTEP',
      examDate,
      score.listeningScore ?? '',
      score.listeningLevel || '',
      score.readingScore ?? '',
      score.readingLevel || '',
      score.speakingScore ?? '',
      score.speakingLevel || '',
      score.writingScore ?? '',
      score.writingLevel || '',
    ]);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matrix), 'exams');
  return {
    buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
    rowCount: matrix.length - 1,
    studentIds: sids,
    missingName,
  };
}

async function main() {
  const semesterId = parseArg('semesterId');
  const dryRun = !hasFlag('apply');
  const skipSync = hasFlag('skip-sync');
  const skipEtImport = hasFlag('skip-et-import');
  const skipRebuild = hasFlag('skip-rebuild');
  const verifyStudentId = normSid(parseArg('verify-student') || 'B122020027');

  if (!semesterId) {
    console.error('請提供 --semesterId=114-2');
    process.exit(1);
  }

  console.log(JSON.stringify({
    semesterId,
    dryRun,
    skipSync,
    skipEtImport,
    skipRebuild,
    verifyStudentId,
  }, null, 2));

  const summary = {
    semesterId,
    dryRun,
    sync: null,
    etImport: null,
    rebuild: null,
    verify: null,
  };

  try {
    if (!skipSync) {
      console.log('\n[A] BESTEP → exam_attempts sync...');
      const syncResult = await runSync({
        semesterId,
        sections: ['bestep_scores'],
        dryRun,
      });
      summary.sync = syncResult.results?.bestep_scores || syncResult;
      console.log(summary.sync);
    }

    const built = await buildExamImportBuffer(semesterId);
    console.log(`\n[B] 準備 et_exam_attempts 匯入列數=${built.rowCount}；缺姓名略過=${built.missingName.length}`);
    if (built.missingName.length) {
      console.log('缺姓名學號 sample:', built.missingName.slice(0, 10));
    }

    if (!skipEtImport) {
      if (dryRun) {
        summary.etImport = {
          dryRun: true,
          wouldImportRows: built.rowCount,
          missingName: built.missingName.length,
        };
        console.log(summary.etImport);
      } else {
        console.log('\n[B] importExam → et_exam_attempts...');
        const importResult = await importExam(built.buffer, {
          batchId: `bestep-promote:${semesterId}:${Date.now()}`,
          replaceMode: false,
        });
        summary.etImport = {
          batchId: importResult.batchId,
          inserted: importResult.inserted,
          replaced: importResult.replaced,
          skipped: importResult.skipped,
          warningCount: (importResult.warnings || []).length,
          conflictCount: (importResult.conflicts || []).length,
          quarantineCount: (importResult.quarantine || []).length,
          quarantineSample: (importResult.quarantine || []).slice(0, 10),
          warningSample: (importResult.warnings || []).slice(0, 10),
        };
        console.log(JSON.stringify(summary.etImport, null, 2));
      }
    }

    if (!skipRebuild) {
      console.log('\n[C] rebuild analytics...');
      if (dryRun) {
        summary.rebuild = { dryRun: true, studentCount: built.studentIds.length };
        console.log(summary.rebuild);
      } else {
        summary.rebuild = await rebuildAnalyticsInBatches({
          scope: 'manual',
          studentIds: built.studentIds,
          batchSize: 50,
          dryRun: false,
        });
        console.log(JSON.stringify({
          studentCount: built.studentIds.length,
          batches: summary.rebuild?.batches,
          analyticStudentCount: summary.rebuild?.analyticStudentCount,
          eventCount: summary.rebuild?.eventCount,
        }, null, 2));
      }
    }

    if (!dryRun && verifyStudentId) {
      const journey = await getStudentTimeline(verifyStudentId);
      const examEvents = (journey?.timeline || []).filter((e) => e.lane === 'exam');
      summary.verify = {
        studentId: verifyStudentId,
        name: journey?.student?.name,
        examCount: journey?.student?.currentStatus?.examCount,
        bestCefr: journey?.student?.currentStatus?.bestCefr,
        examTimelineCount: examEvents.length,
        examTimelineSample: examEvents.slice(0, 8).map((e) => ({
          date: e.eventDate,
          title: e.title,
          cefr: e.cefrLevel,
          score: e.rawScore,
        })),
      };
      console.log('\n[verify]', JSON.stringify(summary.verify, null, 2));
    }

    console.log('\n=== DONE ===');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await sequelize.close();
  }
}

main().catch((e) => {
  console.error(e);
  sequelize.close().finally(() => process.exit(1));
});
