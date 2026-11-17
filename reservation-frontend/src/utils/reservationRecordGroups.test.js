import dayjs from 'dayjs';
import { describe, expect, test } from 'vitest';
import {
  buildReservationSemesterViews,
  isReservationEventEnded,
  reservationTiming,
} from './reservationRecordGroups';
import { getCurrentSemester } from './semesterUtils';

describe('reservationRecordGroups', () => {
  const now = dayjs('2026-11-17T12:00:00');

  test('活動結束後才算已結束，進行中仍可出示', () => {
    const during = {
      date: '2026-11-17',
      startTime: '10:00',
      endTime: '13:00',
    };
    const finished = {
      date: '2026-11-17',
      startTime: '08:00',
      endTime: '09:00',
    };
    expect(isReservationEventEnded(during, now)).toBe(false);
    expect(reservationTiming(during, now)).toBe('in_progress');
    expect(isReservationEventEnded(finished, now)).toBe(true);
    expect(reservationTiming(finished, now)).toBe('ended');
  });

  test('本學期沒有預約時仍留在本學期，舊紀錄分到自己的學期', () => {
    const views = buildReservationSemesterViews([
      {
        id: 1,
        date: '2025-05-22',
        startTime: '12:10',
        endTime: '12:40',
      },
    ], now);
    const current = views.find((view) => view.isCurrent);
    expect(current.id).toBe(getCurrentSemester());
    expect(current.records).toHaveLength(0);
    const past = views.find((view) => view.id === '113-2');
    expect(past.ended).toHaveLength(1);
    expect(past.upcoming).toHaveLength(0);
    expect(views[0].id).toBe(current.id);
  });
});
