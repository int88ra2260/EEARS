import {
  applyCapacityFieldChange,
  getDefaultCapacityFields,
  computeTotalCapacity,
} from './eventCapacityFields';

describe('applyCapacityFieldChange (ET 組/人 輸入)', () => {
  const base = getDefaultCapacityFields('English Table');

  test('預設為 9 × 4 = 36', () => {
    expect(base).toEqual({
      groupCount: 9,
      perGroupCapacity: 4,
      maxParticipants: 36,
    });
    expect(computeTotalCapacity(base.groupCount, base.perGroupCapacity)).toBe(36);
  });

  test('可輸入組數（模擬鍵盤）', () => {
    let next = applyCapacityFieldChange(base, 'groupCount', '', 'English Table');
    expect(next.groupCount).toBe('');

    next = applyCapacityFieldChange(next, 'groupCount', '1', 'English Table');
    expect(next.groupCount).toBe(1);

    next = applyCapacityFieldChange(next, 'groupCount', '12', 'English Table');
    expect(next.groupCount).toBe(12);
    expect(next.maxParticipants).toBe(48);
  });

  test('可輸入每組人數（模擬鍵盤）', () => {
    let next = applyCapacityFieldChange(base, 'perGroupCapacity', '5', 'English Table');
    expect(next.perGroupCapacity).toBe(5);
    expect(next.maxParticipants).toBe(45);
  });

  test('可使用箭頭加減（模擬 spinner onChange）', () => {
    let next = applyCapacityFieldChange(base, 'groupCount', '10', 'English Table');
    expect(next.groupCount).toBe(10);

    next = applyCapacityFieldChange(next, 'groupCount', '9', 'English Table');
    expect(next.groupCount).toBe(9);

    next = applyCapacityFieldChange(next, 'perGroupCapacity', '5', 'English Table');
    expect(next.perGroupCapacity).toBe(5);
    expect(next.maxParticipants).toBe(45);
  });

  test('超出上限會被夾住，但仍可輸入', () => {
    const next = applyCapacityFieldChange(base, 'groupCount', '99', 'English Table');
    expect(next.groupCount).toBe(20);
  });

  test('undefined 欄位不會卡住：補預設後仍可改', () => {
    const broken = { eventType: 'English Table' };
    const patched = { ...getDefaultCapacityFields('English Table'), ...broken };
    const next = applyCapacityFieldChange(patched, 'groupCount', '8', 'English Table');
    expect(next.groupCount).toBe(8);
    expect(next.perGroupCapacity).toBe(4);
    expect(next.maxParticipants).toBe(32);
  });
});
