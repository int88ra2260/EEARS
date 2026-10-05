'use strict';

jest.mock('../models', () => ({
  sequelize: {
    transaction: (fn) => fn({ id: 'tx' }),
  },
}));

jest.mock('../services/englishLearningPassport/eventPassportPointsService', () => ({
  revokePassportGrantForReservation: jest.fn().mockResolvedValue({ revoked: false }),
}));

const { revokePassportGrantForReservation } = require('../services/englishLearningPassport/eventPassportPointsService');
const { correctEventCheckin } = require('../services/checkinCorrectionService');

function makeReservation(overrides = {}) {
  const row = {
    id: 9,
    eventId: 367,
    studentId: 'A123',
    checkinStatus: '已簽到',
    checkinTime: new Date('2026-10-05T04:00:00Z'),
    countsTowardPassport: false,
    excludeFromClassCredit: false,
    passportPointsStatus: null,
    passportSubmissionId: null,
    ...overrides,
  };
  row.update = jest.fn(async (values) => {
    Object.assign(row, values);
    return row;
  });
  return row;
}

describe('correctEventCheckin', () => {
  beforeEach(() => {
    revokePassportGrantForReservation.mockClear();
  });

  it('switches a class-credit check-in to attendance without points', async () => {
    const reservation = makeReservation();
    const result = await correctEventCheckin({ reservation, mode: 'attendance_only' });

    expect(result.message).toBe('已改為到場不計點');
    expect(result.excludeFromClassCredit).toBe(true);
    expect(result.checkinStatus).toBe('已簽到');
    expect(result.countsTowardPassport).toBe(false);
    expect(revokePassportGrantForReservation).not.toHaveBeenCalled();
  });

  it('switches attendance without points back to class credit', async () => {
    const reservation = makeReservation({ excludeFromClassCredit: true });
    const result = await correctEventCheckin({ reservation, mode: 'class_credit' });

    expect(result.message).toBe('已改為計入課堂加分');
    expect(result.excludeFromClassCredit).toBe(false);
    expect(result.checkinStatus).toBe('已簽到');
  });

  it('undo returns the reservation to the pending list and revokes granted passport points', async () => {
    const reservation = makeReservation({
      countsTowardPassport: true,
      passportPointsStatus: 'granted',
      passportSubmissionId: 44,
    });
    const result = await correctEventCheckin({ reservation, mode: 'undo' });

    expect(result.checkinStatus).toBe('未簽到');
    expect(result.checkinTime).toBeNull();
    expect(result.countsTowardPassport).toBe(false);
    expect(revokePassportGrantForReservation).toHaveBeenCalledWith(expect.objectContaining({
      reservation,
      transaction: { id: 'tx' },
    }));
  });

  it('rejects correcting a reservation that is not checked in', async () => {
    const reservation = makeReservation({ checkinStatus: '未簽到' });
    await expect(correctEventCheckin({ reservation, mode: 'undo' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rejects switching to the mode that is already set', async () => {
    await expect(correctEventCheckin({
      reservation: makeReservation({ excludeFromClassCredit: true }),
      mode: 'attendance_only',
    })).rejects.toMatchObject({ status: 400 });
  });
});
