'use strict';

const XLSX = require('xlsx');
const { Op } = require('sequelize');
const {
  sequelize,
  EtSemester,
  Semester,
  EtEnrollmentSnapshot,
  Student,
  ExamAttempt,
  ExamAttemptSkillScore,
  MigrationQuarantine,
  Class,
  ClassMembership,
  ActivityParticipation,
  Course,
  CourseEnrollment,
  EnglishTestRegistration,
  BestepAttendance,
  BestepExamScore,
  Reservation,
  Event,
  LearningJourneyImportHistory
} = require('../../models');
const { normalizeStudentId } = require('./utils/studentNormalization');
const { compactPersonName } = require('../../utils/personName');
const { getCefrRank, DEFAULT_MAPPING_VERSION, compareBestScoreCandidate } = require('./utils/cefrRules');
const { buildExternalExamDedupeKey } = require('./utils/dedupeKeyBuilder');

const SKILLS = ['listening', 'reading', 'speaking', 'writing'];
const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作'
};
const B2_RANK = getCefrRank('B2');
const VALID_CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const MAX_STUDENT_LIMIT = 200;

function warning(code, message, extra = {}) {
  return { code, message, severity: 'warning', ...extra };
}

function normalizeName(value) {
  return String(value || '').trim();
}

function normalizeText(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeCefr(value) {
  const text = normalizeText(value).toUpperCase();
  return VALID_CEFR.has(text) ? text : null;
}

function parseMaybeDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const text = normalizeText(value).replace(/\//g, '-');
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function sheetRowsFromBuffer(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
}

function readEnrollmentRows(fileBuffer) {
  return sheetRowsFromBuffer(fileBuffer).slice(1).map((row, idx) => ({
    rowNumber: idx + 2,
    department: normalizeText(row[0]),
    college: normalizeText(row[1]),
    className: normalizeText(row[2]),
    grade: normalizeText(row[3]),
    studentId: normalizeStudentId(row[4]),
    studentName: compactPersonName(row[5])
  }));
}

function readExamRows(fileBuffer) {
  return sheetRowsFromBuffer(fileBuffer).slice(1).map((row, idx) => ({
    rowNumber: idx + 2,
    department: normalizeText(row[0]),
    college: normalizeText(row[1]),
    className: normalizeText(row[2]),
    grade: normalizeText(row[3]),
    studentId: normalizeStudentId(row[4]),
    studentName: compactPersonName(row[5]),
    examType: normalizeText(row[6]),
    examDate: parseMaybeDate(row[7]),
    listeningScore: parseNumber(row[8]),
    listeningCefr: normalizeCefr(row[9]),
    readingScore: parseNumber(row[10]),
    readingCefr: normalizeCefr(row[11]),
    speakingScore: parseNumber(row[12]),
    speakingCefr: normalizeCefr(row[13]),
    writingScore: parseNumber(row[14]),
    writingCefr: normalizeCefr(row[15]),
    raw: row
  }));
}

async function recordQuarantine(payload, options = {}) {
  return MigrationQuarantine.create({
    stageName: payload.stageName || 'learning_journey_final',
    sourceType: payload.sourceType || 'LEARNING_JOURNEY',
    sourceRef: payload.sourceRef || null,
    studentId: payload.studentId || null,
    reasonCode: payload.reasonCode || 'WARNING',
    reasonMessage: payload.reasonMessage || payload.reason || '',
    rawPayload: payload.rawPayload || null,
    sourceTable: payload.sourceTable || 'learning_journey_import',
    sourceKey: payload.sourceKey || null,
    reason: payload.reason || payload.reasonMessage || payload.reasonCode || 'warning',
    payloadJson: payload.payloadJson || payload.rawPayload || null
  }, options);
}

async function recordImportHistory(payload, options = {}) {
  if (!LearningJourneyImportHistory) return null;
  const warningCount = Number(payload.warningCount || 0);
  const conflictedCount = Number(payload.conflictedCount || 0);
  const skippedCount = Number(payload.skippedCount || 0);
  return LearningJourneyImportHistory.create({
    semesterId: payload.semesterId || null,
    importType: payload.importType,
    sourceFile: payload.sourceFile || null,
    status: conflictedCount || skippedCount || warningCount ? 'partial' : 'success',
    importedCount: Number(payload.importedCount || 0),
    updatedCount: Number(payload.updatedCount || 0),
    skippedCount,
    duplicateSkippedCount: Number(payload.duplicateSkippedCount || 0),
    conflictedCount,
    warningCount,
    summaryJson: payload.summaryJson || null
  }, options);
}

async function ensureStudent(row, transaction, warnings) {
  const studentId = normalizeStudentId(row.studentId);
  const studentName = compactPersonName(row.studentName);
  if (!studentId || !studentName) return null;
  const existing = await Student.findOne({ where: { studentId }, transaction });
  if (existing) {
    if (compactPersonName(existing.nameZh) && compactPersonName(existing.nameZh) !== studentName) {
      warnings.push(warning('STUDENT_ID_NAME_CONFLICT', '同學號不同姓名，已寫入 quarantine', {
        studentId,
        existingName: existing.nameZh,
        incomingName: studentName,
        rowNumber: row.rowNumber
      }));
      await recordQuarantine({
        sourceType: 'LEARNING_JOURNEY_STUDENT',
        sourceRef: `row:${row.rowNumber || ''}`,
        studentId,
        reasonCode: 'STUDENT_ID_NAME_CONFLICT',
        reason: '同學號不同姓名',
        reasonMessage: `既有姓名 ${existing.nameZh}，匯入姓名 ${studentName}`,
        rawPayload: row,
        sourceTable: 'students',
        sourceKey: studentId
      }, { transaction });
      return null;
    }
    return existing;
  }
  return Student.create({
    studentId,
    nameZh: studentName,
    departmentName: row.department || null,
    collegeCode: null,
    grade: row.grade ? Number(row.grade) || null : null,
    status: 'active'
  }, { transaction });
}

async function importEnrollmentSnapshot({ semesterId, fileBuffer, sourceFile = 'upload.xlsx', dryRun = false }) {
  const sid = normalizeText(semesterId);
  if (!sid) return { error: 'semesterId 為必填' };
  if (!fileBuffer) return { error: '請上傳 Excel 檔案' };

  const rows = readEnrollmentRows(fileBuffer);
  const warnings = [];
  const validRows = [];
  const seen = new Set();
  let skipped = 0;

  for (const row of rows) {
    if (!row.studentId || !row.studentName) {
      skipped += 1;
      warnings.push(warning('MISSING_STUDENT_ID_OR_NAME', '學號或姓名空白，略過該列', { rowNumber: row.rowNumber }));
      continue;
    }
    const key = `${row.studentId}|${row.studentName}`;
    if (seen.has(key)) {
      skipped += 1;
      warnings.push(warning('DUPLICATE_ENROLLMENT_ROW', '同一份名單內重複 studentId + studentName，僅保留第一筆', {
        rowNumber: row.rowNumber,
        studentId: row.studentId,
        studentName: row.studentName
      }));
      continue;
    }
    seen.add(key);
    validRows.push(row);
  }

  if (dryRun) {
    return { semesterId: sid, sourceFile, dryRun: true, imported: 0, updated: 0, skipped, warnings, validRows: validRows.length };
  }

  const transaction = await sequelize.transaction();
  let imported = 0;
  let updated = 0;
  try {
    await EtSemester.findOrCreate({
      where: { id: sid },
      defaults: { id: sid, startDate: null, endDate: null, snapshotDate: null },
      transaction
    });
    const importBatchId = `lj-enrollment-${sid}-${Date.now()}`;
    for (const row of validRows) {
      const existing = await EtEnrollmentSnapshot.findOne({
        where: { semesterId: sid, studentId: row.studentId },
        transaction
      });
      if (existing && compactPersonName(existing.studentName) && compactPersonName(existing.studentName) !== compactPersonName(row.studentName)) {
        skipped += 1;
        warnings.push(warning('ENROLLMENT_STUDENT_ID_NAME_CONFLICT', '同學號不同姓名，已寫入 quarantine', {
          rowNumber: row.rowNumber,
          studentId: row.studentId,
          existingName: existing.studentName,
          incomingName: row.studentName
        }));
        await recordQuarantine({
          sourceType: 'LEARNING_JOURNEY_ENROLLMENT',
          sourceRef: sourceFile,
          studentId: row.studentId,
          reasonCode: 'STUDENT_ID_NAME_CONFLICT',
          reason: '同學號不同姓名',
          reasonMessage: `既有姓名 ${existing.studentName}，匯入姓名 ${row.studentName}`,
          rawPayload: row,
          sourceTable: 'et_enrollment_snapshots',
          sourceKey: `${sid}:${row.studentId}`
        }, { transaction });
        continue;
      }
      await ensureStudent(row, transaction, warnings);
      if (existing) {
        await existing.update({
          studentName: row.studentName,
          department: row.department || null,
          college: row.college || null,
          className: row.className || null,
          grade: row.grade || null,
          status: '在學',
          isActive: true,
          importBatchId,
          sourceType: 'learning_journey',
          sourceBatchId: importBatchId
        }, { transaction });
        updated += 1;
      } else {
        await EtEnrollmentSnapshot.create({
          semesterId: sid,
          studentId: row.studentId,
          studentName: row.studentName,
          department: row.department || null,
          college: row.college || null,
          className: row.className || null,
          grade: row.grade || null,
          status: '在學',
          isActive: true,
          importBatchId,
          sourceType: 'learning_journey',
          sourceBatchId: importBatchId
        }, { transaction });
        imported += 1;
      }
    }
    const result = { semesterId: sid, sourceFile, dryRun: false, imported, updated, skipped, warnings, importBatchId };
    await recordImportHistory({
      semesterId: sid,
      importType: 'enrollment',
      sourceFile,
      importedCount: imported,
      updatedCount: updated,
      skippedCount: skipped,
      warningCount: warnings.length,
      summaryJson: result
    }, { transaction });
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

function buildSkillInput(row) {
  return [
    { skill: 'listening', rawScore: row.listeningScore, cefr: row.listeningCefr, rawInput: row.raw && row.raw[9] },
    { skill: 'reading', rawScore: row.readingScore, cefr: row.readingCefr, rawInput: row.raw && row.raw[11] },
    { skill: 'speaking', rawScore: row.speakingScore, cefr: row.speakingCefr, rawInput: row.raw && row.raw[13] },
    { skill: 'writing', rawScore: row.writingScore, cefr: row.writingCefr, rawInput: row.raw && row.raw[15] }
  ];
}

function attemptPayload(row) {
  return {
    studentId: row.studentId,
    studentName: row.studentName,
    examType: row.examType,
    examDate: row.examDate,
    skills: buildSkillInput(row).filter((s) => s.cefr || s.rawScore != null).map((s) => ({
      skill: s.skill,
      rawScore: s.rawScore,
      cefrLevel: s.cefr
    }))
  };
}

function sameAttempt(existing, row) {
  const existingScores = {};
  for (const score of existing.skillScores || []) {
    existingScores[score.skill] = {
      rawScore: score.rawScore == null ? null : Number(score.rawScore),
      cefrLevel: score.cefrLevel || null
    };
  }
  for (const skill of buildSkillInput(row)) {
    const next = { rawScore: skill.rawScore == null ? null : Number(skill.rawScore), cefrLevel: skill.cefr || null };
    const prev = existingScores[skill.skill] || { rawScore: null, cefrLevel: null };
    if (String(prev.cefrLevel || '') !== String(next.cefrLevel || '')) return false;
    if ((prev.rawScore == null ? null : Number(prev.rawScore)) !== next.rawScore) return false;
  }
  return true;
}

async function importExternalExamAttempts({ fileBuffer, sourceFile = 'upload.xlsx', dryRun = false }) {
  if (!fileBuffer) return { error: '請上傳 Excel 檔案' };
  const rows = readExamRows(fileBuffer);
  const warnings = [];
  const validRows = [];
  let skipped = 0;

  for (const row of rows) {
    if (!row.studentId || !row.studentName) {
      skipped += 1;
      warnings.push(warning('MISSING_STUDENT_ID_OR_NAME', '學號或姓名空白，略過該列', { rowNumber: row.rowNumber }));
      continue;
    }
    if (!row.examType || !row.examDate) {
      skipped += 1;
      warnings.push(warning('MISSING_EXAM_TYPE_OR_DATE', '英文檢定類別或檢定時間空白/無效，略過該列', {
        rowNumber: row.rowNumber,
        studentId: row.studentId
      }));
      continue;
    }
    let hasSkill = false;
    for (const skill of buildSkillInput(row)) {
      if (skill.rawInput != null && normalizeText(skill.rawInput) && !skill.cefr) {
        warnings.push(warning('INVALID_CEFR', `${SKILL_LABELS[skill.skill]} CEFR 非 A1/A2/B1/B2/C1/C2，不納入該技能`, {
          rowNumber: row.rowNumber,
          studentId: row.studentId,
          skill: skill.skill
        }));
      }
      if (skill.cefr) hasSkill = true;
    }
    if (!hasSkill) {
      warnings.push(warning('NO_VALID_SKILL_SCORE', '該列沒有可用 CEFR 技能分數，仍不建立 attempt', {
        rowNumber: row.rowNumber,
        studentId: row.studentId
      }));
      skipped += 1;
      continue;
    }
    validRows.push(row);
  }

  if (dryRun) {
    return { sourceFile, dryRun: true, imported: 0, duplicateSkipped: 0, conflicted: 0, skipped, warnings, validRows: validRows.length };
  }

  const transaction = await sequelize.transaction();
  let imported = 0;
  let duplicateSkipped = 0;
  let conflicted = 0;
  try {
    for (const row of validRows) {
      const student = await ensureStudent(row, transaction, warnings);
      if (!student) {
        skipped += 1;
        continue;
      }
      const dedupeKey = buildExternalExamDedupeKey({
        studentId: row.studentId,
        examDate: row.examDate,
        examType: row.examType
      });
      const existing = await ExamAttempt.findOne({
        where: { dedupeKey },
        include: [{ model: ExamAttemptSkillScore, as: 'skillScores', required: false }],
        transaction
      });
      if (existing) {
        if (sameAttempt(existing, row)) {
          duplicateSkipped += 1;
          warnings.push(warning('DUPLICATE_ATTEMPT_SKIPPED', '同一場考試已存在且內容相同，已略過', {
            rowNumber: row.rowNumber,
            studentId: row.studentId,
            attemptId: existing.id
          }));
        } else {
          conflicted += 1;
          warnings.push(warning('DUPLICATE_ATTEMPT_CONFLICT', '同一場考試已存在但內容不同，已寫入 quarantine 且未覆蓋', {
            rowNumber: row.rowNumber,
            studentId: row.studentId,
            attemptId: existing.id
          }));
          await recordQuarantine({
            sourceType: 'LEARNING_JOURNEY_EXTERNAL_EXAM',
            sourceRef: sourceFile,
            studentId: row.studentId,
            reasonCode: 'DUPLICATE_ATTEMPT_CONFLICT',
            reason: '同一場考試內容衝突',
            reasonMessage: 'studentId + examDate + examType 相同，但新舊技能分數不同',
            rawPayload: { incoming: attemptPayload(row), existingAttemptId: existing.id },
            sourceTable: 'exam_attempts',
            sourceKey: dedupeKey
          }, { transaction });
        }
        continue;
      }
      const attempt = await ExamAttempt.create({
        studentPk: student.id,
        studentId: row.studentId,
        semesterId: null,
        sourceType: 'EXTERNAL',
        sourceRef: sourceFile,
        examVendor: row.examType,
        examScope: 'ALL',
        examDate: row.examDate,
        status: 'valid',
        rawPayload: attemptPayload(row),
        dedupeKey
      }, { transaction });
      for (const score of buildSkillInput(row)) {
        if (!score.cefr) continue;
        await ExamAttemptSkillScore.create({
          attemptId: attempt.id,
          skill: score.skill,
          rawScore: score.rawScore,
          rawLevel: score.cefr,
          cefrLevel: score.cefr,
          cefrRank: getCefrRank(score.cefr),
          isInferred: false,
          mappingVersion: DEFAULT_MAPPING_VERSION
        }, { transaction });
      }
      imported += 1;
    }
    const result = { sourceFile, dryRun: false, imported, duplicateSkipped, conflicted, skipped, warnings };
    await recordImportHistory({
      semesterId: null,
      importType: 'external_exam',
      sourceFile,
      importedCount: imported,
      skippedCount: skipped,
      duplicateSkippedCount: duplicateSkipped,
      conflictedCount: conflicted,
      warningCount: warnings.length,
      summaryJson: result
    }, { transaction });
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getSemesterEndDate(semesterId, warnings) {
  const et = await EtSemester.findByPk(semesterId).catch(() => null);
  if (et && et.endDate) return String(et.endDate).slice(0, 10);
  const sem = await Semester.findOne({ where: { code: semesterId } }).catch(() => null);
  if (sem && sem.endDate) return new Date(sem.endDate).toISOString().slice(0, 10);
  const m = String(semesterId || '').match(/^(\d{2,3})-(1|2)$/);
  if (m) {
    const rocYear = Number(m[1]);
    const gregorian = rocYear + 1911;
    return m[2] === '1' ? `${gregorian + 1}-01-31` : `${gregorian}-07-31`;
  }
  warnings.push(warning('SEMESTER_END_DATE_MISSING', '找不到學期結束日，跨學期最佳能力未套用日期上限'));
  return null;
}

async function getTeacherVisibleStudentIds(user, semesterId) {
  if (!user || String(user.role || '').toLowerCase() !== 'teacher') return null;
  const teacherName = normalizeName(user.name);
  if (!teacherName) return new Set();
  const classes = await Class.findAll({ where: { semester: semesterId, teacherName }, attributes: ['id'] });
  const classIds = classes.map((c) => c.id);
  if (!classIds.length) return new Set();
  const memberships = await ClassMembership.findAll({
    where: { semester: semesterId, classId: { [Op.in]: classIds } },
    attributes: ['studentId']
  });
  return new Set(memberships.map((m) => normalizeStudentId(m.studentId)).filter(Boolean));
}

async function loadRoster(semesterId, options = {}) {
  const where = { semesterId, isActive: true };
  const rows = await EtEnrollmentSnapshot.findAll({
    where,
    order: [['department', 'ASC'], ['grade', 'ASC'], ['studentId', 'ASC']]
  });
  const teacherSet = await getTeacherVisibleStudentIds(options.user, semesterId);
  const items = rows
    .map((row) => row.toJSON())
    .map((row) => ({ ...row, studentId: normalizeStudentId(row.studentId), studentName: compactPersonName(row.studentName) }))
    .filter((row) => (teacherSet ? teacherSet.has(row.studentId) : true));
  return items;
}

function emptySkillMap() {
  return { listening: null, reading: null, speaking: null, writing: null };
}

function bestCandidate(score, attempt) {
  return {
    cefr: score.cefrLevel || null,
    cefrLevel: score.cefrLevel || null,
    cefrRank: score.cefrRank || getCefrRank(score.cefrLevel) || 0,
    rawScore: score.rawScore == null ? null : Number(score.rawScore),
    examDate: attempt.examDate,
    examType: attempt.examVendor || attempt.sourceType || null,
    sourceType: attempt.sourceType,
    attemptId: attempt.id
  };
}

async function loadBestSkillsForRoster(roster, semesterId, warnings) {
  const endDate = await getSemesterEndDate(semesterId, warnings);
  const studentIds = [...new Set(roster.map((r) => r.studentId).filter(Boolean))];
  if (!studentIds.length) return new Map();
  const where = {
    studentId: { [Op.in]: studentIds },
    status: 'valid'
  };
  if (endDate) where.examDate = { [Op.lte]: endDate };
  const attempts = await ExamAttempt.findAll({
    where,
    include: [{ model: ExamAttemptSkillScore, as: 'skillScores', required: false }],
    order: [['examDate', 'ASC'], ['id', 'ASC']]
  });
  const bestByStudent = new Map(studentIds.map((id) => [id, emptySkillMap()]));
  for (const attempt of attempts) {
    const studentId = normalizeStudentId(attempt.studentId);
    const best = bestByStudent.get(studentId);
    if (!best) continue;
    for (const score of attempt.skillScores || []) {
      if (!SKILLS.includes(score.skill)) continue;
      const cand = bestCandidate(score, attempt);
      if (!cand.cefrRank) continue;
      if (!best[score.skill] || compareBestScoreCandidate(cand, best[score.skill]) > 0) {
        best[score.skill] = cand;
      }
    }
  }
  return bestByStudent;
}

function skillStats(rows) {
  const denominator = rows.length;
  const out = {};
  for (const skill of SKILLS) {
    const b2PlusCount = rows.filter((row) => Number(row.bestSkills?.[skill]?.cefrRank || 0) >= B2_RANK).length;
    out[skill] = { b2PlusCount, rate: denominator ? Number((b2PlusCount / denominator).toFixed(4)) : 0 };
  }
  return out;
}

function groupRows(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || '未分類';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return [...map.entries()].map(([key, group]) => ({
    key,
    denominator: group.length,
    skills: skillStats(group)
  }));
}

async function getSemesterOverview(semesterIdRaw, options = {}) {
  const semesterId = normalizeText(semesterIdRaw);
  const warnings = [];
  if (!semesterId) return { error: 'semesterId 為必填' };
  const roster = await loadRoster(semesterId, options);
  const bestByStudent = await loadBestSkillsForRoster(roster, semesterId, warnings);
  const rows = roster.map((row) => ({
    studentId: row.studentId,
    studentName: row.studentName,
    department: row.department || null,
    college: row.college || null,
    className: row.className || null,
    grade: row.grade || null,
    bestSkills: bestByStudent.get(row.studentId) || emptySkillMap()
  }));
  return {
    semesterId,
    denominator: rows.length,
    skills: skillStats(rows),
    byGrade: groupRows(rows, (row) => row.grade).map((row) => ({ grade: row.key, denominator: row.denominator, skills: row.skills })),
    byDepartment: groupRows(rows, (row) => row.department).map((row) => ({ department: row.key, denominator: row.denominator, skills: row.skills })),
    byDepartmentGrade: groupRows(rows, (row) => `${row.department || '未分類'}|${row.grade || '未分類'}`).map((row) => {
      const [department, grade] = row.key.split('|');
      return { department, grade, denominator: row.denominator, skills: row.skills };
    }),
    warnings,
    source: 'learning_journey_final'
  };
}

function toStudentListRow(row) {
  const best = row.bestSkills || emptySkillMap();
  return {
    studentId: row.studentId,
    studentName: row.studentName,
    department: row.department || null,
    grade: row.grade || null,
    bestSkills: best,
    bestListeningCefr: best.listening?.cefr || null,
    bestReadingCefr: best.reading?.cefr || null,
    bestSpeakingCefr: best.speaking?.cefr || null,
    bestWritingCefr: best.writing?.cefr || null
  };
}

async function getSemesterStudents(semesterIdRaw, options = {}) {
  const semesterId = normalizeText(semesterIdRaw);
  const warnings = [];
  if (!semesterId) return { error: 'semesterId 為必填' };
  const roster = await loadRoster(semesterId, options);
  const bestByStudent = await loadBestSkillsForRoster(roster, semesterId, warnings);
  let rows = roster.map((row) => ({
    ...row,
    bestSkills: bestByStudent.get(row.studentId) || emptySkillMap()
  }));
  const keyword = normalizeText(options.keyword).toLowerCase();
  const department = normalizeText(options.department).toLowerCase();
  const grade = normalizeText(options.grade);
  if (keyword) {
    rows = rows.filter((row) => [row.studentId, row.studentName, row.department].some((v) => normalizeText(v).toLowerCase().includes(keyword)));
  }
  if (department) rows = rows.filter((row) => normalizeText(row.department).toLowerCase().includes(department));
  if (grade) rows = rows.filter((row) => normalizeText(row.grade) === grade);
  if (options.skill && SKILLS.includes(String(options.skill))) {
    const wantsB2 = String(options.b2Plus || '').toLowerCase();
    if (wantsB2 === 'true' || wantsB2 === 'false') {
      const expected = wantsB2 === 'true';
      rows = rows.filter((row) => (Number(row.bestSkills?.[options.skill]?.cefrRank || 0) >= B2_RANK) === expected);
    }
  }
  const total = rows.length;
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(MAX_STUDENT_LIMIT, Math.max(1, Number(options.limit) || 50));
  const offset = options.offset != null ? Math.max(0, Number(options.offset) || 0) : (page - 1) * limit;
  const items = rows.slice(offset, offset + limit).map(toStudentListRow);
  return {
    semesterId,
    items,
    pagination: { page: Math.floor(offset / limit) + 1, limit, offset, total, returned: items.length },
    warnings,
    source: 'learning_journey_final'
  };
}

function activityStatusFromReservation(row) {
  if (row.checkinStatus === '已簽到') return 'attended';
  if (row.checkinStatus === '已登記違規') return 'absent';
  return 'registered';
}

function iso(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}

async function ensureTeacherCanSee(user, semesterId, studentId) {
  const teacherSet = await getTeacherVisibleStudentIds(user, semesterId);
  if (!teacherSet) return true;
  return teacherSet.has(normalizeStudentId(studentId));
}

async function getStudentDetail(studentIdRaw, options = {}) {
  const studentId = normalizeStudentId(studentIdRaw);
  const semesterId = normalizeText(options.semesterId);
  const user = options.user || null;
  const isTeacher = user && String(user.role || '').toLowerCase() === 'teacher';
  if (!studentId) return { error: 'studentId 為必填' };
  if (isTeacher && !semesterId) return { error: 'Teacher 查詢學生詳情必須提供 semesterId', statusCode: 400 };
  if (isTeacher && !(await ensureTeacherCanSee(user, semesterId, studentId))) {
    return { error: '權限不足', statusCode: 403 };
  }

  const warnings = [];
  const student = await Student.findOne({ where: { studentId } });
  const rosterWhere = { studentId, isActive: true };
  if (semesterId) rosterWhere.semesterId = semesterId;
  const rosterRows = await EtEnrollmentSnapshot.findAll({ where: rosterWhere, order: [['semesterId', 'DESC']] });
  const currentRoster = rosterRows[0] ? rosterRows[0].toJSON() : null;
  const bestMap = await loadBestSkillsForRoster(currentRoster ? [currentRoster] : [{ studentId }], semesterId || (currentRoster && currentRoster.semesterId) || '', warnings);

  const semesterFilter = semesterId ? { semesterId } : {};
  const activityWhere = { studentId, ...(semesterId ? { semesterId } : {}) };
  const activityRows = await ActivityParticipation.findAll({ where: activityWhere, order: [['participatedAt', 'DESC'], ['id', 'DESC']], limit: 300 }).catch(() => []);
  const reservationRows = await Reservation.findAll({
    where: { studentId },
    include: [{ model: Event, required: false, ...(semesterId ? { where: { semesterId } } : {}) }],
    order: [['timestamp', 'DESC']],
    limit: 300
  }).catch(() => []);
  const courseRows = await CourseEnrollment.findAll({
    where: { studentId, ...semesterFilter },
    include: [{ model: Course, as: 'course', required: false }],
    order: [['semesterId', 'DESC'], ['id', 'DESC']],
    limit: 300
  }).catch(() => []);
  const registrations = await EnglishTestRegistration.findAll({
    where: { studentId, ...(semesterId ? { semester: semesterId } : {}) },
    order: [['semester', 'DESC'], ['id', 'DESC']]
  }).catch(() => []);
  const bestepAttendance = await BestepAttendance.findAll({
    where: { studentId, ...(semesterId ? { semester: semesterId } : {}) },
    order: [['examDate', 'DESC'], ['id', 'DESC']]
  }).catch(() => []);
  const bestepScores = await BestepExamScore.findAll({
    where: { studentId, ...(semesterId ? { semester: semesterId } : {}) },
    order: [['examDate', 'DESC'], ['id', 'DESC']]
  }).catch(() => []);
  const examWhere = { studentId, status: 'valid' };
  if (isTeacher && semesterId) {
    const endDate = await getSemesterEndDate(semesterId, warnings);
    if (endDate) examWhere.examDate = { [Op.lte]: endDate };
  }
  const attempts = await ExamAttempt.findAll({
    where: examWhere,
    include: [{ model: ExamAttemptSkillScore, as: 'skillScores', required: false }],
    order: [['examDate', 'DESC'], ['id', 'DESC']],
    limit: 300
  });

  const activitySummary = { attended: 0, absent: 0, cancelled: 0 };
  const timeline = [];
  for (const row of activityRows.map((r) => r.toJSON())) {
    if (row.attendanceStatus === 'attended') activitySummary.attended += 1;
    if (row.attendanceStatus === 'absent') activitySummary.absent += 1;
    if (row.attendanceStatus === 'cancelled') activitySummary.cancelled += 1;
    timeline.push({
      id: `activity-${row.id}`,
      type: 'activity',
      title: `活動參與：${row.activityType || ''}`,
      date: iso(row.participatedAt || row.createdAt),
      semesterId: row.semesterId,
      status: row.attendanceStatus,
      source: 'activity_participations',
      payload: row
    });
  }
  for (const bundle of reservationRows) {
    const row = bundle.toJSON();
    const event = row.Event || {};
    const status = activityStatusFromReservation(row);
    if (status === 'attended') activitySummary.attended += 1;
    if (status === 'absent') activitySummary.absent += 1;
    timeline.push({
      id: `reservation-${row.id}`,
      type: 'activity',
      title: event.name || event.eventType || '活動預約',
      date: iso(event.date ? `${event.date}T${event.startTime || '00:00'}` : row.timestamp),
      semesterId: event.semesterId != null ? String(event.semesterId) : null,
      status,
      source: 'reservations',
      payload: row
    });
  }
  const courses = courseRows.map((r) => r.toJSON());
  for (const row of courses) {
    timeline.push({
      id: `course-${row.id}`,
      type: 'course',
      title: row.course?.courseName || row.course?.courseCode || '修課紀錄',
      date: iso(row.updatedAt || row.createdAt),
      semesterId: row.semesterId,
      status: row.enrollmentStatus,
      source: 'course_enrollments',
      payload: row
    });
  }
  const bestep = [
    ...registrations.map((r) => ({ type: 'registration', ...r.toJSON() })),
    ...bestepAttendance.map((r) => ({ type: 'attendance', ...r.toJSON() })),
    ...bestepScores.map((r) => ({ type: 'score', ...r.toJSON() }))
  ];
  for (const row of bestep) {
    timeline.push({
      id: `bestep-${row.type}-${row.id}`,
      type: row.type === 'registration' ? 'exam_registration' : 'exam',
      title: row.type === 'registration' ? `培力英檢報名：${row.examType || ''}` : `培力英檢${row.type === 'score' ? '成績' : '出缺席'}`,
      date: iso(row.examDate || row.updatedAt || row.createdAt || row.importedAt),
      semesterId: row.semester || null,
      status: row.status || (row.attended === false ? 'absent' : row.attended === true ? 'attended' : row.passed === true ? 'passed' : 'recorded'),
      source: 'bestep',
      payload: row
    });
  }
  const externalExams = attempts.filter((a) => a.sourceType !== 'BESTEP').map((a) => a.toJSON());
  for (const row of externalExams) {
    timeline.push({
      id: `exam-${row.id}`,
      type: 'exam',
      title: `英檢：${row.examVendor || row.sourceType || ''}`,
      date: iso(row.examDate),
      semesterId: row.semesterId || null,
      status: row.status,
      source: 'exam_attempts',
      payload: row
    });
  }
  timeline.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

  return {
    student: {
      studentId,
      studentName: currentRoster?.studentName || (student && student.nameZh) || studentId
    },
    currentSemester: currentRoster ? {
      semesterId: currentRoster.semesterId,
      department: currentRoster.department,
      college: currentRoster.college,
      className: currentRoster.className,
      grade: currentRoster.grade
    } : null,
    activitySummary,
    courses,
    bestep,
    externalExams,
    bestSkills: bestMap.get(studentId) || emptySkillMap(),
    timeline,
    warnings,
    source: 'learning_journey_final'
  };
}

async function listSemesters() {
  const etRows = await EtSemester.findAll({ order: [['id', 'DESC']] }).catch(() => []);
  const semesterRows = await Semester.findAll({ order: [['code', 'DESC']] }).catch(() => []);
  const byId = new Map();
  for (const row of semesterRows) {
    const item = row.toJSON();
    byId.set(String(item.code), {
      id: item.code,
      code: item.code,
      name: item.name || item.code,
      startDate: item.startDate || null,
      endDate: item.endDate || null,
      isActive: !!item.isActive
    });
  }
  for (const row of etRows) {
    const item = row.toJSON();
    const existing = byId.get(String(item.id));
    byId.set(String(item.id), {
      id: item.id,
      code: item.id,
      name: existing?.name || item.id,
      startDate: item.startDate || existing?.startDate || null,
      endDate: item.endDate || existing?.endDate || null,
      isActive: existing?.isActive || false
    });
  }
  return [...byId.values()].sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

async function getImportHistories(semesterIdRaw, options = {}) {
  const semesterId = normalizeText(semesterIdRaw);
  if (!semesterId) return { error: 'semesterId 為必填' };
  const limit = Math.min(200, Math.max(1, Number(options.limit) || 50));
  const quarantineRows = await MigrationQuarantine.findAll({
    where: {
      sourceType: {
        [Op.in]: [
          'LEARNING_JOURNEY_STUDENT',
          'LEARNING_JOURNEY_ENROLLMENT',
          'LEARNING_JOURNEY_EXTERNAL_EXAM'
        ]
      }
    },
    order: [['createdAt', 'DESC']],
    limit
  }).catch(() => []);
  const historyRows = await LearningJourneyImportHistory.findAll({
    where: {
      [Op.or]: [
        { semesterId },
        { semesterId: null }
      ]
    },
    order: [['createdAt', 'DESC']],
    limit
  }).catch(() => []);
  const historyItems = historyRows.map((row) => {
    const item = row.toJSON();
    return {
      id: `history-${item.id}`,
      semesterId: item.semesterId || semesterId,
      status: item.status,
      sourceType: item.importType,
      sourceRef: item.sourceFile,
      importedCount: item.importedCount,
      updatedCount: item.updatedCount,
      skippedCount: item.skippedCount,
      duplicateSkippedCount: item.duplicateSkippedCount,
      conflictedCount: item.conflictedCount,
      warningCount: item.warningCount,
      reasonCode: item.status,
      reasonMessage: `${item.importType} 匯入：新增 ${item.importedCount}，更新 ${item.updatedCount}，略過 ${item.skippedCount}`,
      createdAt: item.createdAt,
      payload: item.summaryJson || null
    };
  });
  const items = quarantineRows
    .map((row) => row.toJSON())
    .filter((row) => {
      const payload = row.rawPayload || row.payloadJson || {};
      return !payload.semesterId || String(payload.semesterId) === semesterId;
    })
    .map((row) => ({
      id: row.id,
      semesterId,
      status: 'warning',
      sourceType: row.sourceType,
      sourceRef: row.sourceRef,
      reasonCode: row.reasonCode,
      reasonMessage: row.reasonMessage || row.reason,
      createdAt: row.createdAt,
      payload: row.rawPayload || row.payloadJson || null
    }));
  const allItems = [...historyItems, ...items]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, limit);
  return {
    semesterId,
    items: allItems,
    source: 'learning_journey_final',
    warnings: allItems.length ? [] : [warning('NO_IMPORT_HISTORY', '目前沒有 Learning Journey 匯入歷程')]
  };
}

async function rebuildReadModel(semesterIdRaw) {
  const semesterId = normalizeText(semesterIdRaw);
  if (!semesterId) return { error: 'semesterId 為必填' };
  const overview = await getSemesterOverview(semesterId);
  if (overview.error) return overview;
  return {
    semesterId,
    mode: 'on_demand_recalculation',
    rebuilt: true,
    message: 'Learning Journey final read model 以即時計算為準；已完成 overview 重新計算驗證。',
    summary: {
      denominator: overview.denominator,
      skills: overview.skills
    },
    source: 'learning_journey_final'
  };
}

module.exports = {
  importEnrollmentSnapshot,
  importExternalExamAttempts,
  getSemesterOverview,
  getSemesterStudents,
  getStudentDetail,
  listSemesters,
  getImportHistories,
  rebuildReadModel
};
