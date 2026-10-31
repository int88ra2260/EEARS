'use strict';

jest.mock('../models', () => {
  const sequelize = {
    where: jest.fn((left, right) => ({ left, right })),
    fn: jest.fn((name, ...args) => ({ fn: name, args })),
    col: jest.fn((name) => ({ col: name })),
  };
  return {
    Teacher: {
      findAll: jest.fn(),
      findOne: jest.fn(),
    },
    sequelize,
  };
});

const { Teacher } = require('../models');
const { resolveTeacherFromSsoProfile } = require('../services/adminSsoAuthService');

function teacherRow(overrides) {
  return {
    id: 1,
    name: '王小明',
    username: 'teacher1',
    email: 'ming@mail.nsysu.edu.tw',
    isActive: true,
    ...overrides,
  };
}

describe('resolveTeacherFromSsoProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('以員工編號對應已建檔 username', async () => {
    const target = teacherRow({ id: 9, username: 'A1120323', name: '別的顯示名' });
    Teacher.findOne.mockResolvedValueOnce(target);

    const result = await resolveTeacherFromSsoProfile({
      EMPNO: 'A1120323',
      NAME: '王小明',
      EMAIL: 'other@mail.nsysu.edu.tw',
    }, 'A1120323');

    expect(result).toEqual({ teacher: target, matchBy: 'empno' });
    expect(Teacher.findAll).not.toHaveBeenCalled();
  });

  it('員編對不到時改以信箱對應已建檔帳號', async () => {
    Teacher.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(teacherRow({ id: 3, email: 'ming@mail.nsysu.edu.tw' }));

    const result = await resolveTeacherFromSsoProfile({
      EMPNO: 'A1120323',
      NAME: '王小明',
      EMAIL: 'ming@mail.nsysu.edu.tw',
    }, 'A1120323');

    expect(result).toEqual({
      teacher: expect.objectContaining({ id: 3 }),
      matchBy: 'email',
    });
  });

  it('不因同名就對應到中心帳號（避免外單位同名誤入）', async () => {
    Teacher.findOne.mockResolvedValue(null);

    const result = await resolveTeacherFromSsoProfile({
      EMPNO: 'A9999999',
      NAME: '王小明',
      EMAIL: 'outsider@mail.nsysu.edu.tw',
    }, 'A9999999');

    expect(result).toBeNull();
    expect(Teacher.findAll).not.toHaveBeenCalled();
  });

  it('系統尚未建檔時回傳 null（不自動開通）', async () => {
    Teacher.findOne.mockResolvedValue(null);

    const result = await resolveTeacherFromSsoProfile({
      EMPNO: 'A1120323',
      NAME: '王小明',
      EMAIL: 'none@mail.nsysu.edu.tw',
    }, 'A1120323');

    expect(result).toBeNull();
  });
});
