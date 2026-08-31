/**
 * @jest-environment node
 */
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';

const mockFindOne = jest.fn();
const mockFindAll = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../models', () => ({
  EnglishTestRegistration: {
    findOne: (...args) => mockFindOne(...args),
    findAll: (...args) => mockFindAll(...args),
    create: (...args) => mockCreate(...args),
  },
}));

const {
  queryPublicRegistration,
  createOrUpdateRegistration,
  registrationMatchesIdentity,
  findRegistrationForSemester,
  assertStudentMayEditRegistration,
  inferRegistrationSemester,
} = require('../services/englishTestRegistrationService');

function buildRegistration(overrides = {}) {
  return {
    id: 1,
    studentId: 'B123456789',
    name: '王小明',
    idNumber: 'A123456789',
    semester: '114-2',
    status: 'pending',
    examType: 'LR',
    email: 'test@example.com',
    createdAt: new Date('2026-03-01'),
    update: mockUpdate,
    ...overrides,
  };
}

describe('englishTestRegistrationService — cross-semester', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindAll.mockResolvedValue([]);
    mockUpdate.mockResolvedValue(undefined);
  });

  describe('findRegistrationForSemester', () => {
    it('returns legacy record when semester is null but createdAt maps to target semester', async () => {
      mockFindOne.mockResolvedValue(null);
      const legacy = buildRegistration({
        id: 10,
        semester: null,
        createdAt: new Date('2026-10-01'),
      });
      mockFindAll.mockResolvedValue([legacy]);

      const result = await findRegistrationForSemester('B123456789', '115-1');

      expect(result.registration).toBe(legacy);
      expect(result.legacySemesterInferred).toBe(true);
    });

    it('ignores legacy record when createdAt maps to a different semester', async () => {
      mockFindOne.mockResolvedValue(null);
      mockFindAll.mockResolvedValue([
        buildRegistration({
          id: 11,
          semester: null,
          createdAt: new Date('2026-03-01'),
        }),
      ]);

      const result = await findRegistrationForSemester('B123456789', '115-1');

      expect(result.registration).toBeNull();
      expect(result.legacySemesterInferred).toBe(false);
    });
  });

  describe('assertStudentMayEditRegistration', () => {
    it('throws when registration belongs to previous semester', () => {
      const reg = buildRegistration({ semester: '114-2' });
      expect(() => assertStudentMayEditRegistration(reg, { atDate: new Date('2026-10-01') }))
        .toThrow(expect.objectContaining({ code: 'REGISTRATION_SEMESTER_MISMATCH', status: 403 }));
    });

    it('allows when registration is in active semester', () => {
      const reg = buildRegistration({ semester: '115-1' });
      expect(() => assertStudentMayEditRegistration(reg, { atDate: new Date('2026-10-01') }))
        .not.toThrow();
    });
  });

  describe('inferRegistrationSemester', () => {
    it('uses createdAt when semester column is blank', () => {
      const reg = buildRegistration({ semester: null, createdAt: new Date('2026-04-01') });
      expect(inferRegistrationSemester(reg)).toBe('114-2');
    });
  });

  describe('queryPublicRegistration', () => {
    it('returns found:false when only previous semester registration exists', async () => {
      mockFindOne.mockImplementation(async ({ where }) => {
        if (where.semester === '115-1') return null;
        return null;
      });
      mockFindAll.mockResolvedValue([
        buildRegistration({ semester: '114-2', createdAt: new Date('2026-03-01') }),
      ]);

      const result = await queryPublicRegistration(
        { studentId: 'B123456789', name: '王小明', idNumber: 'A123456789' },
        { semester: '115-1' }
      );

      expect(result.found).toBe(false);
      expect(result.semester).toBe('115-1');
    });

    it('returns current semester registration when it exists', async () => {
      const reg = buildRegistration({ id: 2, semester: '115-1', status: 'revision' });
      mockFindOne.mockResolvedValue(reg);

      const result = await queryPublicRegistration(
        { studentId: 'B123456789', name: '王小明', idNumber: 'A123456789' },
        { semester: '115-1' }
      );

      expect(result.found).toBe(true);
      expect(result.semester).toBe('115-1');
      expect(result.registration).toBe(reg);
      expect(result.canEdit).toBe(true);
    });

    it('finds legacy null-semester registration for current semester', async () => {
      mockFindOne.mockResolvedValue(null);
      const legacy = buildRegistration({
        semester: null,
        createdAt: new Date('2026-10-01'),
        status: 'pending',
      });
      mockFindAll.mockResolvedValue([legacy]);

      const result = await queryPublicRegistration(
        { studentId: 'B123456789', name: '王小明', idNumber: 'A123456789' },
        { semester: '115-1' }
      );

      expect(result.found).toBe(true);
      expect(result.legacySemesterInferred).toBe(true);
    });

    it('returns found:false when identity fields do not match', async () => {
      mockFindOne.mockResolvedValue(buildRegistration({ semester: '115-1', name: '其他姓名' }));

      const result = await queryPublicRegistration(
        { studentId: 'B123456789', name: '王小明', idNumber: 'A123456789' },
        { semester: '115-1' }
      );

      expect(result.found).toBe(false);
    });

    it('marks approved registration as not editable', async () => {
      mockFindOne.mockResolvedValue(buildRegistration({ semester: '115-1', status: 'approved' }));

      const result = await queryPublicRegistration(
        { studentId: 'B123456789', name: '王小明', idNumber: 'A123456789' },
        { semester: '115-1' }
      );

      expect(result.found).toBe(true);
      expect(result.canEdit).toBe(false);
      expect(result.statusMessage).toMatch(/已經通過審查/);
    });
  });

  describe('createOrUpdateRegistration', () => {
    it('creates a new registration for a new semester when prior semester exists', async () => {
      mockFindOne.mockResolvedValue(null);
      const created = buildRegistration({ id: 99, semester: '115-1' });
      mockCreate.mockResolvedValue(created);

      const { registration, action } = await createOrUpdateRegistration({
        studentId: 'B123456789',
        name: '王小明',
        idNumber: 'A123456789',
        semester: '115-1',
        examType: 'LR',
        hasCEFRB2: '否',
        email: 'test@example.com',
        studentNameZh: '王小明',
        lastNameEn: 'Wang',
        firstNameEn: 'Ming',
        nationalId: 'A123456789',
        phone: '0912345678',
        postalCode: '804',
        city: '高雄市',
        district: '鼓山區',
        address: '蓮海路70號',
        degreeLevel: '學士班',
        grade: '二年級',
        college: '工學院',
        department: '資訊工程學系',
        isLowIncome: '否',
        hasDisabilityCard: '否',
        agreedToTerms: true,
        infoSource: 'EMI 中心官網',
      }, { actor: 'student' });

      expect(action).toBe('created');
      expect(registration.semester).toBe('115-1');
      expect(mockCreate).toHaveBeenCalled();
    });

    it('blocks student re-submit when same semester is already approved', async () => {
      mockFindOne.mockResolvedValue(buildRegistration({ semester: '115-1', status: 'success' }));

      await expect(createOrUpdateRegistration({
        studentId: 'B123456789',
        semester: '115-1',
        examType: 'LR',
      }, { actor: 'student' })).rejects.toMatchObject({
        code: 'DUPLICATE_REGISTRATION_NOT_ALLOWED',
        status: 409,
      });
    });

    it('allows student to update pending registration in same semester', async () => {
      const existing = buildRegistration({ semester: '115-1', status: 'pending' });
      mockFindOne.mockResolvedValue(existing);

      const { action } = await createOrUpdateRegistration({
        studentId: 'B123456789',
        semester: '115-1',
        examType: 'SW',
        phone: '0987654321',
      }, { actor: 'student' });

      expect(action).toBe('updated');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('updates legacy null-semester record when semester matches via inference', async () => {
      mockFindOne.mockResolvedValue(null);
      const legacy = buildRegistration({
        semester: null,
        status: 'pending',
        createdAt: new Date('2026-10-01'),
      });
      mockFindAll.mockResolvedValue([legacy]);

      const { action, legacySemesterBackfilled } = await createOrUpdateRegistration({
        studentId: 'B123456789',
        semester: '115-1',
        examType: 'LR',
      }, { actor: 'student' });

      expect(action).toBe('updated');
      expect(legacySemesterBackfilled).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('registrationMatchesIdentity', () => {
    it('matches normalized id number case', () => {
      const reg = buildRegistration({ idNumber: 'A123456789' });
      expect(registrationMatchesIdentity(reg, {
        studentId: 'B123456789',
        name: '王小明',
        idNumber: 'a123456789',
      })).toBe(true);
    });
  });
});
