'use strict';

const { Settings } = require('../models');
const {
  isReservationSuccessCheckinQrEnabled,
  setReservationSuccessCheckinQrEnabled,
  RESERVATION_SUCCESS_CHECKIN_QR_KEY,
} = require('../services/reservationCheckinQrSettings');

jest.mock('../models', () => ({
  Settings: {
    findOne: jest.fn(),
    findOrCreate: jest.fn(),
  },
}));

describe('reservationCheckinQrSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('defaults to off when the setting is missing', async () => {
    Settings.findOne.mockResolvedValue(null);
    await expect(isReservationSuccessCheckinQrEnabled()).resolves.toBe(false);
  });

  test('reads the stored boolean', async () => {
    Settings.findOne.mockResolvedValue({ valueBool: true, value: 'true' });
    await expect(isReservationSuccessCheckinQrEnabled()).resolves.toBe(true);
  });

  test('stores the switch', async () => {
    const update = jest.fn();
    Settings.findOrCreate.mockResolvedValue([{ update }, false]);
    await expect(setReservationSuccessCheckinQrEnabled(true)).resolves.toBe(true);
    expect(Settings.findOrCreate).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: RESERVATION_SUCCESS_CHECKIN_QR_KEY },
    }));
    expect(update).toHaveBeenCalledWith({ value: 'true', valueBool: true });
  });
});
