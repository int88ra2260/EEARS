import { matchCheckinQuery, normalizeStudentId } from './checkinKioskMatch';

describe('normalizeStudentId', () => {
  it('trims, uppercases, and strips spaces', () => {
    expect(normalizeStudentId(' f1 23456 ')).toBe('F123456');
  });
});

describe('matchCheckinQuery', () => {
  const rows = [
    { id: 1, studentId: 'F123456', studentName: '王小明', checkinStatus: '未簽到' },
    { id: 2, studentId: 'F234567', studentName: '李小華', checkinStatus: '已簽到' },
    { id: 3, studentId: 'F345678', studentName: '王大同', checkinStatus: '未簽到' },
    { id: 4, studentId: 'B111111', studentName: '張三', checkinStatus: '已登記違規' },
  ];

  it('returns empty_query for blank input', () => {
    expect(matchCheckinQuery(rows, '  ').kind).toBe('empty_query');
  });

  it('exact pending by student id (scanner case)', () => {
    const result = matchCheckinQuery(rows, 'f123456');
    expect(result.kind).toBe('exact_pending');
    expect(result.pending[0].id).toBe(1);
  });

  it('exact done by student id', () => {
    const result = matchCheckinQuery(rows, 'F234567');
    expect(result.kind).toBe('exact_done');
    expect(result.done[0].id).toBe(2);
  });

  it('exact violation by student id', () => {
    const result = matchCheckinQuery(rows, 'B111111');
    expect(result.kind).toBe('exact_violation');
  });

  it('name partial match with multiple pending → ambiguous', () => {
    const result = matchCheckinQuery(rows, '王');
    expect(result.kind).toBe('ambiguous');
    expect(result.pending.map((r) => r.id)).toEqual([1, 3]);
  });

  it('returns none when no match', () => {
    expect(matchCheckinQuery(rows, 'ZZZZ').kind).toBe('none');
  });

  it('matches booking code to reservation id', () => {
    const result = matchCheckinQuery(rows, 'R-000001');
    expect(result.kind).toBe('exact_pending');
    expect(result.pending[0].id).toBe(1);
  });
});
