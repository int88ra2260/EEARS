'use strict';

const learningJourneyCore = require('../services/learningJourney/learningJourneyService');
const ljReadAggregate = require('../services/learningJourneyService');
const {
  getSemesterReconciliation,
  isValidSemesterId: isValidReconciliationSemesterId
} = require('../services/learningJourney/reconciliationService');
const { runSync, normalizeSections } = require('../services/learningJourney/syncService');
const { getEnglishTestSummaryV3 } = require('../services/learningJourney/englishTestSummaryV3Service');
const { getEnglishTestStudentsV3 } = require('../services/learningJourney/englishTestStudentsV3Service');
const { getEnglishTestStudentDetailV3 } = require('../services/learningJourney/englishTestStudentDetailV3Service');
const { getSemesterReadinessGate } = require('../services/learningJourney/readinessGateService');
const { getRiskStudentsBySemester } = require('../services/learningJourney/learningJourneyRiskService');
const { getLearningJourneyDataFreshness } = require('../services/learningJourney/dataFreshnessService');
const { isLearningJourneyV3ReadModelEnabled } = require('../services/learningJourney/learningJourneyFeatureFlags');
const { normalizeStudentId } = require('../services/learningJourney/utils/studentNormalization');
const {
  dryRunCourseImport,
  applyCourseImport,
  getStudentCourses
} = require('../services/learningJourney/courseRecordService');
const {
  dryRunAcademicCourseRosterImport,
  applyAcademicCourseRosterImport
} = require('../services/learningJourney/academicCourseRosterImportService');
const {
  getStudentJourneyReport,
  renderStudentJourneyHtml
} = require('../services/learningJourney/studentJourneyReportService');
const { getGovernanceOverview } = require('../services/learningJourney/governanceOverviewService');
const {
  listRecentJobRuns,
  runDailyGovernanceJob,
  runReconcileSemesterJob
} = require('../services/learningJourney/learningJourneyJobService');
const { getLegacyUsageAuditReport } = require('../services/learningJourney/legacyUsageAuditService');
const learningJourneyFinal = require('../services/learningJourney/learningJourneyFinalService');

function envelope(req, data, warnings = [], debug = null) {
  return {
    success: true,
    data,
    meta: {
      traceId: req.requestId || '',
      generatedAt: new Date().toISOString(),
      ...(debug ? { debug } : {})
    },
    warnings
  };
}

async function getStudentProfile(req, res) {
  try {
    const studentId = normalizeStudentId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ error: 'studentId 為必填', requestId: req.requestId });
    }

    const result = await ljReadAggregate.getAggregatedStudentReadModel(studentId);
    const warnMessages = (result.dataQuality || [])
      .filter((w) => w && w.severity === 'warning')
      .map((w) => w.message);

    return res.json(envelope(req, result, warnMessages, {
      mode: 'aggregate_read_model'
    }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getStudentTimeline(req, res) {
  try {
    const studentId = normalizeStudentId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ error: 'studentId 為必填', requestId: req.requestId });
    }
    const result = await ljReadAggregate.getAggregatedStudentReadModel(studentId);
    const warnMessages = (result.dataQuality || [])
      .filter((w) => w && w.severity === 'warning')
      .map((w) => w.message);
    return res.json(envelope(req, result, warnMessages, { mode: 'aggregate_read_model' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getStudentCoursesHandler(req, res) {
  try {
    const studentId = normalizeStudentId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ error: 'studentId 為必填', requestId: req.requestId });
    }
    const data = await getStudentCourses(studentId, {
      semesterId: req.query.semesterId
    });
    if (data.error) {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    return res.json(envelope(req, data, [], { mode: 'student_courses' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getStudentConsistencyHandler(req, res) {
  try {
    const studentId = normalizeStudentId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ error: 'studentId 為必填', requestId: req.requestId });
    }
    const report = await getStudentJourneyReport(studentId);
    if (report.error) {
      return res.status(400).json({ error: report.error, requestId: req.requestId });
    }
    return res.json(envelope(req, report.consistency, [], { mode: 'student_journey_consistency' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getStudentReportHandler(req, res) {
  try {
    const studentId = normalizeStudentId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ error: 'studentId 為必填', requestId: req.requestId });
    }
    const report = await getStudentJourneyReport(studentId);
    if (report.error) {
      return res.status(400).json({ error: report.error, requestId: req.requestId });
    }
    const format = String(req.query.format || 'json').toLowerCase();
    if (format === 'html' || format === 'pdf') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="learning-journey-${studentId}.html"`);
      return res.send(renderStudentJourneyHtml(report));
    }
    return res.json(envelope(req, report, [], { mode: 'student_journey_report_json' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getSemesterMetrics(req, res) {
  try {
    const semesterId = req.params.semesterId ? String(req.params.semesterId).trim() : '';
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }

    const result = await learningJourneyCore.getSemesterMetrics(semesterId, {
      scope: req.query.scope || 'school',
      classId: req.query.classId,
      department: req.query.department,
      includeTrend: req.query.includeTrend === 'true'
    });
    return res.json(envelope(req, result, []));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getReconciliation(req, res) {
  try {
    const semesterId = req.query.semesterId ? String(req.query.semesterId).trim() : '';
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    if (!isValidReconciliationSemesterId(semesterId)) {
      return res.status(400).json({ error: 'semesterId 格式不正確（須如 114-2）', requestId: req.requestId });
    }
    const data = await getSemesterReconciliation(semesterId);
    return res.json(envelope(req, data, [], { mode: 'reconciliation' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getReadinessHandler(req, res) {
  try {
    const semesterId = req.query.semesterId ? String(req.query.semesterId).trim() : '';
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    if (!isValidReconciliationSemesterId(semesterId)) {
      return res.status(400).json({ error: 'semesterId 格式不正確（須如 114-2）', requestId: req.requestId });
    }
    const data = await getSemesterReadinessGate(semesterId);
    const warnMessages = [];
    if (data.status === 'not_ready' || data.status === 'error') {
      for (const c of data.checks || []) {
        if (c && c.status === 'warning') warnMessages.push(`${c.label}: ${c.message}`);
        if (c && c.status === 'error') warnMessages.push(`${c.label}: ${c.message}`);
      }
    }
    return res.json(
      envelope(req, data, warnMessages, {
        mode: 'readiness_gate',
        enableLearningJourneyV3ReadModel: isLearningJourneyV3ReadModelEnabled()
      })
    );
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getReadModelStatusHandler(req, res) {
  try {
    const enabled = isLearningJourneyV3ReadModelEnabled();
    const data = {
      enableLearningJourneyV3ReadModel: enabled,
      currentReadModel: 'learning_journey_v3',
      affectedApis: [
        '/api/admin/learning-journey/semesters/:semesterId/english-test-summary',
        '/api/admin/learning-journey/semesters/:semesterId/english-test-students',
        '/api/admin/learning-journey/semesters/:semesterId/english-test-students/:studentId'
      ],
      legacyBridgeEnabled: false,
      warnings: enabled
        ? ['Learning Journey V3 read model is enabled. Legacy bridge is disabled.']
        : ['Learning Journey V3 APIs remain mounted, but the legacy admin english-tests APIs are disabled.']
    };
    return res.json(
      envelope(req, data, [], {
        mode: 'read_model_status',
        enableLearningJourneyV3ReadModel: enabled
      })
    );
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getDataFreshnessHandler(req, res) {
  try {
    const semesterId = req.query.semesterId ? String(req.query.semesterId).trim() : '';
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    if (!isValidReconciliationSemesterId(semesterId)) {
      return res.status(400).json({ error: 'semesterId 格式不正確（須如 114-2）', requestId: req.requestId });
    }
    const data = await getLearningJourneyDataFreshness(semesterId);
    if (data.error) {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    const warnings = [];
    for (const sec of data.sections || []) {
      if (sec.status === 'stale' || sec.status === 'empty' || sec.status === 'unknown') {
        warnings.push(`${sec.key}: ${sec.message}`);
      }
    }
    return res.json(
      envelope(req, data, warnings, {
        mode: 'data_freshness',
        enableLearningJourneyV3ReadModel: isLearningJourneyV3ReadModelEnabled()
      })
    );
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getGovernanceOverviewHandler(req, res) {
  try {
    const semesterId = req.query.semesterId ? String(req.query.semesterId).trim() : '';
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    const data = await getGovernanceOverview(semesterId);
    if (data.error) {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    return res.json(envelope(req, data, data.recommendations || [], { mode: 'governance_overview' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getRecentJobsHandler(req, res) {
  try {
    const semesterId = req.query.semesterId ? String(req.query.semesterId).trim() : '';
    const data = await listRecentJobRuns({
      semesterId,
      limit: req.query.limit
    });
    return res.json(envelope(req, { semesterId, items: data }, [], { mode: 'learning_journey_recent_jobs' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getLegacyUsageAuditReportHandler(req, res) {
  try {
    const data = await getLegacyUsageAuditReport({
      days: req.query.days
    });
    return res.json(envelope(req, data, [], { mode: 'legacy_usage_audit_report' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function postRunDailyGovernanceJob(req, res) {
  try {
    const semesterId = String((req.body && req.body.semesterId) || req.query.semesterId || '').trim();
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    const data = await runDailyGovernanceJob({
      semesterId,
      triggeredBy: 'manual',
      requestId: req.requestId
    });
    const statusCode = data.status === 'skipped' ? 409 : data.status === 'failed' ? 500 : 200;
    return res.status(statusCode).json(envelope(req, data, data.error ? [data.error] : [], { mode: 'run_daily_governance_job' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function postRunReconcileSemesterJob(req, res) {
  try {
    const semesterId = String((req.body && req.body.semesterId) || req.query.semesterId || '').trim();
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    const data = await runReconcileSemesterJob({
      semesterId,
      triggeredBy: 'manual',
      requestId: req.requestId
    });
    const statusCode = data.status === 'skipped' ? 409 : data.status === 'failed' ? 500 : 200;
    return res.status(statusCode).json(envelope(req, data, data.error ? [data.error] : [], { mode: 'run_reconcile_semester_job' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getSemesterDashboard(req, res) {
  try {
    const semesterId = req.params.semesterId ? String(req.params.semesterId).trim() : '';
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    const result = await ljReadAggregate.getAggregatedSemesterDashboard(semesterId);
    const warnMessages = (result.dataQuality || [])
      .filter((w) => w && w.severity === 'warning')
      .map((w) => w.message);
    return res.json(envelope(req, result, warnMessages, { mode: 'aggregate_read_model' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getFinalSemestersHandler(req, res) {
  try {
    const data = await learningJourneyFinal.listSemesters();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getFinalSemesterOverviewHandler(req, res) {
  try {
    const semesterId = req.params.id || req.params.semesterId ? String(req.params.id || req.params.semesterId).trim() : '';
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    const data = await learningJourneyFinal.getSemesterOverview(semesterId, { user: req.user });
    if (data.error) {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    return res.json(envelope(req, data, (data.warnings || []).map((w) => w.message || w.code), { mode: 'learning_journey_final_overview' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getFinalImportHistoriesHandler(req, res) {
  try {
    const semesterId = req.params.id || req.params.semesterId ? String(req.params.id || req.params.semesterId).trim() : '';
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    const data = await learningJourneyFinal.getImportHistories(semesterId, {
      limit: req.query.limit
    });
    if (data.error) {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    return res.json(envelope(req, data, (data.warnings || []).map((w) => w.message || w.code), { mode: 'learning_journey_final_import_histories' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getFinalSemesterStudentsHandler(req, res) {
  try {
    const semesterId = req.params.id || req.params.semesterId ? String(req.params.id || req.params.semesterId).trim() : '';
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    const data = await learningJourneyFinal.getSemesterStudents(semesterId, {
      user: req.user,
      keyword: req.query.keyword,
      department: req.query.department,
      grade: req.query.grade,
      page: req.query.page,
      limit: req.query.limit,
      offset: req.query.offset,
      skill: req.query.skill,
      b2Plus: req.query.b2Plus
    });
    if (data.error) {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    return res.json(envelope(req, data, (data.warnings || []).map((w) => w.message || w.code), { mode: 'learning_journey_final_students' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function postFinalRebuildHandler(req, res) {
  try {
    const semesterId = String((req.body && req.body.semesterId) || req.query.semesterId || '').trim();
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    const data = await learningJourneyFinal.rebuildReadModel(semesterId);
    if (data.error) {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    return res.json(envelope(req, data, [], { mode: 'learning_journey_final_rebuild' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getFinalStudentDetailHandler(req, res) {
  try {
    const studentId = normalizeStudentId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ error: 'studentId 為必填', requestId: req.requestId });
    }
    const data = await learningJourneyFinal.getStudentDetail(studentId, {
      user: req.user,
      semesterId: req.query.semesterId
    });
    if (data.error) {
      return res.status(data.statusCode || 400).json({ error: data.error, requestId: req.requestId });
    }
    return res.json(envelope(req, data, (data.warnings || []).map((w) => w.message || w.code), { mode: 'learning_journey_final_student_detail' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function postFinalEnrollmentImportDryRun(req, res) {
  try {
    const semesterId = String((req.body && req.body.semesterId) || req.query.semesterId || '').trim();
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    if (!req.file) {
      return res.status(400).json({ error: '請上傳 Excel 檔案', requestId: req.requestId });
    }
    const data = await learningJourneyFinal.importEnrollmentSnapshot({
      semesterId,
      fileBuffer: req.file.buffer,
      sourceFile: req.file.originalname,
      dryRun: true
    });
    if (data.error) return res.status(400).json({ error: data.error, requestId: req.requestId });
    return res.json(envelope(req, data, (data.warnings || []).map((w) => w.message || w.code), { mode: 'learning_journey_final_enrollment_import_dry_run' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function postFinalEnrollmentImportApply(req, res) {
  try {
    const semesterId = String((req.body && req.body.semesterId) || req.query.semesterId || '').trim();
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    if (!req.file) {
      return res.status(400).json({ error: '請上傳 Excel 檔案', requestId: req.requestId });
    }
    const data = await learningJourneyFinal.importEnrollmentSnapshot({
      semesterId,
      fileBuffer: req.file.buffer,
      sourceFile: req.file.originalname,
      dryRun: false
    });
    if (data.error) return res.status(400).json({ error: data.error, requestId: req.requestId });
    return res.json(envelope(req, data, (data.warnings || []).map((w) => w.message || w.code), { mode: 'learning_journey_final_enrollment_import_apply' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function postFinalExternalExamImportDryRun(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '請上傳 Excel 檔案', requestId: req.requestId });
    }
    const data = await learningJourneyFinal.importExternalExamAttempts({
      fileBuffer: req.file.buffer,
      sourceFile: req.file.originalname,
      dryRun: true
    });
    if (data.error) return res.status(400).json({ error: data.error, requestId: req.requestId });
    return res.json(envelope(req, data, (data.warnings || []).map((w) => w.message || w.code), { mode: 'learning_journey_final_exam_import_dry_run' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function postFinalExternalExamImportApply(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '請上傳 Excel 檔案', requestId: req.requestId });
    }
    const data = await learningJourneyFinal.importExternalExamAttempts({
      fileBuffer: req.file.buffer,
      sourceFile: req.file.originalname,
      dryRun: false
    });
    if (data.error) return res.status(400).json({ error: data.error, requestId: req.requestId });
    return res.json(envelope(req, data, (data.warnings || []).map((w) => w.message || w.code), { mode: 'learning_journey_final_exam_import_apply' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getEnglishTestSummaryV3Handler(req, res) {
  try {
    const semesterId = req.params.semesterId ? String(req.params.semesterId).trim() : '';
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    const data = await getEnglishTestSummaryV3(semesterId);
    if (data.error) {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    const warnMessages = ((data.dataQuality && data.dataQuality.warnings) || [])
      .filter((w) => w && w.severity === 'warning')
      .map((w) => w.message);
    return res.json(
      envelope(req, data, warnMessages, {
        mode: 'english_test_summary_v3',
        enableLearningJourneyV3ReadModel: isLearningJourneyV3ReadModelEnabled()
      })
    );
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getEnglishTestStudentsV3ListHandler(req, res) {
  try {
    const semesterId = req.params.semesterId ? String(req.params.semesterId).trim() : '';
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    if (!isValidReconciliationSemesterId(semesterId)) {
      return res.status(400).json({ error: 'semesterId 格式不正確', requestId: req.requestId });
    }
    const data = await getEnglishTestStudentsV3(semesterId, {
      keyword: req.query.keyword,
      grade: req.query.grade,
      department: req.query.department,
      attained: req.query.attained,
      limit: req.query.limit,
      offset: req.query.offset
    });
    if (data.error) {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    const warnMessages = ((data.dataQuality && data.dataQuality.warnings) || [])
      .filter((w) => w && w.severity === 'warning')
      .map((w) => w.message);
    return res.json(
      envelope(req, data, warnMessages, {
        mode: 'english_test_students_v3',
        enableLearningJourneyV3ReadModel: isLearningJourneyV3ReadModelEnabled()
      })
    );
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getEnglishTestStudentDetailV3Handler(req, res) {
  try {
    const semesterId = req.params.semesterId ? String(req.params.semesterId).trim() : '';
    const studentId = normalizeStudentId(req.params.studentId);
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    if (!studentId) {
      return res.status(400).json({ error: 'studentId 為必填', requestId: req.requestId });
    }
    const data = await getEnglishTestStudentDetailV3(semesterId, studentId);
    if (data.error === 'semesterId 格式不正確' || data.error === 'studentId 為必填') {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    if (data.error) {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    const warnMessages = ((data.dataQuality && data.dataQuality.warnings) || [])
      .filter((w) => w && w.severity === 'warning')
      .map((w) => w.message);
    return res.json(
      envelope(req, data, warnMessages, {
        mode: 'english_test_student_detail_v3',
        enableLearningJourneyV3ReadModel: isLearningJourneyV3ReadModelEnabled()
      })
    );
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function getRiskStudentsHandler(req, res) {
  try {
    const semesterId = req.params.semesterId ? String(req.params.semesterId).trim() : '';
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    if (!isValidReconciliationSemesterId(semesterId)) {
      return res.status(400).json({ error: 'semesterId 格式不正確', requestId: req.requestId });
    }
    const data = await getRiskStudentsBySemester(semesterId);
    if (data.error) {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    return res.json(
      envelope(req, data, [], {
        mode: 'risk_students',
        enableLearningJourneyV3ReadModel: isLearningJourneyV3ReadModelEnabled()
      })
    );
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function postSync(req, res) {
  try {
    const body = req.body || {};
    const semesterId = String(body.semesterId || '').trim();
    const sections = body.sections;
    const dryRun = body.dryRun !== false;
    const actor = {
      id: req.user && req.user.id ? req.user.id : null,
      role: req.user && req.user.role ? req.user.role : null,
      teacherLevel: req.user && req.user.teacherLevel ? req.user.teacherLevel : null
    };
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填', requestId: req.requestId });
    }
    const normalized = normalizeSections(sections);
    if (!normalized.length) {
      return res.status(400).json({ error: 'sections 無效或為空', requestId: req.requestId });
    }
    const data = await runSync({ semesterId, sections: normalized, dryRun });
    if (data.error) {
      return res.status(400).json({ error: data.error, requestId: req.requestId });
    }
    console.info(
      `[learning-journey-sync-audit] actorId=${actor.id || 'unknown'} role=${actor.role || 'unknown'} level=${actor.teacherLevel || 'n/a'} semesterId=${semesterId} dryRun=${dryRun} sections=${normalized.join(',')}`
    );
    return res.json(envelope(req, data, [], { mode: 'learning_journey_sync' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function postCourseImportDryRun(req, res) {
  try {
    const bodyRows = Array.isArray(req.body && req.body.rows) ? req.body.rows : null;
    if (!req.file && !bodyRows) {
      return res.status(400).json({ error: '請上傳 Excel 檔案或提供 rows 陣列', requestId: req.requestId });
    }
    const data = await dryRunCourseImport({
      rows: bodyRows,
      fileBuffer: req.file ? req.file.buffer : null,
      sourceFile: req.file ? req.file.originalname : 'json_rows'
    });
    return res.json(envelope(req, data, [], { mode: 'course_import_dry_run' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function postCourseImportApply(req, res) {
  try {
    const bodyRows = Array.isArray(req.body && req.body.rows) ? req.body.rows : null;
    if (!req.file && !bodyRows) {
      return res.status(400).json({ error: '請上傳 Excel 檔案或提供 rows 陣列', requestId: req.requestId });
    }
    const actor = {
      id: req.user && req.user.id ? req.user.id : null,
      role: req.user && req.user.role ? req.user.role : null,
      teacherLevel: req.user && req.user.teacherLevel ? req.user.teacherLevel : null
    };
    const data = await applyCourseImport({
      rows: bodyRows,
      fileBuffer: req.file ? req.file.buffer : null,
      sourceFile: req.file ? req.file.originalname : 'json_rows',
      actor
    });
    if (data.error) {
      return res.status(400).json({ error: data.error, data, requestId: req.requestId });
    }
    console.info(
      `[learning-journey-course-import-audit] actorId=${actor.id || 'unknown'} role=${actor.role || 'unknown'} file=${req.file ? req.file.originalname : 'json_rows'} rows=${data.validRows || 0}`
    );
    return res.json(envelope(req, data, [], { mode: 'course_import_apply' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

function parseSyncClassRosterFlag(body) {
  if (!body || body.syncClassRoster === undefined || body.syncClassRoster === null || body.syncClassRoster === '') {
    return true;
  }
  const raw = String(body.syncClassRoster).trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(raw);
}

async function postAcademicCourseRosterDryRun(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: '請上傳教務處修課名單 Excel', requestId: req.requestId });
    }
    const semesterId = String((req.body && req.body.semesterId) || req.query.semesterId || '').trim();
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填（例如 114-2）', requestId: req.requestId });
    }
    const data = await dryRunAcademicCourseRosterImport({
      fileBuffer: req.file.buffer,
      semesterId,
      syncClassRoster: parseSyncClassRosterFlag(req.body),
    });
    if (data.error && !data.validRows) {
      return res.status(400).json({ error: data.error, data, requestId: req.requestId });
    }
    return res.json(envelope(req, data, [], { mode: 'academic_course_roster_dry_run' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function postAcademicCourseRosterApply(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: '請上傳教務處修課名單 Excel', requestId: req.requestId });
    }
    const semesterId = String((req.body && req.body.semesterId) || req.query.semesterId || '').trim();
    if (!semesterId) {
      return res.status(400).json({ error: 'semesterId 為必填（例如 114-2）', requestId: req.requestId });
    }
    const actor = {
      id: req.user && req.user.id ? req.user.id : null,
      role: req.user && req.user.role ? req.user.role : null,
      teacherLevel: req.user && req.user.teacherLevel ? req.user.teacherLevel : null
    };
    const data = await applyAcademicCourseRosterImport({
      fileBuffer: req.file.buffer,
      semesterId,
      syncClassRoster: parseSyncClassRosterFlag(req.body),
      sourceFile: req.file.originalname,
      actor,
    });
    if (data.error) {
      return res.status(400).json({ error: data.error, data, requestId: req.requestId });
    }
    console.info(
      `[learning-journey-academic-roster-audit] actorId=${actor.id || 'unknown'} role=${actor.role || 'unknown'} file=${req.file.originalname} semester=${semesterId} rows=${data.validRows || 0}`
    );
    return res.json(envelope(req, data, [], { mode: 'academic_course_roster_apply' }));
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

async function rebuildCache(req, res) {
  try {
    const semesterId = req.body && req.body.semesterId ? String(req.body.semesterId).trim() : (req.query.semesterId || '').trim();
    const studentId = req.body && req.body.studentId ? normalizeStudentId(req.body.studentId) : normalizeStudentId(req.query.studentId);

    if (semesterId && studentId) {
      const profile = await learningJourneyCore.getStudentProfile(studentId, { semesterId });
      if (!profile || !profile.student || !profile.student.studentPk) {
        return res.status(404).json({ error: '查無可重建學生', requestId: req.requestId });
      }
      const rebuilt = await learningJourneyCore.rebuildStudentSemesterProfile(profile.student.studentPk, semesterId);
      return res.json(envelope(req, { mode: 'single', rebuilt: !!rebuilt }, []));
    }

    if (semesterId) {
      const rebuilt = await learningJourneyCore.rebuildSemesterProfilesBySemester(semesterId);
      return res.json(envelope(req, { mode: 'semester', ...rebuilt }, []));
    }

    return res.status(400).json({ error: 'semesterId 或 (semesterId + studentId) 為必填', requestId: req.requestId });
  } catch (error) {
    return res.status(500).json({ error: error.message, requestId: req.requestId });
  }
}

module.exports = {
  getStudentProfile,
  getStudentTimeline,
  getStudentCoursesHandler,
  getStudentConsistencyHandler,
  getStudentReportHandler,
  getSemesterMetrics,
  getSemesterDashboard,
  getFinalSemestersHandler,
  getFinalSemesterOverviewHandler,
  getFinalImportHistoriesHandler,
  getFinalSemesterStudentsHandler,
  getFinalStudentDetailHandler,
  postFinalRebuildHandler,
  postFinalEnrollmentImportDryRun,
  postFinalEnrollmentImportApply,
  postFinalExternalExamImportDryRun,
  postFinalExternalExamImportApply,
  getReconciliation,
  getReadinessHandler,
  getReadModelStatusHandler,
  getDataFreshnessHandler,
  getGovernanceOverviewHandler,
  getRecentJobsHandler,
  getLegacyUsageAuditReportHandler,
  postRunDailyGovernanceJob,
  postRunReconcileSemesterJob,
  getEnglishTestSummaryV3Handler,
  getEnglishTestStudentsV3ListHandler,
  getEnglishTestStudentDetailV3Handler,
  getRiskStudentsHandler,
  postSync,
  postCourseImportDryRun,
  postCourseImportApply,
  postAcademicCourseRosterDryRun,
  postAcademicCourseRosterApply,
  rebuildCache
};
