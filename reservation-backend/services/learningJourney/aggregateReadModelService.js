'use strict';

const {
  EtStudentMaster,
  EtEnrollmentSnapshot,
  EtExamAttempt,
  EtExamAttemptSkillScore,
  EnglishTestRegistration,
  BestepExamScore,
  BestepAttendance,
  Reservation,
  Event,
  Student,
  ExamAttempt,
  ExamAttemptSkillScore,
  StudentSemesterProfile,
  ActivityParticipation,
  Course,
  CourseEnrollment
} = require('../../models');
const { normalizeStudentId } = require('./utils/studentNormalization');

function emptyReadModel() {
  return {
    student: {},
    semesters: [],
    examRegistrations: [],
    examAttempts: [],
    bestSkills: {},
    activities: [],
    courses: [],
    timeline: [],
    dataQuality: []
  };
}

function pushQuality(arr, code, message, severity = 'info') {
  arr.push({ code, message, severity });
}

function toPlain(row) {
  if (!row) return null;
  return typeof row.toJSON === 'function' ? row.toJSON() : row;
}

async function safeQuery(label, dataQuality, fn, emptyValue) {
  try {
    return await fn();
  } catch (err) {
    const msg = (err && err.message) || String(err);
    const code = msg.includes('doesn\'t exist') || msg.includes('ER_NO_SUCH_TABLE') ? 'TABLE_MISSING' : 'QUERY_FAILED';
    pushQuality(
      dataQuality,
      `${code}_${label}`,
      `${label} 讀取略過：${msg}`,
      'warning'
    );
    return emptyValue;
  }
}

function mergeSemesterIds(...lists) {
  const set = new Set();
  for (const list of lists) {
    for (const id of list || []) {
      const s = String(id || '').trim();
      if (s) set.add(s);
    }
  }
  return [...set].sort((a, b) => b.localeCompare(a));
}

function isoOrNull(d) {
  if (d == null || d === '') return null;
  try {
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) return typeof d === 'string' ? d : null;
    return new Date(t).toISOString();
  } catch (_) {
    return null;
  }
}

/**
 * 統一 timeline 事件（Phase 5-6）
 * 欄位：id, type, title, date, semesterId, source, status, payload
 */
function buildUnifiedTimeline(studentId, ctx) {
  const {
    enrollments = [],
    registrations = [],
    etAttempts = [],
    bestepScores = [],
    bestepAttendance = [],
    reservations = [],
    activityParticipations = [],
    ljsExamAttempts = [],
    courseEnrollments = []
  } = ctx;

  const events = [];

  for (const snap of enrollments) {
    const j = toPlain(snap);
    const sid = j.semesterId || null;
    events.push({
      id: `enrollment-${j.id}`,
      type: 'enrollment',
      title: `在學名冊（${sid || '—'}）`,
      date: isoOrNull(j.updatedAt || j.createdAt),
      semesterId: sid,
      source: 'et_enrollment_snapshots',
      status: j.isActive ? 'active' : 'inactive',
      payload: { snapshotId: j.id, grade: j.grade, department: j.department }
    });
  }

  for (const reg of registrations) {
    const j = toPlain(reg);
    events.push({
      id: `exam_registration-${j.id}`,
      type: 'exam_registration',
      title: `培力英檢報名：${j.examType || '—'}`,
      date: isoOrNull(j.updatedAt || j.createdAt || j.approvedAt),
      semesterId: j.semester || null,
      source: 'english_test_registrations',
      status: String(j.status || ''),
      payload: { registrationId: j.id, examType: j.examType }
    });
  }

  for (const att of etAttempts) {
    const testDate = att.testDate || att.examDate;
    events.push({
      id: `exam_attempt-et-${att.id}`,
      type: 'exam_attempt',
      title: `英檢測驗紀錄：${att.testType || att.examType || '—'}`,
      date: isoOrNull(testDate || att.createdAt),
      semesterId: null,
      source: 'et_exam_attempts',
      status: String(att.status || ''),
      payload: { attemptId: att.id, testType: att.testType, skillScores: att.skillScores || [] }
    });
  }

  for (const sc of bestepScores) {
    const j = toPlain(sc);
    events.push({
      id: `exam_attempt-bestep-score-${j.id}`,
      type: 'exam_attempt',
      title: 'BESTEP 成績（匯入列）',
      date: isoOrNull(j.examDate || j.updatedAt || j.createdAt),
      semesterId: j.semester || null,
      source: 'bestep_exam_scores',
      status: j.passed ? 'passed' : 'recorded',
      payload: { scoreRowId: j.id, overallLevel: j.overallLevel }
    });
  }

  for (const ba of bestepAttendance) {
    const j = toPlain(ba);
    events.push({
      id: `activity_attendance-bestep-${j.id}`,
      type: 'activity_attendance',
      title: `BESTEP 出席（${j.examType || '—'}）`,
      date: isoOrNull(j.examDate || j.importedAt),
      semesterId: j.semester || null,
      source: 'bestep_attendance',
      status: j.attended ? 'attended' : 'absent',
      payload: { attendanceId: j.id, examType: j.examType, absentReason: j.absentReason }
    });
  }

  for (const bundle of reservations) {
    const res = toPlain(bundle);
    const ev = bundle.Event ? toPlain(bundle.Event) : {};
    const rawWhen = ev.date ? `${ev.date}T${ev.startTime || '00:00'}` : res.timestamp;
    events.push({
      id: `activity_reservation-${res.id}`,
      type: 'activity_reservation',
      title: `${ev.eventType || ev.name || '活動預約'}`,
      date: isoOrNull(rawWhen),
      semesterId: ev.semesterId != null ? String(ev.semesterId) : null,
      source: 'reservations',
      status: String(res.checkinStatus || ''),
      payload: { reservationId: res.id, eventId: res.eventId, eventName: ev.name }
    });
    if (res.checkinStatus === '已簽到') {
      events.push({
        id: `activity_attendance-resv-${res.id}`,
        type: 'activity_attendance',
        title: `活動簽到：${ev.eventType || ev.name || '活動'}`,
        date: isoOrNull(res.checkinTime || rawWhen),
        semesterId: ev.semesterId != null ? String(ev.semesterId) : null,
        source: 'reservations',
        status: 'attended',
        payload: { reservationId: res.id, eventId: res.eventId }
      });
    }
  }

  for (const ap of activityParticipations) {
    const j = toPlain(ap);
    events.push({
      id: `activity_attendance-ap-${j.id}`,
      type: 'activity_attendance',
      title: `LJS 活動參與（${j.activityType || '—'}）`,
      date: isoOrNull(j.participatedAt || j.createdAt),
      semesterId: j.semesterId || null,
      source: 'activity_participations',
      status: String(j.attendanceStatus || ''),
      payload: { participationId: j.id, eventId: j.eventId, activityType: j.activityType }
    });
  }

  for (const att of ljsExamAttempts) {
    const j = typeof att === 'object' && att ? att : {};
    events.push({
      id: `exam_attempt-ljs-${j.id}`,
      type: 'exam_attempt',
      title: `LJS 測驗紀錄（${j.sourceType || '—'}）`,
      date: isoOrNull(j.examDate || j.createdAt),
      semesterId: j.semesterId || null,
      source: 'exam_attempts',
      status: String(j.status || ''),
      payload: { attemptId: j.id, sourceType: j.sourceType, skillScores: j.skillScores || [] }
    });
  }

  for (const enrollment of courseEnrollments) {
    const j = toPlain(enrollment);
    const course = enrollment.course ? toPlain(enrollment.course) : {};
    events.push({
      id: `course_record-${j.id}`,
      type: 'course_record',
      title: `修課紀錄：${course.courseName || course.courseCode || '—'}`,
      date: isoOrNull(j.updatedAt || j.createdAt),
      semesterId: j.semesterId || (course.semesterId || null),
      source: 'course_enrollments',
      status: String(j.passStatus || j.enrollmentStatus || ''),
      payload: {
        enrollmentId: j.id,
        courseId: j.courseId,
        courseCode: course.courseCode,
        courseName: course.courseName,
        departmentName: course.departmentName,
        credits: course.credits,
        enrollmentStatus: j.enrollmentStatus,
        passStatus: j.passStatus,
        finalScore: j.finalScore
      }
    });
  }

  events.sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return tb - ta;
  });

  return events;
}

async function loadEtAttempts(studentId, dataQuality) {
  const rows = await safeQuery(
    'et_exam_attempts',
    dataQuality,
    () =>
      EtExamAttempt.findAll({
        where: { studentId },
        include: [{ model: EtExamAttemptSkillScore, as: 'skillScores', required: false }],
        order: [
          ['testDate', 'DESC'],
          ['examDate', 'DESC'],
          ['id', 'DESC']
        ]
      }),
    []
  );
  return rows.map((a) => {
    const j = toPlain(a);
    if (j.skillScores) {
      j.skillScores = j.skillScores.map(toPlain);
    }
    return j;
  });
}

async function getAggregatedStudentReadModel(rawStudentId) {
  const studentId = normalizeStudentId(rawStudentId);
  const out = emptyReadModel();
  if (!studentId) {
    pushQuality(out.dataQuality, 'INVALID_STUDENT_ID', 'studentId 無效', 'error');
    return out;
  }

  try {
    const etMaster = await safeQuery(
      'et_student_master',
      out.dataQuality,
      () => EtStudentMaster.findOne({ where: { studentId } }),
      null
    );

    const enrollments = await safeQuery(
      'et_enrollment_snapshots',
      out.dataQuality,
      () =>
        EtEnrollmentSnapshot.findAll({
          where: { studentId, isActive: true },
          order: [['semesterId', 'DESC']]
        }),
      []
    );

    const regs = await safeQuery(
      'english_test_registrations',
      out.dataQuality,
      () =>
        EnglishTestRegistration.findAll({
          where: { studentId },
          order: [['semester', 'DESC'], ['id', 'DESC']]
        }),
      []
    );

    const bestScores = await safeQuery(
      'bestep_exam_scores',
      out.dataQuality,
      () => BestepExamScore.findAll({ where: { studentId }, order: [['semester', 'DESC'], ['id', 'DESC']] }),
      []
    );

    const bestAtt = await safeQuery(
      'bestep_attendance',
      out.dataQuality,
      () => BestepAttendance.findAll({ where: { studentId }, order: [['semester', 'DESC'], ['id', 'DESC']] }),
      []
    );

    const ljsStudent = await safeQuery(
      'students_ljs',
      out.dataQuality,
      () => Student.findOne({ where: { studentId } }),
      null
    );

    const etAttempts = await loadEtAttempts(studentId, out.dataQuality);

    const reservations = await safeQuery(
      'reservations',
      out.dataQuality,
      () =>
        Reservation.findAll({
          where: { studentId },
          include: [{ model: Event, required: false }],
          order: [['timestamp', 'DESC']],
          limit: 300
        }),
      []
    );

    let activityParticipations = [];
    if (ljsStudent) {
      activityParticipations = await safeQuery(
        'activity_participations',
        out.dataQuality,
        () =>
          ActivityParticipation.findAll({
            where: { studentPk: ljsStudent.id },
            order: [['participatedAt', 'ASC'], ['id', 'ASC']],
            limit: 300
          }),
        []
      );
    }

    out.student = {
      studentId,
      etStudentMaster: toPlain(etMaster),
      ljsStudentPk: ljsStudent ? ljsStudent.id : null,
      aggregateFlags: {
        hasEtMaster: !!etMaster,
        hasEnrollments: enrollments.length > 0,
        hasExamRegistrations: regs.length > 0,
        hasEtExamAttempts: etAttempts.length > 0,
        hasBestepScores: bestScores.length > 0,
        hasBestepAttendance: bestAtt.length > 0,
        hasBestSkills: false,
        hasReservations: reservations.length > 0,
        hasActivityParticipations: activityParticipations.length > 0,
        hasLjsStudent: !!ljsStudent,
        bestepScoresCount: bestScores.length,
        bestepAttendanceCount: bestAtt.length,
        etEnrollmentSnapshotCount: enrollments.length
      }
    };

    const semIds = mergeSemesterIds(
      enrollments.map((e) => e.semesterId),
      regs.map((r) => r.semester),
      bestScores.map((b) => b.semester),
      bestAtt.map((b) => b.semester),
      []
    );

    out.semesters = semIds.map((semesterId) => {
      const snap = enrollments.find((e) => e.semesterId === semesterId);
      return {
        semesterId,
        enrollmentSnapshot: snap ? toPlain(snap) : null
      };
    });

    out.examRegistrations = regs.map(toPlain);
    out.examAttempts = etAttempts;
    out.bestSkills = {};
    const apPlain = activityParticipations.map(toPlain);
    out.activities = [
      ...reservations.map((row) => {
        const res = toPlain(row);
        const ev = row.Event ? toPlain(row.Event) : null;
        return { kind: 'reservation', reservation: res, event: ev };
      }),
      ...apPlain.map((row) => ({ kind: 'activity_participation', participation: row }))
    ];

    let ljsAttempts = [];
    let ljsProfiles = [];
    let courseEnrollments = [];
    if (ljsStudent) {
      ljsAttempts = await safeQuery(
        'exam_attempts_ljs',
        out.dataQuality,
        () =>
          ExamAttempt.findAll({
            where: { studentPk: ljsStudent.id },
            include: [{ model: ExamAttemptSkillScore, as: 'skillScores', required: false }],
            order: [['examDate', 'DESC'], ['id', 'DESC']],
            limit: 100
          }).then((rows) => rows.map(toPlain)),
        []
      );
      ljsProfiles = await safeQuery(
        'student_semester_profiles',
        out.dataQuality,
        () =>
          StudentSemesterProfile.findAll({
            where: { studentPk: ljsStudent.id },
            order: [['semesterId', 'DESC']]
          }).then((rows) => rows.map(toPlain)),
        []
      );
      out.student.ljsExamAttempts = ljsAttempts;
      out.student.ljsSemesterProfiles = ljsProfiles;
    }

    courseEnrollments = await safeQuery(
      'course_enrollments',
      out.dataQuality,
      () =>
        CourseEnrollment.findAll({
          where: { studentId },
          include: [{ model: Course, as: 'course', required: false }],
          order: [['semesterId', 'DESC'], ['id', 'ASC']],
          limit: 300
        }).then((rows) => rows.map(toPlain)),
      []
    );
    out.courses = courseEnrollments;
    out.student.aggregateFlags.hasCourseEnrollments = courseEnrollments.length > 0;
    out.student.aggregateFlags.courseEnrollmentCount = courseEnrollments.length;

    out.timeline = buildUnifiedTimeline(studentId, {
      enrollments,
      registrations: regs,
      etAttempts,
      bestepScores: bestScores,
      bestepAttendance: bestAtt,
      reservations,
      activityParticipations,
      ljsExamAttempts: ljsAttempts,
      courseEnrollments
    });

    const hasAny =
      !!etMaster ||
      enrollments.length > 0 ||
      regs.length > 0 ||
      bestScores.length > 0 ||
      bestAtt.length > 0 ||
      etAttempts.length > 0 ||
      reservations.length > 0 ||
      activityParticipations.length > 0 ||
      !!ljsStudent ||
      courseEnrollments.length > 0;

    if (!hasAny) {
      pushQuality(out.dataQuality, 'NO_STUDENT_AGGREGATE', '查無任何與此學號相關之可聚合資料', 'warning');
    }

    const hasExam =
      regs.length > 0 ||
      etAttempts.length > 0 ||
      bestScores.length > 0 ||
      bestAtt.length > 0;
    if (hasAny && !hasExam) {
      pushQuality(out.dataQuality, 'NO_EXAM_AGGREGATE', '有學籍／活動等紀錄，但尚無英檢／BESTEP／長期追蹤成績相關資料', 'info');
    }

    const hasActivity = reservations.length > 0 || activityParticipations.length > 0 || bestAtt.length > 0;
    if (hasAny && !hasActivity) {
      pushQuality(out.dataQuality, 'NO_ACTIVITY_AGGREGATE', '有英檢或學籍資料，但尚無活動預約／簽到／BESTEP 出席紀錄', 'info');
    }

    if (!etMaster) {
      pushQuality(out.dataQuality, 'NO_ET_STUDENT_MASTER', 'et_student_master 無此學生主檔', 'warning');
    }
    if (!enrollments.length) {
      pushQuality(out.dataQuality, 'NO_ET_ENROLLMENT', 'et_enrollment_snapshots 無在學名冊紀錄', 'warning');
    }
    if (!regs.length) {
      pushQuality(out.dataQuality, 'NO_ENGLISH_REG', 'english_test_registrations 無培力報名紀錄', 'info');
    }
    if (!etAttempts.length) {
      pushQuality(out.dataQuality, 'NO_ET_ATTEMPTS', 'et_exam_attempts 無長期追蹤成績', 'info');
    }
    if (!courseEnrollments.length) {
      pushQuality(out.dataQuality, 'NO_COURSE_RECORDS', 'course_enrollments 無修課紀錄', 'info');
    }

    return out;
  } catch (err) {
    pushQuality(out.dataQuality, 'AGGREGATE_UNEXPECTED', (err && err.message) || String(err), 'warning');
    out.student = { studentId, aggregateFlags: {} };
    return out;
  }
}

async function getAggregatedSemesterDashboard(semesterIdRaw) {
  const semesterId = String(semesterIdRaw || '').trim();
  const out = emptyReadModel();
  out.student = {};

  if (!semesterId) {
    pushQuality(out.dataQuality, 'INVALID_SEMESTER', 'semesterId 必填', 'error');
    return out;
  }

  try {
    const rosterCount = await safeQuery(
      'et_enrollment_snapshots_count',
      out.dataQuality,
      () => EtEnrollmentSnapshot.count({ where: { semesterId, isActive: true } }),
      0
    );

    const regCount = await safeQuery(
      'english_test_registrations_count',
      out.dataQuality,
      () => EnglishTestRegistration.count({ where: { semester: semesterId } }),
      0
    );

    const bestepScoreCount = await safeQuery(
      'bestep_exam_scores_count',
      out.dataQuality,
      () => BestepExamScore.count({ where: { semester: semesterId } }),
      0
    );

    const bestepAttCount = await safeQuery(
      'bestep_attendance_count',
      out.dataQuality,
      () => BestepAttendance.count({ where: { semester: semesterId } }),
      0
    );

    out.semesters = [
      {
        semesterId,
        rosterActiveCount: rosterCount,
        englishRegistrationCount: regCount,
        bestepScoreRowCount: bestepScoreCount,
        bestepAttendanceRowCount: bestepAttCount,
        etBestSkillStudentDistinct: 0
      }
    ];

    out.timeline = [];
    out.examRegistrations = [];
    out.examAttempts = [];
    out.bestSkills = {};
    out.activities = [];

    if (!rosterCount) {
      pushQuality(out.dataQuality, 'EMPTY_ROSTER', '本學期 et_enrollment_snapshots 無在學名冊', 'warning');
    }

    return out;
  } catch (err) {
    pushQuality(out.dataQuality, 'DASHBOARD_UNEXPECTED', (err && err.message) || String(err), 'warning');
    return out;
  }
}

module.exports = {
  getAggregatedStudentReadModel,
  getAggregatedSemesterDashboard
};
