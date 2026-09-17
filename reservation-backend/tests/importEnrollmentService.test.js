'use strict';

/**
 * importEnrollmentService 單元測試：mock models + transaction（無實際 DB）
 */

const XLSX = require('xlsx');

const mockTransaction = {};

jest.mock('../models', () => ({
  sequelize: {
    transaction: jest.fn(async (fn) => fn(mockTransaction)),
    query: jest.fn(),
  },
  Student: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  EtEnrollmentSnapshot: {
    findOrCreate: jest.fn(),
  },
}));

const {
  sequelize,
  Student,
  EtEnrollmentSnapshot,
} = require('../models');
const { importEnrollment } = require('../services/learningJourney/importEnrollmentService');

function bufferFromMatrix(rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function headerRow() {
  return ['系所', '學院', '班別', '年級', '學號', '姓名'];
}

function dataRow({
  department = '外文系',
  college = '文學院',
  className = 'A',
  grade = '2',
  studentId = 'B10901001',
  studentName = '王小明',
} = {}) {
  return [department, college, className, grade, studentId, studentName];
}

describe('importEnrollmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockImplementation(async (fn) => fn(mockTransaction));
    sequelize.query.mockResolvedValue([[], {}]);
    Student.findOne.mockResolvedValue(null);
    Student.create.mockResolvedValue({});
    EtEnrollmentSnapshot.findOrCreate.mockResolvedValue([
      { update: jest.fn() },
      true,
    ]);
  });

  test('缺少 semesterId → ok:false', async () => {
    const buf = bufferFromMatrix([headerRow(), dataRow()]);
    const res = await importEnrollment(buf, '');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/semesterId/);
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  test('新學期匯入前會先 upsert et_semesters（避免 FK 500）', async () => {
    const buf = bufferFromMatrix([headerRow(), dataRow()]);
    const res = await importEnrollment(buf, '115-1', { batchId: 'ljv3:enrollment:test' });

    expect(res.ok).toBe(true);
    expect(res.imported).toBe(1);
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO et_semesters'),
      expect.objectContaining({
        replacements: expect.objectContaining({ id: '115-1', code: '115-1' }),
        transaction: mockTransaction,
      }),
    );
    expect(EtEnrollmentSnapshot.findOrCreate).toHaveBeenCalledTimes(1);
  });

  test('檔案內同學號不同姓名 → quarantine 且不寫入', async () => {
    const buf = bufferFromMatrix([
      headerRow(),
      dataRow({ studentId: 'B10901001', studentName: '王小明' }),
      dataRow({ studentId: 'B10901001', studentName: '李小華' }),
    ]);
    const res = await importEnrollment(buf, '115-1');
    expect(res.ok).toBe(true);
    expect(res.imported).toBe(0);
    expect(res.quarantine.some((q) => q.reason === 'same_student_id_different_name_in_file')).toBe(true);
    expect(Student.create).not.toHaveBeenCalled();
    expect(EtEnrollmentSnapshot.findOrCreate).not.toHaveBeenCalled();
  });

  test('maps foreign-key failures to a clear enrollment semester error', async () => {
    const buf = bufferFromMatrix([headerRow(), dataRow()]);
    const fkErr = new Error('Cannot add or update a child row: a foreign key constraint fails');
    fkErr.original = { code: 'ER_NO_REFERENCED_ROW_2' };
    sequelize.transaction.mockRejectedValue(fkErr);

    await expect(importEnrollment(buf, '115-1')).rejects.toMatchObject({
      code: 'ENROLLMENT_SEMESTER_FK',
      message: expect.stringContaining('115-1'),
    });
  });

  test('maps data-too-long failures to a clear field error', async () => {
    const buf = bufferFromMatrix([headerRow(), dataRow()]);
    const tooLong = new Error("Data too long for column 'grade' at row 1");
    tooLong.original = { code: 'ER_DATA_TOO_LONG' };
    sequelize.transaction.mockRejectedValue(tooLong);

    await expect(importEnrollment(buf, '115-1')).rejects.toMatchObject({
      code: 'ENROLLMENT_DATA_TOO_LONG',
      message: expect.stringContaining('grade'),
    });
  });

  test('clips long grade before write and keeps import ok', async () => {
    const longGrade = '這是一段超過二十個字元的年級描述文字ABC';
    expect(longGrade.length).toBeGreaterThan(20);
    const buf = bufferFromMatrix([
      headerRow(),
      dataRow({ grade: longGrade }),
    ]);
    const res = await importEnrollment(buf, '115-1', { batchId: 'ljv3:enrollment:test' });
    expect(res.ok).toBe(true);
    expect(res.imported).toBe(1);
    expect(EtEnrollmentSnapshot.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        defaults: expect.objectContaining({
          grade: longGrade.slice(0, 20),
        }),
      }),
    );
  });
});
