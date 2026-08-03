const {
  KEYS,
  parseSettingBool,
  isIndividualRegistrationEnabled,
  isGroupRegistrationEnabled,
  setGroupRegistrationEnabled,
} = require('../services/registrationSettingsService');

jest.mock('../models', () => ({
  Settings: {
    findOne: jest.fn(),
    findOrCreate: jest.fn(),
  },
}));

const { Settings } = require('../models');

describe('registrationSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseSettingBool', () => {
    it('uses valueBool when present', () => {
      expect(parseSettingBool({ valueBool: false, value: 'true' }, true)).toBe(false);
    });

    it('falls back to value string', () => {
      expect(parseSettingBool({ valueBool: null, value: 'false' }, true)).toBe(false);
    });

    it('uses default when setting missing', () => {
      expect(parseSettingBool(null, true)).toBe(true);
    });
  });

  describe('isGroupRegistrationEnabled', () => {
    it('prefers group key over learning partner key', async () => {
      Settings.findOne.mockImplementation(async ({ where }) => {
        if (where.key === KEYS.GROUP) {
          return { valueBool: false, value: 'false' };
        }
        if (where.key === KEYS.LEARNING_PARTNER) {
          return { valueBool: true, value: 'true' };
        }
        return null;
      });

      await expect(isGroupRegistrationEnabled()).resolves.toBe(false);
      expect(Settings.findOne).toHaveBeenCalledWith({ where: { key: KEYS.GROUP } });
    });

    it('falls back to learning partner key when group key absent', async () => {
      Settings.findOne.mockImplementation(async ({ where }) => {
        if (where.key === KEYS.GROUP) return null;
        if (where.key === KEYS.LEARNING_PARTNER) {
          return { valueBool: false, value: 'false' };
        }
        return null;
      });

      await expect(isGroupRegistrationEnabled()).resolves.toBe(false);
    });
  });

  describe('isIndividualRegistrationEnabled', () => {
    it('reads individual key', async () => {
      Settings.findOne.mockResolvedValue({ valueBool: false, value: 'false' });
      await expect(isIndividualRegistrationEnabled()).resolves.toBe(false);
      expect(Settings.findOne).toHaveBeenCalledWith({ where: { key: KEYS.INDIVIDUAL } });
    });
  });

  describe('setGroupRegistrationEnabled', () => {
    it('writes both group and learning partner keys', async () => {
      const mockUpdate = jest.fn();
      Settings.findOrCreate.mockResolvedValue([{ update: mockUpdate }, true]);

      await setGroupRegistrationEnabled(false);

      expect(Settings.findOrCreate).toHaveBeenCalledTimes(2);
      expect(Settings.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: KEYS.GROUP } }),
      );
      expect(Settings.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: KEYS.LEARNING_PARTNER } }),
      );
    });
  });
});
