'use strict';

const { Op } = require('sequelize');

jest.mock('../models', () => ({
  LearningJourneyImportHistory: { findAll: jest.fn() },
  LearningJourneyOperationRun: { findAll: jest.fn() },
  JobRun: { findAll: jest.fn() },
  AuditLog: { findAll: jest.fn() },
}));

const {
  LearningJourneyImportHistory,
  LearningJourneyOperationRun,
  JobRun,
  AuditLog,
} = require('../models');
const {
  listImportRuns,
  getImportRunDetail,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  normalizeStatus,
  normalizeAuditImportType,
  normalizeModule,
  auditRowHasImportSemantics,
  buildAuditLogImportWhere,
} = require('../services/importRunHistoryService');

const REQUIRED_DTO_KEYS = [
  'id',
  'source',
  'sourceId',
  'importType',
  'module',
  'status',
  'title',
  'createdAt',
  'detailAvailable',
  'rawSource',
];

function assertDtoShape(dto) {
  for (const key of REQUIRED_DTO_KEYS) {
    expect(dto).toHaveProperty(key);
  }
  expect(typeof dto.rawSource).toBe('object');
}

function mockAllSourcesEmpty() {
  LearningJourneyImportHistory.findAll.mockResolvedValue([]);
  LearningJourneyOperationRun.findAll.mockResolvedValue([]);
  JobRun.findAll.mockResolvedValue([]);
  AuditLog.findAll.mockResolvedValue([]);
}

describe('importRunHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllSourcesEmpty();
  });

  describe('DTO mapper', () => {
    it('maps learning_journey_import_histories to lj_import_history', async () => {
      LearningJourneyImportHistory.findAll.mockResolvedValue([
        {
          id: 101,
          importType: 'enrollment',
          status: 'success',
          sourceFile: 'enroll.xlsx',
          importedCount: 10,
          updatedCount: 2,
          skippedCount: 1,
          conflictedCount: 0,
          warningCount: 3,
          summaryJson: { totalRows: 13, importedBy: 'admin-a', requestId: 'req-lj-1' },
          createdAt: new Date('2026-05-20T10:00:00Z'),
        },
      ]);

      const result = await listImportRuns({ source: 'lj_import_history' });
      expect(result.items).toHaveLength(1);
      const dto = result.items[0];
      assertDtoShape(dto);
      expect(dto.source).toBe('lj_import_history');
      expect(dto.sourceId).toBe('101');
      expect(dto.importType).toBe('lj_enrollment_import');
      expect(dto.module).toBe('learning_journey');
      expect(dto.status).toBe('success');
      expect(dto.fileName).toBe('enroll.xlsx');
      expect(dto.detailAvailable).toBe(true);
      expect(dto.rawSource.requestId).toBe('req-lj-1');
    });

    it('maps external_exam import history to lj_exam_import', async () => {
      LearningJourneyImportHistory.findAll.mockResolvedValue([
        {
          id: 102,
          importType: 'external_exam',
          status: 'partial',
          sourceFile: 'exam.xlsx',
          importedCount: 5,
          updatedCount: 0,
          skippedCount: 0,
          conflictedCount: 1,
          warningCount: 0,
          summaryJson: {},
          createdAt: new Date('2026-05-19T10:00:00Z'),
        },
      ]);

      const result = await listImportRuns({ source: 'lj_import_history' });
      expect(result.items[0].importType).toBe('lj_exam_import');
    });

    it('maps learning_journey_operation_runs to lj_operation_run', async () => {
      LearningJourneyOperationRun.findAll.mockResolvedValue([
        {
          id: 201,
          operationType: 'IMPORT_ENROLLMENT',
          status: 'success',
          requestId: 'req-op-1',
          executedByUserId: '7',
          executedByUsername: 'manager',
          startedAt: new Date('2026-05-18T08:00:00Z'),
          finishedAt: new Date('2026-05-18T08:01:00Z'),
          createdAt: new Date('2026-05-18T08:00:00Z'),
          resultSummary: { imported: 20, skipped: 2, totalRows: 22 },
          warnings: [{ code: 'W1' }],
        },
      ]);

      const result = await listImportRuns({ source: 'lj_operation_run' });
      expect(result.items).toHaveLength(1);
      const dto = result.items[0];
      assertDtoShape(dto);
      expect(dto.source).toBe('lj_operation_run');
      expect(dto.importType).toBe('lj_operation');
      expect(dto.module).toBe('operations');
      expect(dto.executedByUserId).toBe('7');
      expect(dto.detailAvailable).toBe(true);
      expect(dto.rawSource.operationType).toBe('IMPORT_ENROLLMENT');
    });

    it('maps job_runs to job_run', async () => {
      JobRun.findAll.mockResolvedValue([
        {
          id: 301,
          jobName: 'learning_journey_daily_sync',
          status: 'success',
          triggeredBy: 'cron',
          requestId: 'req-job-1',
          startedAt: new Date('2026-05-17T00:00:00Z'),
          finishedAt: new Date('2026-05-17T00:05:00Z'),
          createdAt: new Date('2026-05-17T00:00:00Z'),
          summaryJson: { totalRows: 100, importedRows: 95, failedRows: 5 },
        },
      ]);

      const result = await listImportRuns({ source: 'job_run' });
      expect(result.items).toHaveLength(1);
      const dto = result.items[0];
      assertDtoShape(dto);
      expect(dto.source).toBe('job_run');
      expect(dto.importType).toBe('job_sync');
      expect(dto.module).toBe('learning_journey');
      expect(dto.detailAvailable).toBe(true);
      expect(dto.rawSource.jobName).toBe('learning_journey_daily_sync');
    });

    it('maps audit_logs to audit_log with detailAvailable=false', async () => {
      AuditLog.findAll.mockResolvedValue([
        {
          id: 401,
          module: 'bestep',
          action: 'bestep_attendance_import',
          entityType: 'BestepAttendance',
          entityId: 'batch-1',
          operatorId: 9,
          operatorName: 'exec-user',
          status: 'success',
          requestId: 'req-audit-1',
          targetSummary: 'BESTEP attendance import',
          afterData: { successCount: 12, skipped: 1 },
          createdAt: new Date('2026-05-16T12:00:00Z'),
        },
      ]);

      const result = await listImportRuns({ source: 'audit_log' });
      expect(result.items).toHaveLength(1);
      const dto = result.items[0];
      assertDtoShape(dto);
      expect(dto.source).toBe('audit_log');
      expect(dto.importType).toBe('bestep_attendance_import');
      expect(dto.module).toBe('bestep');
      expect(dto.detailAvailable).toBe(false);
      expect(dto.totalCount).toBeNull();
      expect(dto.successCount).toBe(12);
      expect(dto.rawSource.action).toBe('bestep_attendance_import');
    });
  });

  describe('audit_logs fallback filter (query where)', () => {
    it('builds OR where with import semantics only (no bare module in list)', async () => {
      await listImportRuns({ source: 'audit_log' });

      expect(AuditLog.findAll).toHaveBeenCalledTimes(1);
      const callArg = AuditLog.findAll.mock.calls[0][0];
      const andClause = callArg.where[Op.and];
      expect(Array.isArray(andClause)).toBe(true);
      const orClause = andClause[0][Op.or];
      expect(Array.isArray(orClause)).toBe(true);
      expect(orClause).toEqual(
        expect.arrayContaining([
          { action: { [Op.like]: '%import%' } },
          { action: { [Op.like]: '%upload%' } },
          { action: { [Op.like]: '%card_excel%' } },
          { targetSummary: { [Op.like]: '%roster%' } },
        ])
      );
      expect(andClause[1]).toEqual({
        action: { [Op.notIn]: ['delete_import_run', 'rollback_import_history'] },
      });
      const hasBareModuleClause = orClause.some(
        (clause) => clause.module && clause.module[Op.in]
      );
      expect(hasBareModuleClause).toBe(false);
    });

    it('excludes reservations rows without import semantics after post-filter', async () => {
      AuditLog.findAll.mockResolvedValue([
        {
          id: 501,
          module: 'reservations',
          action: 'login_success',
          entityType: 'Reservation',
          entityId: '1',
          operatorId: 1,
          operatorName: 'u',
          status: 'success',
          requestId: null,
          targetSummary: 'login',
          afterData: {},
          createdAt: new Date('2026-05-15T10:00:00Z'),
        },
      ]);

      const result = await listImportRuns({ source: 'audit_log' });
      expect(result.items).toHaveLength(0);
      expect(auditRowHasImportSemantics({ module: 'reservations', action: 'login_success', targetSummary: 'login' })).toBe(false);
    });

    it('includes audit rows matching import action pattern', async () => {
      AuditLog.findAll.mockResolvedValue([
        {
          id: 502,
          module: 'admin_classes',
          action: 'class_roster_import',
          entityType: 'Class',
          entityId: '10',
          operatorId: 2,
          operatorName: 'admin',
          status: 'success',
          requestId: 'req-class',
          targetSummary: 'class roster import',
          afterData: {},
          createdAt: new Date('2026-05-15T11:00:00Z'),
        },
      ]);

      const result = await listImportRuns({ source: 'audit_log' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].importType).toBe('class_roster_import');
    });

    it('excludes delete/rollback maintenance audit rows from import run list', async () => {
      AuditLog.findAll.mockResolvedValue([
        {
          id: 601,
          module: 'bestep',
          action: 'delete_import_run',
          entityType: 'ImportRun',
          entityId: 'audit_log:42',
          operatorId: 1,
          operatorName: '系統管理員',
          status: 'success',
          requestId: null,
          targetSummary: 'delete audit_log:42',
          afterData: { deletedRows: 12 },
          createdAt: new Date('2026-06-18T13:25:00Z'),
        },
        {
          id: 602,
          module: 'learning_journey',
          action: 'rollback_import_history',
          entityType: 'LearningJourneyImportHistory',
          entityId: '9',
          operatorId: 1,
          operatorName: 'admin',
          status: 'success',
          requestId: null,
          targetSummary: 'rollback import',
          afterData: {},
          createdAt: new Date('2026-06-18T13:26:00Z'),
        },
      ]);

      const result = await listImportRuns({ source: 'audit_log' });
      expect(result.items).toHaveLength(0);
      expect(auditRowHasImportSemantics({ action: 'delete_import_run', targetSummary: 'delete audit_log:1' })).toBe(
        false,
      );
      expect(auditRowHasImportSemantics({ action: 'rollback_import_history', targetSummary: 'rollback' })).toBe(
        false,
      );
    });
  });

  describe('P13-4a normalization', () => {
    it('maps BESTEP attendance / scores and card excel import types', () => {
      expect(
        normalizeAuditImportType({
          module: 'bestep',
          action: 'bestep_attendance_import',
          targetSummary: 'BESTEP attendance import',
        })
      ).toBe('bestep_attendance_import');
      expect(
        normalizeAuditImportType({
          module: 'bestep',
          action: 'bestep_scores_import',
          targetSummary: 'BESTEP exam scores import',
        })
      ).toBe('bestep_score_import');
      expect(
        normalizeAuditImportType({
          module: 'reservations',
          action: 'import_card_excel',
          targetSummary: 'card excel import check-in',
        })
      ).toBe('event_card_excel_import');
    });

    it('normalizes status values without throwing', () => {
      expect(normalizeStatus('success')).toBe('success');
      expect(normalizeStatus('partial')).toBe('partial_success');
      expect(normalizeStatus('failed')).toBe('failed');
      expect(normalizeStatus('running')).toBe('running');
      expect(normalizeStatus('skipped')).toBe('skipped');
      expect(normalizeStatus('')).toBe('unknown');
      expect(normalizeStatus('weird_value')).toBe('unknown');
    });

    it('maps lj partial import history status to partial_success in DTO', async () => {
      LearningJourneyImportHistory.findAll.mockResolvedValue([
        {
          id: 99,
          importType: 'external_exam',
          status: 'partial',
          importedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          conflictedCount: 0,
          warningCount: 0,
          summaryJson: {},
          createdAt: new Date('2026-05-20T10:00:00Z'),
        },
      ]);
      const result = await listImportRuns({ source: 'lj_import_history' });
      expect(result.items[0].status).toBe('partial_success');
      expect(result.items[0].rawSource.statusRaw).toBe('partial');
    });

    it('normalizes module for operation runs and audit fallback', () => {
      expect(normalizeModule('lj_operation_run', {}, 'lj_operation')).toBe('operations');
      expect(
        normalizeModule('audit_log', { module: 'admin_classes' }, 'class_roster_import')
      ).toBe('classes');
      expect(
        normalizeModule('audit_log', { module: 'reservations' }, 'event_card_excel_import')
      ).toBe('operations');
    });

    it('buildAuditLogImportWhere does not include module-only clause', () => {
      const where = buildAuditLogImportWhere(null, null);
      const orClause = where[Op.and][0][Op.or];
      expect(orClause.some((c) => c.module && c.module[Op.in])).toBe(false);
    });
  });

  describe('query options', () => {
    it('uses default limit when not provided', async () => {
      const result = await listImportRuns({});
      expect(result.pagination.limit).toBe(DEFAULT_LIMIT);
      expect(DEFAULT_LIMIT).toBe(50);
    });

    it('caps limit at MAX_LIMIT', async () => {
      const result = await listImportRuns({ limit: 999 });
      expect(result.pagination.limit).toBe(MAX_LIMIT);
      expect(MAX_LIMIT).toBe(200);
    });

    it('applies offset for pagination slice', async () => {
      LearningJourneyImportHistory.findAll.mockResolvedValue([
        {
          id: 1,
          importType: 'enrollment',
          status: 'success',
          importedCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          conflictedCount: 0,
          warningCount: 0,
          summaryJson: {},
          createdAt: new Date('2026-05-21T10:00:00Z'),
        },
        {
          id: 2,
          importType: 'enrollment',
          status: 'success',
          importedCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          conflictedCount: 0,
          warningCount: 0,
          summaryJson: {},
          createdAt: new Date('2026-05-20T10:00:00Z'),
        },
      ]);

      const result = await listImportRuns({
        source: 'lj_import_history',
        limit: 1,
        offset: 1,
      });
      expect(result.pagination.offset).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].sourceId).toBe('2');
    });

    it('filters by source, importType, module, and status', async () => {
      LearningJourneyImportHistory.findAll.mockResolvedValue([
        {
          id: 1,
          importType: 'enrollment',
          status: 'success',
          importedCount: 1,
          updatedCount: 0,
          skippedCount: 0,
          conflictedCount: 0,
          warningCount: 0,
          summaryJson: {},
          createdAt: new Date('2026-05-20T10:00:00Z'),
        },
      ]);
      JobRun.findAll.mockResolvedValue([
        {
          id: 9,
          jobName: 'other_job',
          status: 'failed',
          triggeredBy: 'cron',
          startedAt: new Date('2026-05-20T09:00:00Z'),
          finishedAt: null,
          createdAt: new Date('2026-05-20T09:00:00Z'),
          summaryJson: {},
        },
      ]);

      const result = await listImportRuns({
        source: 'lj_import_history',
        importType: 'lj_enrollment_import',
        module: 'learning_journey',
        status: 'success',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].source).toBe('lj_import_history');
      expect(result.items[0].importType).toBe('lj_enrollment_import');
      expect(result.items[0].module).toBe('learning_journey');
      expect(result.items[0].status).toBe('success');
    });
  });

  describe('source failure tolerance', () => {
    it('returns other sources and warnings when one source throws', async () => {
      LearningJourneyImportHistory.findAll.mockRejectedValue(new Error('lj table unavailable'));
      JobRun.findAll.mockResolvedValue([
        {
          id: 77,
          jobName: 'sync_job',
          status: 'success',
          triggeredBy: 'manual',
          startedAt: new Date('2026-05-18T10:00:00Z'),
          finishedAt: new Date('2026-05-18T10:01:00Z'),
          createdAt: new Date('2026-05-18T10:00:00Z'),
          summaryJson: {},
        },
      ]);

      const result = await listImportRuns({});
      expect(result.items.some((x) => x.source === 'job_run')).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: 'lj_import_history',
            message: expect.stringContaining('lj table unavailable'),
          }),
        ])
      );
    });

    it('does not throw when a source fails', async () => {
      AuditLog.findAll.mockRejectedValue(new Error('audit read failed'));
      await expect(listImportRuns({})).resolves.toMatchObject({
        items: expect.any(Array),
        warnings: expect.arrayContaining([
          expect.objectContaining({ source: 'audit_log' }),
        ]),
      });
    });
  });

  describe('detail API service mapping', () => {
    beforeEach(() => {
      LearningJourneyImportHistory.findByPk = jest.fn();
      LearningJourneyOperationRun.findByPk = jest.fn();
      JobRun.findByPk = jest.fn();
    });

    it('returns clear error for unsupported source', async () => {
      const r = await getImportRunDetail('nope', '1');
      expect(r.ok).toBe(false);
      expect(r.status).toBe(400);
    });

    it('returns audit_log as detailAvailable=false with summary', async () => {
      const r = await getImportRunDetail('audit_log', '401');
      expect(r.ok).toBe(true);
      expect(r.detail.detailAvailable).toBe(false);
      expect(String(r.detail.summary || '')).toMatch(/audit/i);
    });

    it('returns 404 when lj_import_history sourceId not found', async () => {
      LearningJourneyImportHistory.findByPk.mockResolvedValue(null);
      const r = await getImportRunDetail('lj_import_history', '999');
      expect(r.ok).toBe(false);
      expect(r.status).toBe(404);
    });

    it('maps lj_operation_run detail with warnings and errors fallback', async () => {
      LearningJourneyOperationRun.findByPk.mockResolvedValue({
        get: () => ({
          id: 5,
          operationType: 'IMPORT_EXAM',
          status: 'failed',
          requestId: 'req-x',
          executedByUserId: '7',
          executedByUsername: 'admin',
          startedAt: new Date('2026-05-18T00:00:00Z'),
          finishedAt: new Date('2026-05-18T00:00:10Z'),
          createdAt: new Date('2026-05-18T00:00:00Z'),
          resultSummary: { totalRows: 1, imported: 0, failedCount: 1 },
          warnings: [{ code: 'W' }],
          errorCode: 'E',
          errorMessage: 'boom',
        }),
      });
      const r = await getImportRunDetail('lj_operation_run', '5');
      expect(r.ok).toBe(true);
      expect(r.detail.detailAvailable).toBe(true);
      expect(r.detail.source).toBe('lj_operation_run');
      expect(r.detail.warnings.length).toBeGreaterThanOrEqual(1);
      expect(r.detail.errors.length).toBeGreaterThanOrEqual(1);
    });

    it('maps job_run detail and does not throw on missing summaryJson', async () => {
      JobRun.findByPk.mockResolvedValue({
        get: () => ({
          id: 6,
          jobName: 'sync_job',
          status: 'success',
          triggeredBy: 'cron',
          requestId: 'req-j',
          startedAt: new Date('2026-05-18T00:00:00Z'),
          finishedAt: null,
          createdAt: new Date('2026-05-18T00:00:00Z'),
          summaryJson: null,
          errorMessage: null,
        }),
      });
      const r = await getImportRunDetail('job_run', '6');
      expect(r.ok).toBe(true);
      expect(r.detail.source).toBe('job_run');
      expect(r.detail.detailAvailable).toBe(true);
      expect(r.detail.rawSource).toHaveProperty('jobName');
    });
  });
});
