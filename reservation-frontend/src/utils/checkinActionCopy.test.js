import { buildCheckinConfirm, buildCorrectionConfirm } from './checkinActionCopy';

const reservation = {
  studentId: 'A12345678',
  studentName: '王小明',
};

describe('buildCheckinConfirm', () => {
  test('一般補簽到會寫明計入課堂加分', () => {
    const copy = buildCheckinConfirm({
      reservation,
      isBackdate: true,
      eventDate: '2026-10-05',
    });
    expect(copy.title).toBe('確認補簽到？');
    expect(copy.description).toContain('王小明');
    expect(copy.consequence).toContain('計入課堂加分');
    expect(copy.consequence).toContain('2026-10-05');
    expect(copy.confirmText).toBe('確認補簽到');
  });

  test('到場不計點會寫明不計課堂加分', () => {
    const copy = buildCheckinConfirm({
      reservation,
      excludeFromClassCredit: true,
    });
    expect(copy.title).toBe('確認到場不計點？');
    expect(copy.consequence).toContain('不計課堂加分');
    expect(copy.confirmText).toBe('確認到場不計點');
  });
});

describe('buildCorrectionConfirm', () => {
  test('取消簽到會說明可以重選，並提醒收回護照點數', () => {
    const copy = buildCorrectionConfirm({
      reservation: { ...reservation, passportPointsStatus: 'granted' },
      mode: 'undo',
    });
    expect(copy.confirmText).toBe('取消簽到');
    expect(copy.consequence).toContain('回到待簽到');
    expect(copy.consequence).toContain('護照點數會收回');
  });

  test('改計課堂加分', () => {
    const copy = buildCorrectionConfirm({ reservation, mode: 'class_credit' });
    expect(copy.confirmText).toBe('改計課堂加分');
    expect(copy.consequence).toContain('計入課堂加分');
  });
});
