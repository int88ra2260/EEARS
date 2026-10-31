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

  it('優先以姓名唯一對應', async () => {
    const target = teacherRow({ id: 7, name: '王小明', username: 'other' });
    Teacher.findAll.mockResolvedValue([
      target,
      teacherRow({ id: 8, name: '李大同', username: 'A1120323' }),
    ]);

    const result = await resolveTeacherFromSsoProfile({
      EMPNO: 'A1120323',
      NAME: '王 小明',
      EMAIL: 'someone@mail.nsysu.edu.tw',
    }, 'A1120323');

    expect(result).toEqual({ teacher: target, matchBy: 'name' });
    expect(Teacher.findOne).not.toHaveBeenCalled();
  });

  it('同名多筆時以員工編號消歧', async () => {
    const a = teacherRow({ id: 1, name: '王小明', username: 'A1111111', email: 'a@mail.nsysu.edu.tw' });
    const b = teacherRow({ id: 2, name: '王小明', username: 'A1120323', email: 'b@mail.nsysu.edu.tw' });
    Teacher.findAll.mockResolvedValue([a, b]);

    const result = await resolveTeacherFromSsoProfile({
      EMPNO: 'A1120323',
      NAME: '王小明',
      EMAIL: 'b@mail.nsysu.edu.tw',
    }, 'A1120323');

    expect(result).toEqual({ teacher: b, matchBy: 'name+empno' });
  });

  it('同名多筆且員編對不上時改用信箱消歧', async () => {
    const a = teacherRow({ id: 1, name: '王小明', username: 'x1', email: 'a@mail.nsysu.edu.tw' });
    const b = teacherRow({ id: 2, name: '王小明', username: 'x2', email: 'b@mail.nsysu.edu.tw' });
    Teacher.findAll.mockResolvedValue([a, b]);

    const result = await resolveTeacherFromSsoProfile({
      EMPNO: 'A9999999',
      NAME: '王小明',
      EMAIL: 'b@mail.nsysu.edu.tw',
    }, 'A9999999');

    expect(result).toEqual({ teacher: b, matchBy: 'name+email' });
  });

  it('同名多筆且無法消歧時拋 ACCOUNT_AMBIGUOUS', async () => {
    Teacher.findAll.mockResolvedValue([
      teacherRow({ id: 1, name: '王小明', username: 'x1', email: 'a@mail.nsysu.edu.tw' }),
      teacherRow({ id: 2, name: '王小明', username: 'x2', email: 'c@mail.nsysu.edu.tw' }),
    ]);

    await expect(resolveTeacherFromSsoProfile({
      EMPNO: 'A9999999',
      NAME: '王小明',
      EMAIL: 'missing@mail.nsysu.edu.tw',
    }, 'A9999999')).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_AMBIGUOUS',
    });
  });

  it('姓名對不到時改以員工編號對應 username', async () => {
    Teacher.findAll.mockResolvedValue([
      teacherRow({ id: 1, name: '李大同', username: 'A1120323' }),
    ]);
    const target = teacherRow({ id: 9, name: '別的名字', username: 'A1120323' });
    Teacher.findOne.mockResolvedValueOnce(target);

    const result = await resolveTeacherFromSsoProfile({
      EMPNO: 'A1120323',
      NAME: '王小明',
      EMAIL: 'ming@mail.nsysu.edu.tw',
    }, 'A1120323');

    expect(result).toEqual({ teacher: target, matchBy: 'empno' });
  });

  it('姓名與員編都對不到時改以信箱對應', async () => {
    Teacher.findAll.mockResolvedValue([]);
    Teacher.findOne
      .mockResolvedValueOnce(null) // empno
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

  it('全部對不到回傳 null', async () => {
    Teacher.findAll.mockResolvedValue([]);
    Teacher.findOne.mockResolvedValue(null);

    const result = await resolveTeacherFromSsoProfile({
      EMPNO: 'A1120323',
      NAME: '王小明',
      EMAIL: 'none@mail.nsysu.edu.tw',
    }, 'A1120323');

    expect(result).toBeNull();
  });
});
