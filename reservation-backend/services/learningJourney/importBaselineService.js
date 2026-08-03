'use strict';

const XLSX = require('xlsx');
const { sequelize, Student, LjStudentEvent } = require('../../models');
const {
  RULE_VERSION,
  EVENT_TYPES,
  EVENT_STATUS,
  TIMING,
  SKILL_UNSPECIFIED,
} = require('../../constants/learningJourneyEventConstants');
const { deriveEnrollmentTerm, computeSemIndex } = require('./utils/semIndexCalculator');
const { rebuildAnalytics } = require('./analytics/analyticRebuildService');
const { inferGsatOverallCefr } = require('../learningAnalytics/baselineAbilityUtils');

function normSid(s) {
  return String(s || '').trim().toUpperCase();
}

function normName(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function parseScore(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function parseEnrollmentYear(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).match(/\d+/)?.[0]);
  return Number.isFinite(n) && n > 100 ? n : null;
}

function baselineEventDate(enrollmentYear, testYear) {
  const y = testYear || enrollmentYear;
  if (!y) return null;
  return `${y}-07-01`;
}

/**
 * 學測英文 baseline 匯入
 * 欄位：A 學號 | B 姓名 | C 入學學年 | D 學測英文成績 | E 測驗年度(選填)
 */
async function importBaseline(file, options = {}) {
  const batchId = String(options.batchId || '').trim() || `ljv3:baseline:${Date.now()}`;
  const warnings = [];
  const quarantine = [];
  const workbook = XLSX.read(file, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let startRow = 0;
  if (matrix.length && matrix[0]) {
    const first = String(matrix[0][0] || '').toLowerCase();
    if (first.includes('學號') || first.includes('student')) startRow = 1;
  }

  const rows = [];
  for (let i = startRow; i < matrix.length; i += 1) {
    const row = matrix[i];
    if (!row || !row.length) continue;
    rows.push({
      studentId: normSid(row[0]),
      studentName: normName(row[1]),
      enrollmentYear: parseEnrollmentYear(row[2]),
      gsatScore: parseScore(row[3]),
      testYear: parseEnrollmentYear(row[4]),
      _line: i + 1,
    });
  }

  let imported = 0;
  const affectedStudentIds = [];

  await sequelize.transaction(async (t) => {
    for (const r of rows) {
      if (!r.studentId) {
        warnings.push(`第 ${r._line} 列：缺少學號，已略過`);
        continue;
      }
      if (r.gsatScore == null) {
        quarantine.push({ reason: 'missing_gsat_score', studentId: r.studentId, line: r._line });
        continue;
      }
      if (r.gsatScore === 0) {
        quarantine.push({ reason: 'zero_score_not_allowed', studentId: r.studentId, line: r._line });
        continue;
      }

      const existingStudent = await Student.findOne({ where: { studentId: r.studentId }, transaction: t });
      if (existingStudent && r.studentName && normName(existingStudent.nameZh) !== r.studentName) {
        quarantine.push({
          reason: 'student_id_name_mismatch_db',
          studentId: r.studentId,
          line: r._line,
        });
        continue;
      }

      if (!existingStudent) {
        await Student.create({
          studentId: r.studentId,
          nameZh: r.studentName || r.studentId,
          enrollmentYear: r.enrollmentYear,
          status: 'active',
        }, { transaction: t });
      } else if (r.enrollmentYear) {
        await existingStudent.update({ enrollmentYear: r.enrollmentYear }, { transaction: t });
      }

      const enrollmentTerm = deriveEnrollmentTerm(r.enrollmentYear || existingStudent?.enrollmentYear);
      const eventDate = baselineEventDate(r.enrollmentYear || existingStudent?.enrollmentYear, r.testYear);
      const semIndex = enrollmentTerm
        ? computeSemIndex(enrollmentTerm, enrollmentTerm, { timing: TIMING.ENTRY })
        : 0;

      const payload = {
        studentId: r.studentId,
        eventType: EVENT_TYPES.BASELINE,
        eventDate,
        academicYear: r.enrollmentYear || r.testYear || null,
        academicTerm: enrollmentTerm,
        semIndex,
        sourceSystem: 'baseline_import',
        sourceRecordId: `${r.studentId}:${batchId}`,
        status: EVENT_STATUS.VALID,
        excludeFlag: false,
        reasonCode: null,
        timing: TIMING.ENTRY,
        instrument: 'GSAT',
        skill: SKILL_UNSPECIFIED,
        rawScore: r.gsatScore,
        cefrLevel: inferGsatOverallCefr(r.gsatScore),
        hours: null,
        title: '入學基準（學測英文）',
        subtitle: `學測 ${r.gsatScore}`,
        ruleVersion: RULE_VERSION,
        rawPayload: { batchId, testYear: r.testYear, enrollmentYear: r.enrollmentYear, line: r._line },
      };

      const existingEvent = await LjStudentEvent.findOne({
        where: {
          sourceSystem: 'baseline_import',
          sourceRecordId: `${r.studentId}:${batchId}`,
          eventType: EVENT_TYPES.BASELINE,
        },
        transaction: t,
      });
      if (existingEvent) {
        await existingEvent.update(payload, { transaction: t });
      } else {
        await LjStudentEvent.create(payload, { transaction: t });
      }

      // 停用同學生舊 placeholder baseline（students 來源）
      await LjStudentEvent.update(
        {
          excludeFlag: true,
          reasonCode: 'duplicate',
          status: EVENT_STATUS.EXCLUDED,
        },
        {
          where: {
            studentId: r.studentId,
            eventType: EVENT_TYPES.BASELINE,
            sourceSystem: 'students',
            excludeFlag: false,
          },
          transaction: t,
        }
      );

      imported += 1;
      affectedStudentIds.push(r.studentId);
    }
  });

  let analyticsRebuild = null;
  if (imported > 0 && options.rebuildAnalytics !== false) {
    try {
      analyticsRebuild = await rebuildAnalytics({
        scope: 'baseline-import',
        studentIds: [...new Set(affectedStudentIds)],
      });
    } catch (err) {
      warnings.push(`analytic 重建失敗：${err.message}`);
    }
  }

  return {
    ok: true,
    batchId,
    imported,
    warnings,
    quarantine,
    analyticsRebuild,
  };
}

module.exports = {
  importBaseline,
};
