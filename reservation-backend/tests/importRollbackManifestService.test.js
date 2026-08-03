'use strict';

jest.mock('../models', () => ({
  ImportRollbackManifest: {
    upsert: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
  },
}));

const { ImportRollbackManifest } = require('../models');
const {
  saveManifest,
  findByBatchId,
  deleteByBatchId,
} = require('../services/importRollbackManifestService');

describe('importRollbackManifestService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves class roster manifest', async () => {
    ImportRollbackManifest.upsert.mockResolvedValue([{ id: 1 }]);
    await saveManifest({
      importBatchId: 'class-roster:114-1:1',
      sourceModule: 'admin_classes',
      kind: 'class_roster',
      manifest: {
        kind: 'class_roster',
        classId: 9,
        semester: '114-1',
        className: 'A班',
        createdMembershipIds: [1, 2],
        updatedSnapshots: [{ id: 3, studentId: 'A001', studentName: 'Tom', department: null, email: null, grade: null }],
      },
    });
    expect(ImportRollbackManifest.upsert).toHaveBeenCalled();
  });

  it('finds manifest by batch id', async () => {
    ImportRollbackManifest.findOne.mockResolvedValue({ importBatchId: 'x' });
    const row = await findByBatchId('x');
    expect(row.importBatchId).toBe('x');
  });

  it('deletes manifest by batch id', async () => {
    ImportRollbackManifest.destroy.mockResolvedValue(1);
    const count = await deleteByBatchId('x');
    expect(count).toBe(1);
  });
});
