'use strict';

jest.mock('../models', () => ({
  sequelize: {
    transaction: jest.fn((fn) => fn({})),
    where: jest.fn((a, b) => ({ where: a, value: b })),
    fn: jest.fn((name, ...args) => ({ fn: name, args })),
    col: jest.fn((name) => ({ col: name })),
  },
  LearningJourneyImportHistory: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
  },
  LearningJourneyOperationRun: {
    findByPk: jest.fn(),
    destroy: jest.fn(),
  },
  JobRun: {
    findByPk: jest.fn(),
    destroy: jest.fn(),
  },
  ClassMembership: {
    update: jest.fn(),
    destroy: jest.fn(),
  },
  Reservation: {
    update: jest.fn(),
  },
  EtEnrollmentSnapshot: { destroy: jest.fn() },
  EtExamAttempt: { findAll: jest.fn(), destroy: jest.fn() },
  EtExamAttemptScore: { destroy: jest.fn() },
  EtExamAttemptSkillScore: { destroy: jest.fn() },
  BestepAttendance: { destroy: jest.fn() },
  BestepExamScore: { destroy: jest.fn() },
  AuditLog: { findByPk: jest.fn(), destroy: jest.fn() },
}));

jest.mock('../services/englishTestTracking/semesterBestSkillService', () => ({
  rebuildSemesterBestSkills: jest.fn().mockResolvedValue({ rebuilt: 1 }),
}));

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: jest.fn(),
}));

jest.mock('../services/importRollbackManifestService', () => ({
  findByBatchId: jest.fn(),
  deleteByBatchId: jest.fn(),
}));

const {
  LearningJourneyImportHistory,
  LearningJourneyOperationRun,
  JobRun,
  ClassMembership,
  Reservation,
  EtEnrollmentSnapshot,
  BestepAttendance,
  AuditLog,
} = require('../models');
const importRollbackManifestService = require('../services/importRollbackManifestService');
const {
  resolveDeletable,
  deleteImportRun,
  parseBestepEntityId,
  rollbackClassRosterManifest,
  rollbackEventCardExcelManifest,
} = require('../services/importRunDeleteService');

describe('importRunDeleteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseBestepEntityId', () => {
    it('parses semester:examType:examDate', () => {
      expect(parseBestepEntityId('114-1:LR:2026-05-01')).toEqual({
        semester: '114-1',
        examType: 'LR',
        examDate: '2026-05-01',
      });
    });
  });

  describe('resolveDeletable', () => {
    it('allows lj import when batchId exists', () => {
      const r = resolveDeletable('lj_import_history', {
        importType: 'enrollment',
        summaryJson: { batchId: 'lj-enrollment-1' },
      });
      expect(r.deletable).toBe(true);
    });

    it('allows class roster audit when importBatchId exists', () => {
      const r = resolveDeletable('audit_log', {
        action: 'import_class_roster',
        afterData: { importBatchId: 'class-roster:1' },
      });
      expect(r.deletable).toBe(true);
    });

    it('allows card excel audit when importBatchId exists', () => {
      const r = resolveDeletable('audit_log', {
        action: 'import_card_excel',
        afterData: { importBatchId: 'card-excel:1' },
      });
      expect(r.deletable).toBe(true);
    });

    it('allows lj operation import when batchId exists', () => {
      const r = resolveDeletable('lj_operation_run', {
        operationType: 'IMPORT_ENROLLMENT',
        resultSummary: { batchId: 'ljv3:enrollment:1' },
      });
      expect(r.deletable).toBe(true);
    });

    it('allows job run record-only delete', () => {
      const r = resolveDeletable('job_run', { jobName: 'learning_journey_daily_governance' });
      expect(r.deletable).toBe(true);
      expect(r.recordOnly).toBe(true);
    });

    it('allows bestep audit when importBatchId in afterData', () => {
      const r = resolveDeletable('audit_log', {
        module: 'bestep',
        action: 'import_attendance',
        targetSummary: 'BESTEP attendance import',
        afterData: { importBatchId: 'bestep-attendance-1' },
      });
      expect(r.deletable).toBe(true);
    });
  });

  describe('rollback helpers', () => {
    it('restores class roster manifest', async () => {
      ClassMembership.update.mockResolvedValue([1]);
      ClassMembership.destroy.mockResolvedValue(2);
      const result = await rollbackClassRosterManifest({
        classId: 9,
        semester: '114-1',
        createdMembershipIds: [10, 11],
        updatedSnapshots: [{ id: 5, studentName: 'A', department: null, email: null, grade: null }],
      });
      expect(result.restoredMemberships).toBe(1);
      expect(result.deletedMemberships).toBe(2);
    });

    it('restores event card excel manifest', async () => {
      Reservation.update.mockResolvedValue([1]);
      const result = await rollbackEventCardExcelManifest({
        eventId: 3,
        reservationRollbacks: [{ id: 7, checkinStatus: '未簽到', checkinTime: null }],
      });
      expect(result.restoredReservations).toBe(1);
    });
  });

  describe('deleteImportRun', () => {
    it('deletes lj enrollment batch', async () => {
      LearningJourneyImportHistory.findByPk.mockResolvedValue({
        id: 9,
        importType: 'enrollment',
        semesterId: '114-1',
        summaryJson: { batchId: 'batch-9' },
        destroy: jest.fn().mockResolvedValue(1),
      });
      EtEnrollmentSnapshot.destroy.mockResolvedValue(3);

      const result = await deleteImportRun('lj_import_history', '9');
      expect(result.ok).toBe(true);
      expect(result.data.deletedSnapshots).toBe(3);
    });

    it('deletes class roster audit with manifest', async () => {
      AuditLog.findByPk.mockResolvedValue({
        id: 51,
        action: 'import_class_roster',
        afterData: { importBatchId: 'class-roster:1' },
        destroy: jest.fn().mockResolvedValue(1),
      });
      importRollbackManifestService.findByBatchId.mockResolvedValue({
        manifestJson: {
          classId: 9,
          semester: '114-1',
          createdMembershipIds: [1],
          updatedSnapshots: [],
        },
      });
      importRollbackManifestService.deleteByBatchId.mockResolvedValue(1);
      ClassMembership.destroy.mockResolvedValue(1);

      const result = await deleteImportRun('audit_log', '51');
      expect(result.ok).toBe(true);
      expect(result.data.importType).toBe('class_roster_import');
      expect(result.data.deletedMemberships).toBe(1);
    });

    it('deletes job run record only', async () => {
      JobRun.findByPk.mockResolvedValue({
        id: 8,
        jobName: 'learning_journey_daily_governance',
        destroy: jest.fn().mockResolvedValue(1),
      });
      const result = await deleteImportRun('job_run', '8');
      expect(result.ok).toBe(true);
      expect(result.data.rollbackMode).toBe('record_only');
    });

    it('deletes lj operation import via linked history', async () => {
      LearningJourneyOperationRun.findByPk.mockResolvedValue({
        id: 12,
        operationType: 'IMPORT_ENROLLMENT',
        resultSummary: { batchId: 'batch-op-1' },
        destroy: jest.fn().mockResolvedValue(1),
      });
      LearningJourneyImportHistory.findOne.mockResolvedValue({
        id: 20,
        importType: 'enrollment',
        semesterId: '114-1',
        summaryJson: { batchId: 'batch-op-1' },
        destroy: jest.fn().mockResolvedValue(1),
      });
      EtEnrollmentSnapshot.destroy.mockResolvedValue(4);

      const result = await deleteImportRun('lj_operation_run', '12');
      expect(result.ok).toBe(true);
      expect(result.data.deletedSnapshots).toBe(4);
    });
  });
});
