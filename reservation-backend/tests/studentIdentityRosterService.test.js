/**
 * @jest-environment node
 */

const mockStudentFind = jest.fn();
const mockMembershipFind = jest.fn();
const mockSnapshotFind = jest.fn();
const mockLegacyFind = jest.fn();

jest.mock('../models', () => ({
  Student: { findOne: (...args) => mockStudentFind(...args) },
  ClassMembership: { findAll: (...args) => mockMembershipFind(...args) },
  EtEnrollmentSnapshot: { findAll: (...args) => mockSnapshotFind(...args) },
  EtStudentMaster: { findOne: (...args) => mockLegacyFind(...args) },
}));

const { findOfficialIdentity } = require('../services/studentIdentityRosterService');

describe('studentIdentityRosterService', () => {
  beforeEach(() => {
    mockStudentFind.mockReset();
    mockMembershipFind.mockReset();
    mockSnapshotFind.mockReset();
    mockLegacyFind.mockReset();
    mockStudentFind.mockResolvedValue(null);
    mockMembershipFind.mockResolvedValue([]);
    mockSnapshotFind.mockResolvedValue([]);
    mockLegacyFind.mockResolvedValue(null);
  });

  it('uses the student master name when that student is on file', async () => {
    mockStudentFind.mockResolvedValue({ nameZh: '王小明' });
    const identity = await findOfficialIdentity('b123456789');
    expect(identity).toEqual({ covered: true, conflict: false, name: '王小明' });
  });

  it('covers a student who is only on a class roster', async () => {
    mockMembershipFind.mockResolvedValue([{ studentName: '陳大文' }]);
    const identity = await findOfficialIdentity('M123456789');
    expect(identity.covered).toBe(true);
    expect(identity.name).toBe('陳大文');
  });

  it('does not pick a name when official rosters disagree', async () => {
    mockStudentFind.mockResolvedValue({ nameZh: '王小明' });
    mockMembershipFind.mockResolvedValue([{ studentName: '王小華' }]);
    const identity = await findOfficialIdentity('B123456789');
    expect(identity).toEqual({ covered: true, conflict: true, name: null });
  });

  it('reports students who are absent from every official roster', async () => {
    const identity = await findOfficialIdentity('D123456789');
    expect(identity.covered).toBe(false);
  });
});
