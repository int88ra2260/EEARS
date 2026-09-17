jest.mock('../models', () => ({
  Settings: {
    findOne: jest.fn(),
    findOrCreate: jest.fn(),
  },
}));

const { Settings } = require('../models');
const {
  KEYS,
  INVALID_REGISTRATION_WINDOW_PAIR_MESSAGE,
  assertValidRegistrationWindowPair,
  isRegistrationEditEnabled,
  setRegistrationEditEnabled,
  setIndividualRegistrationEnabled,
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
    Settings.findOne.mockResolvedValue({ value: 'false', valueBool: false });
    const instance = { update: jest.fn() };
    Settings.findOrCreate.mockResolvedValue([instance, true]);
    await expect(setRegistrationEditEnabled(false)).resolves.toBe(false);
    expect(Settings.findOrCreate).toHaveBeenCalledWith({
      where: { key: KEYS.EDIT },
      defaults: { value: 'false', valueBool: false },
    });
  });

  it('rejects invalid window pair: individual on + edit off', () => {
    expect(() => assertValidRegistrationWindowPair(true, false)).toThrow(
      INVALID_REGISTRATION_WINDOW_PAIR_MESSAGE
    );
  });

  it('allows both on, edit-only, and both off', () => {
    expect(() => assertValidRegistrationWindowPair(true, true)).not.toThrow();
    expect(() => assertValidRegistrationWindowPair(false, true)).not.toThrow();
    expect(() => assertValidRegistrationWindowPair(false, false)).not.toThrow();
  });

  it('refuses to open individual while edit is off', async () => {
    Settings.findOne.mockResolvedValue({ value: 'false', valueBool: false });
    await expect(setIndividualRegistrationEnabled(true)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REGISTRATION_WINDOW_PAIR',
    });
    expect(Settings.findOrCreate).not.toHaveBeenCalled();
  });

  it('refuses to close edit while individual is on', async () => {
    Settings.findOne.mockResolvedValue({ value: 'true', valueBool: true });
    await expect(setRegistrationEditEnabled(false)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_REGISTRATION_WINDOW_PAIR',
    });
    expect(Settings.findOrCreate).not.toHaveBeenCalled();
  });
});
