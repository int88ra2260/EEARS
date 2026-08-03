'use strict';

const crypto = require('crypto');
const {
  sequelize,
  EtEnrollmentSnapshot,
  Student,
  StudentSemesterProfile,
  EnglishTestRegistration,
  ExamRegistration,
  BestepExamScore,
  ExamAttempt,
  ExamAttemptSkillScore,
  ActivityParticipation
} = require('../../models');
const { isValidSemesterId } = require('./reconciliationService');
const { buildSemesterEventFilter } = require('./utils/semesterEventFilter');

const SYNC_SOURCE_REF_RESERVATION = 'lj_sync_reservation';

function emptyResult() {
  return { inserted: 0, updated: 0, skipped: 0, errors: [] };
}

function pushErr(errors, code, message) {
  errors.push({ code, message: String(message || '') });
}

function normStudentId(s) {
  return String(s || '').trim().toUpperCase();
}

function shaDedupe(parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 64);
}

function mapEnglishStatusToExamReg(s) {
  const x = String(s || '').toLowerCase();
  if (x === 'success') return 'success';
  if (x === 'failed') return 'failed';
  if (x === 'cancelled') return 'cancelled';
  return 'pending';
}

function mapExamTypeToScope(examType) {
  const t = String(examType || '').toUpperCase();
  if (t === 'LR') return 'LR';
  if (t === 'SW') return 'SW';
  if (t === 'NON' || t === 'NONE') return 'NONE';
  return 'ALL';
}

function mapEventTypeToActivityEnum(eventType) {
  const t = String(eventType || '').trim();
  if (!t) return null;
  if (['ET', 'EC', 'IF'].includes(t)) return t;
  const lower = t.toLowerCase();
  if (lower === 'english table') return 'ET';
  if (lower === 'english club') return 'EC';
  if (lower === 'international forum') return 'IF';
  return null;
}

function mapCheckinToAttendance(status) {
  if (status === '已簽到') return 'attended';
  if (status === '已登記違規') return 'absent';
  return 'registered';
}

function cefrOrNull(level) {
  const L = String(level || '').toUpperCase();
  if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(L)) return L;
  return null;
}

/**
 * 載入 Student；若 dryRun 且尚無列則不建立，回傳 wouldCreateStudent。
 */
async function loadOrPrepareStudent(studentId, nameZh, dryRun, transaction) {
  const sid = normStudentId(studentId);
  if (!sid) return { student: null, wouldCreateStudent: false };
  let row = await Student.findOne({ where: { studentId: sid }, transaction });
  if (row) return { student: row, wouldCreateStudent: false };
  if (dryRun) return { student: null, wouldCreateStudent: true };
  const display = (nameZh && String(nameZh).trim()) || sid;
  row = await Student.create(
    {
      studentId: sid,
      nameZh: display.slice(0, 120),
      nameEn: null,
      status: 'active'
    },
    { transaction }
  );
  return { student: row, wouldCreateStudent: true };
}

/**
 * et_enrollment_snapshots（isActive）→ student_semester_profiles
 * 不覆蓋 rosterSource === manual。
 */
async function syncRosterToStudentSemesterProfiles({ semesterId, dryRun }) {
  const stats = emptyResult();
  const snaps = await EtEnrollmentSnapshot.findAll({
    where: { semesterId, isActive: true }
  });

  const run = async (transaction) => {
    for (const snap of snaps) {
      const sid = normStudentId(snap.studentId);
      if (!sid) {
        stats.skipped += 1;
        continue;
      }
      try {
        const existingProfile = await StudentSemesterProfile.findOne({
          where: { studentId: sid, semesterId },
          transaction
        });
        const { student, wouldCreateStudent } = await loadOrPrepareStudent(
          sid,
          snap.studentName,
          dryRun,
          transaction
        );

        if (dryRun && wouldCreateStudent && !existingProfile) {
          stats.inserted += 1;
          continue;
        }
        if (dryRun && wouldCreateStudent && existingProfile) {
          stats.skipped += 1;
          continue;
        }
        if (!student) {
          stats.skipped += 1;
          continue;
        }

        if (existingProfile) {
          if (existingProfile.rosterSource === 'manual') {
            stats.skipped += 1;
            continue;
          }
          if (dryRun) {
            stats.updated += 1;
            continue;
          }
          await existingProfile.update(
            {
              isRostered: true,
              rosterSource: 'et_snapshot',
              dataQualityFlag: 'ok'
            },
            { transaction }
          );
          stats.updated += 1;
        } else {
          if (dryRun) {
            stats.inserted += 1;
            continue;
          }
          await StudentSemesterProfile.create(
            {
              studentPk: student.id,
              studentId: sid,
              semesterId,
              isRostered: true,
              rosterSource: 'et_snapshot',
              attemptCount: 0,
              bestAttained: false,
              latestAttained: false,
              dataQualityFlag: 'ok'
            },
            { transaction }
          );
          stats.inserted += 1;
        }
      } catch (e) {
        pushErr(stats.errors, 'ROSTER_ROW', e.message);
      }
    }
  };

  const t = await sequelize.transaction();
  try {
    await run(t);
    if (dryRun) await t.rollback();
    else await t.commit();
  } catch (e) {
    await t.rollback();
    pushErr(stats.errors, 'ROSTER_TX', e.message);
  }
  return stats;
}

/**
 * english_test_registrations → exam_registrations（registration_channel = system）
 */
async function syncEnglishTestRegistrations({ semesterId, dryRun }) {
  const stats = emptyResult();
  const regs = await EnglishTestRegistration.findAll({ where: { semester: semesterId } });

  const run = async (transaction) => {
    for (const reg of regs) {
      const sid = normStudentId(reg.studentId);
      if (!sid) {
        stats.skipped += 1;
        continue;
      }
      try {
        const displayName = reg.studentNameZh || reg.name || sid;
        const { student, wouldCreateStudent } = await loadOrPrepareStudent(
          sid,
          displayName,
          dryRun,
          transaction
        );
        const existing = await ExamRegistration.findOne({
          where: {
            studentId: sid,
            semesterId,
            registrationChannel: 'system'
          },
          transaction
        });

        if (dryRun && wouldCreateStudent && !existing) {
          stats.inserted += 1;
          continue;
        }
        if (dryRun && wouldCreateStudent && existing) {
          stats.skipped += 1;
          continue;
        }
        if (!student) {
          stats.skipped += 1;
          continue;
        }

        if (existing && existing.metaJson && existing.metaJson.syncManualLock === true) {
          stats.skipped += 1;
          continue;
        }

        const payload = {
          syncSource: 'english_test_registrations',
          englishRegistrationId: reg.id
        };

        if (existing) {
          if (dryRun) {
            stats.updated += 1;
            continue;
          }
          const nextMeta = {
            ...(existing.metaJson || {}),
            ...payload
          };
          await existing.update(
            {
              legacyRegistrationId: reg.id,
              examScope: mapExamTypeToScope(reg.examType),
              status: mapEnglishStatusToExamReg(reg.status),
              appliedAt: reg.createdAt || null,
              approvedAt: reg.approvedAt || null,
              metaJson: nextMeta
            },
            { transaction }
          );
          stats.updated += 1;
        } else {
          if (dryRun) {
            stats.inserted += 1;
            continue;
          }
          await ExamRegistration.create(
            {
              legacyRegistrationId: reg.id,
              studentPk: student.id,
              studentId: sid,
              semesterId,
              registrationChannel: 'system',
              examScope: mapExamTypeToScope(reg.examType),
              status: mapEnglishStatusToExamReg(reg.status),
              appliedAt: reg.createdAt || null,
              approvedAt: reg.approvedAt || null,
              metaJson: payload
            },
            { transaction }
          );
          stats.inserted += 1;
        }
      } catch (e) {
        pushErr(stats.errors, 'EXAM_REG_ROW', e.message);
      }
    }
  };

  const t = await sequelize.transaction();
  try {
    await run(t);
    if (dryRun) await t.rollback();
    else await t.commit();
  } catch (e) {
    await t.rollback();
    pushErr(stats.errors, 'EXAM_REG_TX', e.message);
  }
  return stats;
}

/**
 * bestep_exam_scores → exam_attempts（BESTEP）+ exam_attempt_skill_scores
 * 以 dedupe_key 冪等；已存在列若 rawPayload.syncManualLock 則跳過。
 */
async function syncBestepScoresToExamAttempts({ semesterId, dryRun }) {
  const stats = emptyResult();
  const rows = await BestepExamScore.findAll({ where: { semester: semesterId } });

  const run = async (transaction) => {
    for (const row of rows) {
      const sid = normStudentId(row.studentId);
      if (!sid) {
        stats.skipped += 1;
        continue;
      }
      const dedupeKey = shaDedupe(['bestep_exam_score', semesterId, sid, String(row.id)]);
      try {
        const existing = await ExamAttempt.findOne({ where: { dedupeKey }, transaction });
        if (existing) {
          if (existing.rawPayload && existing.rawPayload.syncManualLock === true) {
            stats.skipped += 1;
          } else {
            stats.skipped += 1;
          }
          continue;
        }

        const { student, wouldCreateStudent } = await loadOrPrepareStudent(sid, sid, dryRun, transaction);
        const examDate =
          row.examDate ||
          (row.importedAt ? new Date(row.importedAt).toISOString().slice(0, 10) : null) ||
          '1970-01-01';

        if (dryRun && wouldCreateStudent) {
          stats.inserted += 1;
          continue;
        }
        if (!student) {
          stats.skipped += 1;
          continue;
        }

        if (dryRun) {
          stats.inserted += 1;
          continue;
        }

        const attempt = await ExamAttempt.create(
          {
            studentPk: student.id,
            studentId: sid,
            semesterId,
            registrationId: null,
            sourceType: 'BESTEP',
            sourceRef: `bestep_exam_scores:${row.id}`,
            examVendor: 'BESTEP',
            examScope: 'ALL',
            examDate,
            status: 'valid',
            rawPayload: { bestepExamScoreId: row.id, sync: true },
            dedupeKey
          },
          { transaction }
        );
        const skills = [
          ['listening', row.listeningScore, row.listeningLevel],
          ['reading', row.readingScore, row.readingLevel],
          ['speaking', row.speakingScore, row.speakingLevel],
          ['writing', row.writingScore, row.writingLevel]
        ];
        for (const [skill, rawScore, lvl] of skills) {
          const cefr = cefrOrNull(lvl);
          await ExamAttemptSkillScore.create(
            {
              attemptId: attempt.id,
              skill,
              rawScore: rawScore != null ? Number(rawScore) : null,
              rawLevel: lvl || null,
              cefrLevel: cefr,
              cefrRank: null,
              isInferred: false,
              mappingVersion: 'sync_bestep_v1'
            },
            { transaction }
          );
        }
        stats.inserted += 1;
      } catch (e) {
        pushErr(stats.errors, 'BESTEP_ROW', e.message);
      }
    }
  };

  const t = await sequelize.transaction();
  try {
    await run(t);
    if (dryRun) await t.rollback();
    else await t.commit();
  } catch (e) {
    await t.rollback();
    pushErr(stats.errors, 'BESTEP_TX', e.message);
  }
  return stats;
}

async function fetchReservationActivityRows({ semesterId, studentId = null, limit = null }) {
  const semesterFilter = buildSemesterEventFilter(semesterId);
  const replacements = { ...semesterFilter.replacements };
  let studentWhere = '';
  if (studentId) {
    replacements.studentId = normStudentId(studentId);
    studentWhere = 'AND UPPER(TRIM(r.studentId)) = :studentId';
  }
  let limitSql = '';
  if (limit) {
    replacements.rowLimit = Number(limit);
    limitSql = 'LIMIT :rowLimit';
  }
  return sequelize.query(
    `
    SELECT r.id AS reservationId, UPPER(TRIM(r.studentId)) AS studentId, r.checkinStatus, r.checkinTime,
           e.id AS eventId, e.name AS eventName, e.eventType, e.date AS eventDate, e.startTime
    FROM reservations r
    INNER JOIN events e ON r.eventId = e.id
    ${semesterFilter.join}
    WHERE 1=1
    ${semesterFilter.where}
    ${studentWhere}
    ORDER BY e.date DESC, e.startTime DESC, r.id DESC
    ${limitSql}
    `,
    { replacements, type: sequelize.QueryTypes.SELECT }
  );
}

async function upsertReservationActivityRows(resRows, semesterId, dryRun, transaction, stats) {
  for (const r of resRows) {
    const sid = normStudentId(r.studentId);
    const activityType = mapEventTypeToActivityEnum(r.eventType);
    if (!sid || !activityType) {
      stats.skipped += 1;
      continue;
    }
    const eventIdStr = String(r.eventId);
    const sourceRef = `${SYNC_SOURCE_REF_RESERVATION}:${r.reservationId}`;
    try {
      let existing = await ActivityParticipation.findOne({
        where: { studentId: sid, eventId: eventIdStr, sourceRef },
        transaction
      });
      if (!existing) {
        existing = await ActivityParticipation.findOne({
          where: { studentId: sid, eventId: eventIdStr },
          transaction
        });
      }
      if (existing) {
        if (existing.metaJson && existing.metaJson.syncManualLock === true) {
          stats.skipped += 1;
          continue;
        }
        if (dryRun) {
          stats.updated += 1;
          continue;
        }
        await existing.update(
          {
            semesterId,
            activityType,
            sourceRef: existing.sourceRef || sourceRef,
            attendanceStatus: mapCheckinToAttendance(r.checkinStatus),
            participatedAt: r.checkinTime || null,
            metaJson: {
              ...(existing.metaJson || {}),
              reservationId: r.reservationId,
              eventName: r.eventName || existing.metaJson?.eventName || null,
              eventDate: r.eventDate || existing.metaJson?.eventDate || null,
              sync: true
            }
          },
          { transaction }
        );
        stats.updated += 1;
        continue;
      }

      const { student, wouldCreateStudent } = await loadOrPrepareStudent(
        sid,
        r.studentDisplayName || sid,
        dryRun,
        transaction
      );
      if (dryRun && wouldCreateStudent) {
        stats.inserted += 1;
        continue;
      }
      if (!student) {
        stats.skipped += 1;
        continue;
      }
      if (dryRun) {
        stats.inserted += 1;
        continue;
      }
      await ActivityParticipation.create(
        {
          studentPk: student.id,
          studentId: sid,
          semesterId,
          eventId: eventIdStr,
          activityType,
          attendanceStatus: mapCheckinToAttendance(r.checkinStatus),
          participatedAt: r.checkinTime || null,
          sourceRef,
          metaJson: {
            reservationId: r.reservationId,
            eventName: r.eventName || null,
            eventDate: r.eventDate || null,
            sync: true
          }
        },
        { transaction }
      );
      stats.inserted += 1;
    } catch (e) {
      pushErr(stats.errors, 'ACTIVITY_ROW', e.message);
    }
  }
}

/**
 * reservations + events → activity_participations
 */
async function syncActivitiesToActivityParticipations({ semesterId, dryRun }) {
  const stats = emptyResult();
  const resRows = await fetchReservationActivityRows({ semesterId });
  const t = await sequelize.transaction();
  try {
    await upsertReservationActivityRows(resRows, semesterId, dryRun, t, stats);
    if (dryRun) await t.rollback();
    else await t.commit();
  } catch (e) {
    await t.rollback();
    pushErr(stats.errors, 'ACTIVITY_TX', e.message);
  }
  return stats;
}

/**
 * 單一學生：由 reservations 補寫 activity_participations（供學習歷程詳情 on-read 使用）
 */
async function syncStudentActivitiesFromReservations({
  studentId,
  semesterId,
  dryRun = false,
  studentName = null,
  reservationRows = null
}) {
  const stats = emptyResult();
  const sid = normStudentId(studentId);
  const sem = String(semesterId || '').trim();
  if (!sid || !sem) {
    pushErr(stats.errors, 'ACTIVITY_SCOPE', 'studentId 與 semesterId 必填');
    return stats;
  }
  const resRows = Array.isArray(reservationRows) && reservationRows.length
    ? reservationRows.map((row) => ({
      ...row,
      studentDisplayName: studentName || row.studentDisplayName || null
    }))
    : (await fetchReservationActivityRows({ semesterId: sem, studentId: sid, limit: 300 }))
      .map((row) => ({ ...row, studentDisplayName: studentName || null }));
  if (!resRows.length) return stats;
  const t = await sequelize.transaction();
  try {
    await upsertReservationActivityRows(resRows, sem, dryRun, t, stats);
    if (dryRun) await t.rollback();
    else await t.commit();
  } catch (e) {
    await t.rollback();
    pushErr(stats.errors, 'ACTIVITY_TX', e.message);
  }
  return stats;
}

const SECTION_HANDLERS = {
  roster: syncRosterToStudentSemesterProfiles,
  exam_registration: syncEnglishTestRegistrations,
  bestep_scores: syncBestepScoresToExamAttempts,
  activities: syncActivitiesToActivityParticipations
};

function normalizeSections(input) {
  if (!input || (Array.isArray(input) && input.includes('all'))) {
    return Object.keys(SECTION_HANDLERS);
  }
  const arr = Array.isArray(input) ? input : [input];
  return [...new Set(arr.map((s) => String(s).trim()).filter((s) => SECTION_HANDLERS[s]))];
}

/**
 * @param {{ semesterId: string, sections?: string[], dryRun?: boolean }} opts
 * dryRun 預設 true（未傳視同 true）。
 */
async function runSync(opts) {
  const semesterId = String(opts.semesterId || '').trim();
  const dryRun = opts.dryRun !== false;
  const sections = normalizeSections(opts.sections);

  if (!isValidSemesterId(semesterId)) {
    return {
      semesterId,
      dryRun,
      sections,
      results: {},
      error: 'semesterId 格式不正確'
    };
  }

  const results = {};
  for (const key of sections) {
    const fn = SECTION_HANDLERS[key];
    results[key] = await fn({ semesterId, dryRun });
  }

  return { semesterId, dryRun, sections, results };
}

module.exports = {
  runSync,
  syncRosterToStudentSemesterProfiles,
  syncEnglishTestRegistrations,
  syncBestepScoresToExamAttempts,
  syncActivitiesToActivityParticipations,
  syncStudentActivitiesFromReservations,
  fetchReservationActivityRows,
  normalizeSections
};
