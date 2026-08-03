'use strict';

const { sequelize, Student, ActivityParticipation } = require('../../models');
const { semesterIdFromDate } = require('../../utils/semesterConstants');
const {
  fetchReservationInfo,
  fetchAttendanceInfo
} = require('./ewlApiClient');
const { hoursFromStartEndTime } = require('./utils/activityHours');
const { mapEwlEventNameToResourceType } = require('../learningAnalytics/ewlResourceTypes');

const SOURCE_REF_PREFIX = 'ewl_api';
const ACTIVITY_TYPE = 'EWL';

function emptyStats() {
  return { inserted: 0, updated: 0, skipped: 0, errors: [], affectedStudentIds: [] };
}

function pushErr(errors, code, message, extra = {}) {
  errors.push({ code, message: String(message || ''), ...extra });
}

function normStudentId(s) {
  return String(s || '').trim().toUpperCase();
}

function text(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function toDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseCheckinTime(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s || s === 'null' || s === '0000-00-00 00:00:00') return null;
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function mapAttendanceFromCheckin(checkInTimeRaw) {
  const checkin = parseCheckinTime(checkInTimeRaw);
  if (checkin) return { attendanceStatus: 'attended', participatedAt: checkin };
  return { attendanceStatus: 'registered', participatedAt: null };
}

function buildEventId(consultationTimeId) {
  return `ewl-${consultationTimeId}`;
}

function buildSourceRef(consultationTimeId) {
  return `${SOURCE_REF_PREFIX}:${consultationTimeId}`;
}

function attendanceMatchKey(studentId, eventName, eventDate, timePeriodName) {
  return [
    normStudentId(studentId),
    text(eventName) || '',
    toDateOnly(eventDate) || '',
    text(timePeriodName) || ''
  ].join('|');
}

/**
 * 活動日優先序（嚴禁把報名日當活動日）：
 * 1) EventDate（活動舉辦日）
 * 2) TargetDate（部分 API 別名）
 * 3) ReservationDate（僅在完全沒有活動日時 fallback；多半是報名日）
 */
function resolveEventDate(raw) {
  return (
    toDateOnly(raw.EventDate)
    || toDateOnly(raw.TargetDate)
    || toDateOnly(raw.ReservationDate)
    || null
  );
}

/**
 * 預設同步窗：過去 lookbackDays ～ 未來 lookaheadDays（活動日篩選語意）
 */
function defaultDateWindow(now = new Date(), lookbackDays = 14, lookaheadDays = 60) {
  const start = new Date(now);
  start.setDate(start.getDate() - lookbackDays);
  const end = new Date(now);
  end.setDate(end.getDate() + lookaheadDays);
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { startDate: fmt(start), endDate: fmt(end) };
}

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

function buildAttendanceIndex(attendanceRows = []) {
  const byFull = new Map();
  const byStudentEventDate = new Map();
  for (const row of attendanceRows) {
    const studentId = normStudentId(row.StudentNo);
    const eventName = text(row.EventName) || text(row.TargetName) || '';
    const eventDate = toDateOnly(row.EventDate) || toDateOnly(row.TargetDate);
    const timePeriodName = text(row.TimePeriodName) || '';
    const payload = {
      checkInTime: text(row.CheckInTime),
      isCheckedIn: row.IsCheckedIn === true || row.IsCheckedIn === 'true' || !!text(row.CheckInTime),
      eventDate,
      eventName,
      timePeriodName
    };
    if (!studentId) continue;
    const fullKey = attendanceMatchKey(studentId, eventName, eventDate, timePeriodName);
    byFull.set(fullKey, payload);
    const softKey = attendanceMatchKey(studentId, eventName, eventDate, '');
    if (!byStudentEventDate.has(softKey)) byStudentEventDate.set(softKey, payload);
  }
  return { byFull, byStudentEventDate };
}

function findAttendanceMatch(index, reservationRow, eventDate) {
  if (!index) return null;
  const studentId = reservationRow.StudentNo;
  const eventName = text(reservationRow.EventName) || text(reservationRow.Name) || '';
  const timePeriodName = text(reservationRow.TimePeriodName) || '';
  const fullKey = attendanceMatchKey(studentId, eventName, eventDate, timePeriodName);
  if (index.byFull.has(fullKey)) return index.byFull.get(fullKey);
  const softKey = attendanceMatchKey(studentId, eventName, eventDate, '');
  if (index.byStudentEventDate.has(softKey)) return index.byStudentEventDate.get(softKey);
  return null;
}

function normalizeReservationRow(raw, attendanceIndex = null) {
  const consultationTimeId = raw.ConsultationTimeID != null ? Number(raw.ConsultationTimeID) : NaN;
  if (!Number.isFinite(consultationTimeId) || consultationTimeId <= 0) return null;
  const studentId = normStudentId(raw.StudentNo);
  if (!studentId) return null;

  const reservationDate = toDateOnly(raw.ReservationDate);
  const eventDate = resolveEventDate(raw);
  const attendance = findAttendanceMatch(attendanceIndex, raw, eventDate);
  const checkInTime = text(raw.CheckInTime) || attendance?.checkInTime || null;
  const { attendanceStatus, participatedAt } = mapAttendanceFromCheckin(checkInTime);
  const startTime = text(raw.StartTime);
  const endTime = text(raw.EndTime);
  const hours = hoursFromStartEndTime(startTime, endTime);

  return {
    consultationTimeId,
    studentId,
    studentName: text(raw.StudentName),
    eventName: text(raw.EventName) || text(raw.Name) || 'EWL 活動',
    eventDate,
    reservationDate,
    startTime,
    endTime,
    hours,
    timePeriodName: text(raw.TimePeriodName),
    location: text(raw.Location),
    counselorName: text(raw.CounselorName),
    reservationStatus: text(raw.ReservationStatus),
    checkInTime,
    attendanceStatus,
    participatedAt,
    semesterId: eventDate ? semesterIdFromDate(eventDate) : null,
    eventId: buildEventId(consultationTimeId),
    sourceRef: buildSourceRef(consultationTimeId)
  };
}

function noteAffectedStudent(stats, studentId) {
  if (!stats._affectedSet) stats._affectedSet = new Set();
  if (studentId) stats._affectedSet.add(studentId);
}

async function upsertEwlRows(rows, dryRun, transaction, stats, attendanceIndex = null) {
  for (const row of rows) {
    const normalized = normalizeReservationRow(row, attendanceIndex);
    if (!normalized) {
      stats.skipped += 1;
      continue;
    }
    if (!normalized.eventDate) {
      stats.skipped += 1;
      pushErr(stats.errors, 'EWL_MISSING_EVENT_DATE', '缺少活動日（EventDate/TargetDate/ReservationDate）', {
        consultationTimeID: normalized.consultationTimeId,
        studentId: normalized.studentId
      });
      continue;
    }
    try {
      const existing = await ActivityParticipation.findOne({
        where: {
          studentId: normalized.studentId,
          eventId: normalized.eventId,
          sourceRef: normalized.sourceRef
        },
        transaction
      });

      const eventDateSource = toDateOnly(row.EventDate)
        ? 'EventDate'
        : (toDateOnly(row.TargetDate) ? 'TargetDate' : 'ReservationDate');

      const metaJson = {
        source: 'ewl_api',
        consultationTimeID: normalized.consultationTimeId,
        eventName: normalized.eventName,
        resourceType: mapEwlEventNameToResourceType(normalized.eventName),
        // 活動舉辦日：必須來自 EventDate（或 TargetDate）；ReservationDate 僅 fallback
        eventDate: normalized.eventDate,
        eventDateSource,
        reservationDate: normalized.reservationDate,
        startTime: normalized.startTime,
        endTime: normalized.endTime,
        hours: normalized.hours,
        timePeriodName: normalized.timePeriodName,
        location: normalized.location,
        counselorName: normalized.counselorName,
        reservationStatus: normalized.reservationStatus,
        checkInTime: normalized.checkInTime,
        sync: true
      };

      if (existing) {
        if (existing.metaJson && existing.metaJson.syncManualLock === true) {
          stats.skipped += 1;
          continue;
        }
        noteAffectedStudent(stats, normalized.studentId);
        if (dryRun) {
          stats.updated += 1;
          continue;
        }
        await existing.update(
          {
            semesterId: normalized.semesterId || existing.semesterId,
            activityType: ACTIVITY_TYPE,
            attendanceStatus: normalized.attendanceStatus,
            participatedAt: normalized.participatedAt,
            metaJson: {
              ...(existing.metaJson || {}),
              ...metaJson
            }
          },
          { transaction }
        );
        stats.updated += 1;
        continue;
      }

      const { student, wouldCreateStudent } = await loadOrPrepareStudent(
        normalized.studentId,
        normalized.studentName,
        dryRun,
        transaction
      );
      noteAffectedStudent(stats, normalized.studentId);
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
          studentId: normalized.studentId,
          semesterId: normalized.semesterId,
          eventId: normalized.eventId,
          activityType: ACTIVITY_TYPE,
          attendanceStatus: normalized.attendanceStatus,
          participatedAt: normalized.participatedAt,
          sourceRef: normalized.sourceRef,
          metaJson
        },
        { transaction }
      );
      stats.inserted += 1;
    } catch (e) {
      pushErr(stats.errors, 'EWL_ROW', e.message, {
        consultationTimeID: row?.ConsultationTimeID || null,
        studentId: row?.StudentNo || null
      });
    }
  }
}

/**
 * 從 EWL ReservationInfo（+ AttendanceInfo 簽到補強）同步至 activity_participations。
 *
 * @param {{
 *   startDate?: string,
 *   endDate?: string,
 *   studentId?: string,
 *   dryRun?: boolean,
 *   lookbackDays?: number,
 *   lookaheadDays?: number,
 *   fetchImpl?: typeof fetch,
 *   rebuildAnalytics?: boolean
 * }} opts
 */
async function syncEwlReservations(opts = {}) {
  const dryRun = opts.dryRun === true;
  // 預設不同步等待 rebuild（避免 HTTP timeout）；CLI／controller 可顯式開啟或背景觸發
  const rebuildAnalytics = opts.rebuildAnalytics === true && !dryRun;
  const window = (opts.startDate && opts.endDate)
    ? { startDate: String(opts.startDate).slice(0, 10), endDate: String(opts.endDate).slice(0, 10) }
    : defaultDateWindow(new Date(), opts.lookbackDays ?? 14, opts.lookaheadDays ?? 60);

  const query = {
    startDate: window.startDate,
    endDate: window.endDate,
    studentId: opts.studentId ? normStudentId(opts.studentId) : undefined
  };
  const fetchOpts = { fetchImpl: opts.fetchImpl };

  const [fetchResult, attendanceResult] = await Promise.all([
    fetchReservationInfo(query, fetchOpts),
    fetchAttendanceInfo(query, fetchOpts).catch(() => ({ rows: [], totalCount: 0, pagesFetched: 0 }))
  ]);
  const attendanceIndex = buildAttendanceIndex(attendanceResult.rows || []);

  const stats = emptyStats();
  const run = async (transaction) => {
    await upsertEwlRows(fetchResult.rows, dryRun, transaction, stats, attendanceIndex);
  };

  if (dryRun) {
    await run(null);
  } else {
    const t = await sequelize.transaction();
    try {
      await run(t);
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  }

  const affectedStudentIds = stats._affectedSet ? [...stats._affectedSet] : [];
  delete stats._affectedSet;
  stats.affectedStudentIds = affectedStudentIds;

  let analyticsRebuild = null;
  if (rebuildAnalytics && affectedStudentIds.length) {
    const { rebuildAnalyticsInBatches } = require('./analytics/analyticRebuildService');
    analyticsRebuild = await rebuildAnalyticsInBatches({
      scope: 'ewl-sync',
      studentIds: affectedStudentIds,
      batchSize: opts.rebuildBatchSize || 50
    });
  }

  return {
    dryRun,
    startDate: window.startDate,
    endDate: window.endDate,
    studentId: opts.studentId ? normStudentId(opts.studentId) : null,
    fetched: fetchResult.rows.length,
    reportedTotalCount: fetchResult.totalCount,
    pagesFetched: fetchResult.pagesFetched,
    attendanceFetched: attendanceResult.rows?.length || 0,
    ...stats,
    affectedStudentCount: affectedStudentIds.length,
    analyticsRebuild,
    errorCount: stats.errors.length
  };
}

module.exports = {
  SOURCE_REF_PREFIX,
  ACTIVITY_TYPE,
  defaultDateWindow,
  resolveEventDate,
  normalizeReservationRow,
  buildAttendanceIndex,
  syncEwlReservations
};
