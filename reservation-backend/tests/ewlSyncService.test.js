'use strict';

const {
  normalizeReservationRow,
  resolveEventDate,
  buildAttendanceIndex,
  defaultDateWindow,
  ACTIVITY_TYPE,
  SOURCE_REF_PREFIX,
  isCancelledReservationStatus,
  mergeDurationFields,
  resolveSyncedAttendance,
  planMissingCancellations
} = require('../services/learningJourney/ewlSyncService');
const { buildUrl, fetchAllEwlRows } = require('../services/learningJourney/ewlApiClient');

describe('ewlApiClient', () => {
  it('buildUrl omits empty studentId', () => {
    const url = buildUrl('ReservationInfo', {
      startDate: '2024-12-01',
      endDate: '2024-12-31',
      page: 1,
      pageSize: 10
    });
    expect(url).toContain('/ReservationInfo?');
    expect(url).toContain('startDate=2024-12-01');
    expect(url).not.toContain('studentId=');
  });

  it('fetchAllEwlRows paginates until totalPages', async () => {
    const calls = [];
    const fetchImpl = jest.fn(async (url) => {
      calls.push(url);
      const u = new URL(url);
      const page = Number(u.searchParams.get('page') || 1);
      return {
        ok: true,
        json: async () => ({
          success: true,
          totalCount: 3,
          totalPages: 2,
          currentPage: page,
          pageSize: 2,
          needsPagination: page < 2,
          data: page === 1
            ? [{ ConsultationTimeID: 1 }, { ConsultationTimeID: 2 }]
            : [{ ConsultationTimeID: 3 }]
        })
      };
    });

    const result = await fetchAllEwlRows(
      'ReservationInfo',
      { startDate: '2024-12-01', endDate: '2024-12-31', pageSize: 2 },
      { fetchImpl }
    );
    expect(result.totalCount).toBe(3);
    expect(result.pagesFetched).toBe(2);
    expect(result.rows).toHaveLength(3);
    expect(result.complete).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('ewlSyncService helpers', () => {
  it('normalizeReservationRow builds ids and attended status', () => {
    const row = normalizeReservationRow({
      ConsultationTimeID: 4637,
      StudentNo: 'b132025012',
      StudentName: '測試生',
      EventName: '實體一對一諮詢',
      EventDate: '2024-12-27',
      ReservationDate: '2024-12-20',
      StartTime: '16:00:00',
      EndTime: '17:00:00',
      CheckInTime: '2024-12-27 15:58:48',
      ReservationStatus: '申請',
      CounselorName: 'Savannah'
    });
    expect(row).toMatchObject({
      consultationTimeId: 4637,
      studentId: 'B132025012',
      eventId: 'ewl-4637',
      sourceRef: `${SOURCE_REF_PREFIX}:4637`,
      eventDate: '2024-12-27',
      reservationDate: '2024-12-20',
      hours: 1,
      attendanceStatus: 'attended'
    });
    expect(row.participatedAt).toBeInstanceOf(Date);
    expect(row.semesterId).toBeTruthy();
  });

  it('resolveEventDate prefers EventDate over ReservationDate (signup day)', () => {
    // B127610017 / 謝書宇：報名 2024-03-04，活動 EventDate 2024-03-06
    expect(resolveEventDate({
      ReservationDate: '2024-03-04',
      EventDate: '2024-03-06 00:00:00'
    })).toBe('2024-03-06');
    expect(resolveEventDate({
      ReservationDate: '2024-02-27',
      TargetDate: '2024-03-04',
      EventDate: null
    })).toBe('2024-03-04');
    expect(resolveEventDate({ ReservationDate: '2024-03-04' })).toBe('2024-03-04');
  });

  it('normalizeReservationRow never treats signup day as activity day when EventDate exists (Bai Yiqiao)', () => {
    const row = normalizeReservationRow({
      ConsultationTimeID: 2655,
      StudentNo: 'B127610031',
      StudentName: '白宜巧',
      EventName: '實體一對一諮詢',
      ReservationDate: '2024-02-27',
      EventDate: '2024-03-04 00:00:00',
      StartTime: '16:00:00',
      EndTime: '17:00:00'
    });
    expect(row.eventDate).toBe('2024-03-04');
    expect(row.reservationDate).toBe('2024-02-27');
  });

  it('normalizeReservationRow uses EventDate as activity day, not signup ReservationDate', () => {
    const row = normalizeReservationRow({
      ConsultationTimeID: 2635,
      StudentNo: 'B127610017',
      StudentName: '謝書宇',
      EventName: '工作坊',
      ReservationDate: '2024-03-04',
      EventDate: '2024-03-06 00:00:00',
      StartTime: '18:00:00',
      EndTime: '21:00:00',
      TimePeriodName: '工作坊時段',
      ReservationStatus: '申請'
    });
    expect(row.eventDate).toBe('2024-03-06');
    expect(row.reservationDate).toBe('2024-03-04');
    expect(row.hours).toBe(3);
    expect(row.attendanceStatus).toBe('registered');
  });

  it('normalizeReservationRow merges AttendanceInfo CheckInTime', () => {
    const index = buildAttendanceIndex([
      {
        StudentNo: 'B127610017',
        EventName: '工作坊',
        EventDate: '2024-03-06',
        TimePeriodName: '工作坊時段',
        CheckInTime: '2024-03-07 21:13:55',
        IsCheckedIn: true
      }
    ]);
    const row = normalizeReservationRow(
      {
        ConsultationTimeID: 2635,
        StudentNo: 'B127610017',
        EventName: '工作坊',
        ReservationDate: '2024-03-04',
        EventDate: '2024-03-06',
        TimePeriodName: '工作坊時段'
      },
      index
    );
    expect(row.eventDate).toBe('2024-03-06');
    expect(row.attendanceStatus).toBe('attended');
    expect(row.checkInTime).toBe('2024-03-07 21:13:55');
    expect(row.participatedAt).toBeInstanceOf(Date);
  });

  it('defaultDateWindow spans lookback and lookahead', () => {
    const now = new Date(2024, 11, 15); // local 2024-12-15；不在學期表內，維持 14 天回溯
    const w = defaultDateWindow(now, 14, 60);
    expect(w.startDate).toBe('2024-12-01');
    expect(w.endDate).toBe('2025-02-13');
  });

  it('defaultDateWindow reaches the current semester start so class-credit hours stay in range', () => {
    const now = new Date(2026, 9, 23); // 2026-10-23，115-1 自 2026-08-01
    const w = defaultDateWindow(now, 14, 60);
    expect(w.startDate).toBe('2026-08-01');
    expect(w.endDate).toBe('2026-12-22');
  });

  it('normalizeReservationRow marks registered when no check-in', () => {
    const row = normalizeReservationRow({
      ConsultationTimeID: 1,
      StudentNo: 'B111111111',
      EventDate: '2024-12-01',
      ReservationDate: '2024-11-28',
      EventName: '諮詢',
      CheckInTime: ''
    });
    expect(row.attendanceStatus).toBe('registered');
    expect(row.participatedAt).toBeNull();
    expect(row.eventDate).toBe('2024-12-01');
  });

  it('normalizeReservationRow skips invalid rows', () => {
    expect(normalizeReservationRow({ StudentNo: 'B1' })).toBeNull();
    expect(normalizeReservationRow({ ConsultationTimeID: 1 })).toBeNull();
  });

  it('cancelled reservation status drops attendance even when a check-in exists', () => {
    expect(isCancelledReservationStatus('已取消')).toBe(true);
    expect(isCancelledReservationStatus('Cancelled')).toBe(true);
    expect(isCancelledReservationStatus('申請')).toBe(false);
    const row = normalizeReservationRow({
      ConsultationTimeID: 9,
      StudentNo: 'B111111111',
      EventDate: '2026-10-22',
      EventName: '實體一對一諮詢',
      StartTime: '16:00:00',
      EndTime: '17:00:00',
      CheckInTime: '2026-10-22 16:01:00',
      ReservationStatus: '已取消'
    });
    expect(row.attendanceStatus).toBe('cancelled');
    expect(row.participatedAt).toBeNull();
    expect(row.hours).toBe(1);
  });

  it('does not copy a check-in across two sessions on the same day', () => {
    const index = buildAttendanceIndex([
      {
        StudentNo: 'B111111111',
        EventName: '實體一對一諮詢',
        EventDate: '2026-10-22',
        TimePeriodName: '上午',
        CheckInTime: '2026-10-22 10:00:00',
        IsCheckedIn: true
      },
      {
        StudentNo: 'B111111111',
        EventName: '實體一對一諮詢',
        EventDate: '2026-10-22',
        TimePeriodName: '下午',
        CheckInTime: '2026-10-22 16:00:00',
        IsCheckedIn: true
      }
    ]);
    const row = normalizeReservationRow({
      ConsultationTimeID: 11,
      StudentNo: 'B111111111',
      EventName: '實體一對一諮詢',
      EventDate: '2026-10-22',
      TimePeriodName: '晚上',
      StartTime: '19:00:00',
      EndTime: '20:00:00'
    }, index);
    expect(row.attendanceStatus).toBe('registered');
    expect(row.checkInTime).toBeNull();
  });

  it('keeps a single same-day check-in when the time-period label differs', () => {
    const index = buildAttendanceIndex([
      {
        StudentNo: 'B111111111',
        EventName: '工作坊',
        EventDate: '2026-10-22',
        TimePeriodName: '工作坊時段',
        CheckInTime: '2026-10-22 18:05:00',
        IsCheckedIn: true
      }
    ]);
    const row = normalizeReservationRow({
      ConsultationTimeID: 12,
      StudentNo: 'B111111111',
      EventName: '工作坊',
      EventDate: '2026-10-22',
      TimePeriodName: '晚間場',
      StartTime: '18:00:00',
      EndTime: '21:00:00'
    }, index);
    expect(row.attendanceStatus).toBe('attended');
    expect(row.hours).toBe(3);
  });

  it('mergeDurationFields keeps prior hours when the new payload has no times', () => {
    const merged = mergeDurationFields(
      { startTime: '16:00:00', endTime: '17:30:00', hours: 1.5 },
      { startTime: null, endTime: null, hours: null }
    );
    expect(merged).toEqual({ startTime: '16:00:00', endTime: '17:30:00', hours: 1.5 });
  });

  it('resolveSyncedAttendance keeps attended hours when the check-in feed failed', () => {
    const kept = resolveSyncedAttendance(
      { attendanceStatus: 'registered', participatedAt: null },
      { attendanceStatus: 'attended', participatedAt: new Date('2026-10-22T08:00:00Z') },
      false
    );
    expect(kept.attendanceStatus).toBe('attended');
    const cleared = resolveSyncedAttendance(
      { attendanceStatus: 'cancelled', participatedAt: null },
      { attendanceStatus: 'attended', participatedAt: new Date('2026-10-22T08:00:00Z') },
      false
    );
    expect(cleared.attendanceStatus).toBe('cancelled');
    expect(cleared.participatedAt).toBeNull();
  });

  it('planMissingCancellations withdraws in-window rows the workshop no longer returns', () => {
    const rows = [
      {
        sourceRef: 'ewl_api:1',
        attendanceStatus: 'attended',
        metaJson: { eventDate: '2026-10-20', hours: 1 }
      },
      {
        sourceRef: 'ewl_api:2',
        attendanceStatus: 'attended',
        metaJson: { eventDate: '2026-10-21', syncManualLock: true }
      },
      {
        sourceRef: 'ewl_api:3',
        attendanceStatus: 'cancelled',
        metaJson: { eventDate: '2026-10-21' }
      },
      {
        sourceRef: 'ewl_api:4',
        attendanceStatus: 'attended',
        metaJson: { eventDate: '2026-05-01' }
      }
    ];
    const planned = planMissingCancellations(
      rows,
      new Set(['ewl_api:9']),
      '2026-08-01',
      '2026-12-22'
    );
    expect(planned.map((row) => row.sourceRef)).toEqual(['ewl_api:1']);
  });

  it('ACTIVITY_TYPE is EWL', () => {
    expect(ACTIVITY_TYPE).toBe('EWL');
  });
});
