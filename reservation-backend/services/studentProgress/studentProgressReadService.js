'use strict';

const { Op } = require('sequelize');
const {
  Reservation,
  Event,
  ClassMembership,
  Class,
  EnglishTestRegistration,
  BestepExamScore,
  BestepAttendance,
} = require('../../models');
const passportService = require('../englishLearningPassport/passportService');
const { CERTIFICATION_THRESHOLD } = require('../englishLearningPassport/constants');
const { buildActivitySection } = require('./studentProgressActivityUtils');
const {
  dedupeCourseRecords,
  dedupeBestepScoresBySemester,
  compactBestepAttendance,
  dedupeEnglishTestRegistrations,
} = require('./studentProgressPresentationUtils');

function formatBookingCode(reservationId) {
  const idNum = Number(reservationId);
  if (!Number.isFinite(idNum)) return `R-${String(reservationId || '').trim()}`;
  return `R-${String(idNum).padStart(6, '0')}`;
}

function normalizeStudentContext(ctx) {
  return passportService.normalizeStudentContext(ctx);
}

function cleanStudentId(str) {
  if (!str) return null;
  return String(str).trim().toUpperCase().replace(/\s+/g, '');
}

function assertRequiredContext(ctx) {
  if (!ctx.studentId || !ctx.studentName || !ctx.studentEmail) {
    const err = new Error('請提供學號、姓名與 Email');
    err.status = 400;
    err.code = 'REQUIRED_FIELD_MISSING';
    throw err;
  }
}

async function fetchReservationActivities(ctx) {
  const reservations = await Reservation.findAll({
    where: {
      studentId: ctx.studentId,
      studentName: ctx.studentName,
      studentEmail: ctx.studentEmail,
    },
    attributes: ['id', 'studentId', 'studentName', 'studentEmail', 'timestamp', 'eventId', 'checkinStatus'],
    include: [{
      model: Event,
      attributes: ['id', 'name', 'date', 'startTime', 'endTime', 'eventType', 'location'],
      required: false,
    }],
    order: [['timestamp', 'DESC']],
    limit: 200,
  });

  return reservations.map((r) => ({
    id: r.id,
    reservationId: r.id,
    bookingCode: formatBookingCode(r.id),
    eventId: r.Event ? r.Event.id : null,
    eventName: r.Event ? r.Event.name : '',
    date: r.Event ? r.Event.date : '',
    startTime: r.Event ? r.Event.startTime : '',
    endTime: r.Event ? r.Event.endTime : '',
    location: r.Event ? r.Event.location : null,
    eventType: r.Event ? r.Event.eventType : null,
    checkinStatus: r.checkinStatus,
  }));
}

async function fetchPassportSummary(ctx) {
  try {
    const passport = await passportService.getPassportForStudent(ctx);
    if (!passport) return null;
    const p = passport.toJSON ? passport.toJSON() : passport;
    return {
      hasRecord: true,
      totalApprovedPoints: p.totalApprovedPoints ?? 0,
      threshold: CERTIFICATION_THRESHOLD,
      status: p.status,
      certificationStatus: p.certificationStatus ?? null,
    };
  } catch (err) {
    if (err.code === 'STUDENT_MISMATCH' || err.status === 403) return null;
    throw err;
  }
}

async function fetchCourseRecords(ctx) {
  const cleanId = cleanStudentId(ctx.studentId);
  const memberships = await ClassMembership.findAll({
    where: {
      studentId: { [Op.or]: [ctx.studentId, cleanId].filter(Boolean) },
    },
    include: [{
      model: Class,
      attributes: ['id', 'name', 'semester', 'department'],
      required: false,
    }],
    order: [['semester', 'DESC'], ['id', 'DESC']],
    limit: 30,
  });

  return dedupeCourseRecords(
    memberships
      .filter((m) => String(m.studentName || '').trim() === ctx.studentName)
      .map((m) => ({
        semester: m.semester,
        className: m.Class ? m.Class.name : null,
        department: m.department || (m.Class ? m.Class.department : null),
      })),
  );
}

async function fetchEnglishTestRegistrations(ctx) {
  const rows = await EnglishTestRegistration.findAll({
    where: {
      studentId: ctx.studentId,
      email: ctx.studentEmail,
      [Op.or]: [
        { name: ctx.studentName },
        { studentNameZh: ctx.studentName },
      ],
    },
    attributes: ['id', 'semester', 'status', 'examType', 'updatedAt'],
    order: [['updatedAt', 'DESC']],
    limit: 10,
  });

  return dedupeEnglishTestRegistrations(rows.map((r) => ({
    id: r.id,
    semester: r.semester,
    status: r.status,
    examType: r.examType,
    updatedAt: r.updatedAt,
  })));
}

async function fetchBestepScores(studentId) {
  const cleanId = cleanStudentId(studentId);
  const rows = await BestepExamScore.findAll({
    where: { studentId: { [Op.or]: [studentId, cleanId].filter(Boolean) } },
    attributes: [
      'semester',
      'examDate',
      'overallLevel',
      'totalScore',
      'listeningLevel',
      'readingLevel',
      'speakingLevel',
      'writingLevel',
    ],
    order: [['semester', 'DESC'], ['importedAt', 'DESC']],
    limit: 10,
  });

  return dedupeBestepScoresBySemester(rows.map((r) => ({
    semester: r.semester,
    examDate: r.examDate,
    overallLevel: r.overallLevel,
    totalScore: r.totalScore != null ? Number(r.totalScore) : null,
    listeningLevel: r.listeningLevel,
    readingLevel: r.readingLevel,
    speakingLevel: r.speakingLevel,
    writingLevel: r.writingLevel,
  })));
}

async function fetchBestepAttendance(studentId) {
  const cleanId = cleanStudentId(studentId);
  const rows = await BestepAttendance.findAll({
    where: { studentId: { [Op.or]: [studentId, cleanId].filter(Boolean) } },
    attributes: ['semester', 'examType', 'examDate', 'attended'],
    order: [['semester', 'DESC'], ['examDate', 'DESC']],
    limit: 20,
  });

  return compactBestepAttendance(rows.map((r) => ({
    semester: r.semester,
    examType: r.examType,
    examDate: r.examDate,
    attended: r.attended,
  })));
}

async function getStudentProgressRead(rawCtx) {
  const ctx = normalizeStudentContext(rawCtx);
  assertRequiredContext(ctx);

  const reservations = await fetchReservationActivities(ctx);

  const [passport, courses, englishTestRegistrations] = await Promise.all([
    fetchPassportSummary(ctx),
    fetchCourseRecords(ctx),
    fetchEnglishTestRegistrations(ctx),
  ]);

  const identityVerified = reservations.length > 0
    || passport != null
    || courses.length > 0
    || englishTestRegistrations.length > 0;

  if (!identityVerified) {
    return {
      found: false,
      message: 'Request processed.',
      data: null,
    };
  }

  let bestepScores = [];
  let bestepAttendance = [];
  if (identityVerified) {
    [bestepScores, bestepAttendance] = await Promise.all([
      fetchBestepScores(ctx.studentId),
      fetchBestepAttendance(ctx.studentId),
    ]);
  }

  const activities = buildActivitySection(reservations);

  return {
    found: true,
    message: 'Request processed.',
    data: {
      identity: {
        studentId: ctx.studentId,
        studentName: ctx.studentName,
        studentEmail: ctx.studentEmail,
      },
      activities,
      courses: {
        items: courses,
        disclaimer: '修課資料來自本系統匯入之班級名單，正式修課紀錄請以教務系統公告為準。',
      },
      exams: {
        englishTestRegistrations,
        bestep: {
          scores: bestepScores,
          attendance: bestepAttendance,
        },
        disclaimer: '考試資料來自本系統匯入或報名紀錄，正式成績請以考試中心／教務公告為準。',
      },
      passport,
    },
  };
}

module.exports = {
  normalizeStudentContext,
  getStudentProgressRead,
  buildActivitySection,
  fetchReservationActivities,
};
