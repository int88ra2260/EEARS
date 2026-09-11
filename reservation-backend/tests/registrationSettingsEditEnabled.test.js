jest.mock('../models', () => ({
  Settings: {
    findOne: jest.fn(),
    findOrCreate: jest.fn(),
  },
}));

const { Settings } = require('../models');
const {
  KEYS,
  isRegistrationEditEnabled,
  setRegistrationEditEnabled,
} = require('../services/registrationSettingsService');

describe('registrationSettingsService edit switch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults edit enabled to true when unset', async () => {
    Settings.findOne.mockResolvedValue(null);
    await expect(isRegistrationEditEnabled()).resolves.toBe(true);
    expect(Settings.findOne).toHaveBeenCalledWith({ where: { key: KEYS.EDIT } });
  });

  it('reads false from valueBool', async () => {
    Settings.findOne.mockResolvedValue({ value: 'false', valueBool: false });
    await expect(isRegistrationEditEnabled()).resolves.toBe(false);
  });

  it('setRegistrationEditEnabled upserts EDIT key', async () => {
    const instance = { update: jest.fn() };
    Settings.findOrCreate.mockResolvedValue([instance, true]);
    await expect(setRegistrationEditEnabled(false)).resolves.toBe(false);
    expect(Settings.findOrCreate).toHaveBeenCalledWith({
      where: { key: KEYS.EDIT },
      defaults: { value: 'false', valueBool: false },
    });
  });
});
