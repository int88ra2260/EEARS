import { sortAdminReservations } from './adminReservationListSort';

describe('adminReservationListSort', () => {
  const rows = [
    { id: 1, studentId: 'B2', studentName: '乙', group: 'Group 10', checkinStatus: '未簽到' },
    { id: 2, studentId: 'B1', studentName: '甲', group: 'Group 2', checkinStatus: '已簽到' },
    { id: 3, studentId: 'B3', studentName: '丙', group: null, checkinStatus: '已登記違規' },
    { id: 4, studentId: 'B4', studentName: '丁', group: 'Group 2-overflow', checkinStatus: '已簽到' },
    { id: 5, studentId: 'B5', studentName: '戊', group: 'Group 1', checkinStatus: '未簽到' },
  ];

  it('sorts groups by number, with overflow after the same group and blanks last', () => {
    const asc = sortAdminReservations(rows, 'group', 'asc').map((r) => r.id);
    expect(asc).toEqual([5, 2, 4, 1, 3]);

    const desc = sortAdminReservations(rows, 'group', 'desc').map((r) => r.id);
    expect(desc).toEqual([1, 4, 2, 5, 3]);
  });

  it('keeps student id, name, and check-in status sorts', () => {
    expect(sortAdminReservations(rows, 'studentId', 'asc').map((r) => r.id)).toEqual([2, 1, 3, 4, 5]);
    expect(sortAdminReservations(rows, 'name', 'asc').map((r) => r.studentName)).toEqual(['丁', '丙', '乙', '戊', '甲']);
    expect(sortAdminReservations(rows, 'checkinStatus', 'asc').map((r) => r.checkinStatus)).toEqual([
      '已簽到',
      '已簽到',
      '未簽到',
      '未簽到',
      '已登記違規',
    ]);
  });
});
