import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import ImportUploadPanel from '../admin/import/ImportUploadPanel';
import ImportResultSummary from '../admin/import/ImportResultSummary';
import ImportErrorList from '../admin/import/ImportErrorList';
import {
  postLearningJourneyV3EnrollmentImport,
  postLearningJourneyV3ExamImport,
  postLearningJourneyV3BaselineImport,
} from '../../services/learningJourneyV3Api';
import {
  postAcademicCourseRosterApply,
  postAcademicCourseRosterDryRun,
} from '../../services/learningJourneyApi';
import {
  downloadEnrollmentTemplate,
  downloadExamTemplate,
  downloadBaselineTemplate,
} from '../../utils/learningJourneyImportTemplates';
import { SEMESTER_OPTIONS } from '../../utils/semesterUtils';

function buildSemesterSelectOptions(current) {
  const opts = SEMESTER_OPTIONS.filter((o) => o.value);
  const cur = String(current || '').trim();
  if (cur && !opts.some((o) => o.value === cur)) {
    return [{ value: cur, label: `${cur}學期` }, ...opts];
  }
  return opts;
}

function SemesterField({ id, label, value, onChange, disabled }) {
  return (
    <Form.Group className="lj-import-semester mb-0" controlId={id}>
      <Form.Label>{label}</Form.Label>
      <Form.Select value={value} onChange={onChange} disabled={disabled} size="sm">
        {buildSemesterSelectOptions(value).map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </Form.Select>
    </Form.Group>
  );
}

/** 從 LJ V3 匯入 API 回傳保守收集 warnings / conflicts / skipped / errors */
function collectLearningJourneyImportIssues(source) {
  const warnings = [];
  const conflicts = [];
  const skipped = [];
  const errors = [];
  if (!source || typeof source !== 'object') {
    return { warnings, conflicts, skipped, errors };
  }
  const raw = source.raw && typeof source.raw === 'object' ? source.raw : source;

  if (Array.isArray(source.warnings)) {
    warnings.push(...source.warnings);
  } else if (Array.isArray(raw.warnings)) {
    warnings.push(...raw.warnings);
  }

  if (Array.isArray(source.conflicts) && source.conflicts.length) {
    conflicts.push(...source.conflicts);
  } else if (Array.isArray(raw.conflicts)) {
    conflicts.push(...raw.conflicts);
  } else if (Array.isArray(source.quarantine)) {
    conflicts.push(...source.quarantine);
  } else if (Array.isArray(raw.quarantine)) {
    conflicts.push(...raw.quarantine);
  }

  if (Array.isArray(source.skippedDetails)) {
    skipped.push(...source.skippedDetails);
  } else if (Array.isArray(raw.skippedDetails)) {
    skipped.push(...raw.skippedDetails);
  } else if (Array.isArray(raw.skipped) && raw.skipped.length && typeof raw.skipped[0] === 'object') {
    skipped.push(...raw.skipped);
  }

  if (Array.isArray(raw.errors)) {
    errors.push(...raw.errors);
  }
  if (Array.isArray(raw.validationErrors)) {
    errors.push(...raw.validationErrors);
  }
  if (Array.isArray(raw.errorDetails)) {
    errors.push(...raw.errorDetails);
  }

  return { warnings, conflicts, skipped, errors };
}

function pickLjImportTotalCount(summary) {
  const raw = summary?.raw;
  if (!raw || typeof raw !== 'object') return undefined;
  for (const key of ['totalRows', 'processedRows', 'total', 'totalCount']) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
      const n = Number(raw[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function toImportSummary(result) {
  return {
    raw: result,
    inserted: Number(result?.inserted || result?.imported || result?.success || 0),
    updated: Number(result?.updated || 0),
    skippedCount: Number(result?.skipped || 0),
    autoMappedCefrCount: Number(result?.autoMappedCefrCount || 0),
    warningsCount: Array.isArray(result?.warnings) ? result.warnings.length : 0,
    conflictsCount: Array.isArray(result?.conflicts)
      ? result.conflicts.length
      : (Array.isArray(result?.quarantine) ? result.quarantine.length : 0),
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
    conflicts: Array.isArray(result?.conflicts) ? result.conflicts : [],
    skippedDetails: Array.isArray(result?.skippedDetails) ? result.skippedDetails : [],
    quarantine: Array.isArray(result?.quarantine) ? result.quarantine : [],
  };
}

function CourseImportResultBlock({ result, mode = 'dryRun' }) {
  if (!result) return null;
  const isDryRun = mode === 'dryRun' || result.dryRun === true;
  const invalidRows = result.samples?.invalidRows || [];
  const duplicateRows = result.samples?.duplicateRows || [];
  const validSamples = result.samples?.validRows || [];

  return (
    <div className="mt-3 small lj-import-result">
      <Alert variant={result.error ? 'danger' : (isDryRun ? 'info' : 'success')} className="py-2 mb-2">
        {result.error ? (
          <div>{result.error}</div>
        ) : (
          <>
            <div className="fw-semibold mb-1">{isDryRun ? '預覽結果' : '匯入完成'}</div>
            <div>有效列：{result.validRows ?? 0}／{result.inputRows ?? 0}</div>
            {isDryRun ? (
              <>
                <div>將新增課程：{result.wouldCreateCourses ?? 0}；更新課程：{result.wouldUpdateCourses ?? 0}</div>
                <div>將新增選課：{result.wouldCreateEnrollments ?? 0}；更新選課：{result.wouldUpdateEnrollments ?? 0}</div>
              </>
            ) : (
              <>
                <div>新增課程：{result.createdCourses ?? 0}；更新課程：{result.updatedCourses ?? 0}</div>
                <div>新增選課：{result.createdEnrollments ?? 0}；更新選課：{result.updatedEnrollments ?? 0}</div>
                {result.analyticsRebuild?.processedStudents != null ? (
                  <div className="mt-1 text-muted">
                    已重建 analytic：{result.analyticsRebuild.processedStudents} 位學生
                  </div>
                ) : null}
                {result.analyticsRebuildWarning ? (
                  <div className="mt-1 text-warning-emphasis">{result.analyticsRebuildWarning}</div>
                ) : null}
              </>
            )}
            {(result.invalidRows > 0 || result.duplicateRows > 0) ? (
              <div className="mt-1 text-warning-emphasis">
                無效列 {result.invalidRows ?? 0}；重複列 {result.duplicateRows ?? 0}
              </div>
            ) : null}
            {result.unknownStudents > 0 ? (
              <div className="mt-1 text-warning-emphasis">
                有 {result.unknownStudents} 筆學號尚未在 students 主檔（仍會寫入選課）
              </div>
            ) : null}
            {Array.isArray(result.sheetStats) && result.sheetStats.length > 0 ? (
              <div className="mt-2">
                <div className="text-muted">工作表摘要</div>
                <ul className="mb-0 ps-3">
                  {result.sheetStats.map((sheet) => (
                    <li key={sheet.sheetName}>
                      {sheet.sheetName}：有效 {sheet.validRows} 列，略過 {sheet.skippedRows} 列，課程 {sheet.uniqueCourses} 班
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.classRosterPreview ? (
              <div className="mt-1 text-muted">
                將同步班級名冊：{result.classRosterPreview.wouldSyncClasses} 班、
                {result.classRosterPreview.wouldSyncMemberships} 筆成員
              </div>
            ) : null}
            {result.classRoster && !result.classRoster.error ? (
              <div className="mt-1 text-muted">
                班級名冊：新增 {result.classRoster.classesCreated} 班、更新成員 {result.classRoster.membershipsUpserted} 筆
              </div>
            ) : null}
            {result.classRoster?.error ? (
              <div className="mt-1 text-warning-emphasis">班級名冊同步警告：{result.classRoster.error}</div>
            ) : null}
          </>
        )}
      </Alert>
      <ImportErrorList errors={invalidRows} title="無效列明細" variant="danger" className="mb-2" />
      <ImportErrorList errors={duplicateRows} title="重複列明細" variant="warning" className="mb-2" />
      {validSamples.length > 0 ? (
        <details className="mb-0">
          <summary className="text-muted">有效列範例（前 {validSamples.length} 筆）</summary>
          <ul className="mb-0 ps-3">
            {validSamples.map((row) => (
              <li key={`${row.rowNumber}-${row.studentId}-${row.courseCode}`}>
                {row.semesterId} {row.courseCode} {row.courseName} — {row.studentId} {row.studentName}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function LearningJourneyImportResultBlock({ summary, showCefrMessage = false }) {
  if (!summary) return null;

  const { warnings, conflicts, skipped, errors } = collectLearningJourneyImportIssues(summary);
  const totalCount = pickLjImportTotalCount(summary);

  return (
    <div className="mt-3 lj-import-result">
      <ImportResultSummary
        result={summary.raw || summary}
        successCount={summary.inserted}
        skippedCount={summary.skippedCount}
        failedCount={summary.conflictsCount || errors.length}
        totalCount={totalCount}
        message={(
          <>
            {showCefrMessage && summary.autoMappedCefrCount > 0 ? (
              <div className="text-success">
                考試匯入完成，成功匯入 {summary.inserted} 筆，其中 {summary.autoMappedCefrCount} 個 CEFR 等級由系統依分數自動判定。
              </div>
            ) : null}
            {summary.warningsCount > 0 ? (
              <div className="text-warning-emphasis">部分資料有問題</div>
            ) : null}
          </>
        )}
        className="mb-2"
      />
      <ImportErrorList errors={warnings} title="warnings 明細" variant="warning" className="mb-2" />
      <ImportErrorList errors={conflicts} title="conflicts 明細" variant="warning" className="mb-2" />
      <ImportErrorList errors={skipped} title="skipped 明細" variant="info" className="mb-2" />
      <ImportErrorList errors={errors} title="錯誤明細" className="mb-0" />
    </div>
  );
}

/**
 * Learning Journey V3 名冊／考試 Excel 匯入表單（由資料匯入中心導向）。
 */
export default function LearningJourneyV3ImportSection({
  token,
  defaultSemester = '',
  onImportSuccess,
}) {
  const [enrollmentSemesterId, setEnrollmentSemesterId] = useState(defaultSemester);
  const [examSemesterId, setExamSemesterId] = useState(defaultSemester);
  const [enrollmentFile, setEnrollmentFile] = useState(null);
  const [examFile, setExamFile] = useState(null);
  const [examReplaceMode, setExamReplaceMode] = useState(false);
  const [baselineFile, setBaselineFile] = useState(null);
  const [courseFile, setCourseFile] = useState(null);
  const [courseSemesterId, setCourseSemesterId] = useState(defaultSemester);
  const [syncClassRoster, setSyncClassRoster] = useState(true);
  const [importLoading, setImportLoading] = useState({
    enrollment: false, exam: false, baseline: false, courseDryRun: false, courseApply: false,
  });
  const [importError, setImportError] = useState({
    enrollment: '', exam: '', baseline: '', course: '',
  });
  const [importResult, setImportResult] = useState({
    enrollment: null, exam: null, baseline: null, courseDryRun: null, courseApply: null,
  });

  useEffect(() => {
    const sem = String(defaultSemester || '').trim();
    if (!sem) return;
    setEnrollmentSemesterId((prev) => prev || sem);
    setExamSemesterId((prev) => prev || sem);
    setCourseSemesterId((prev) => prev || sem);
  }, [defaultSemester]);

  const performEnrollmentImport = async (fileToUpload) => {
    const sem = String(enrollmentSemesterId || '').trim();
    if (!fileToUpload || !sem) return;
    setImportLoading((prev) => ({ ...prev, enrollment: true }));
    setImportError((prev) => ({ ...prev, enrollment: '' }));
    try {
      const data = await postLearningJourneyV3EnrollmentImport(token, fileToUpload, sem);
      setImportResult((prev) => ({ ...prev, enrollment: toImportSummary(data) }));
      onImportSuccess?.(sem);
    } catch (err) {
      setImportError((prev) => ({ ...prev, enrollment: err.message || '名冊匯入失敗' }));
    } finally {
      setImportLoading((prev) => ({ ...prev, enrollment: false }));
    }
  };

  const handleEnrollmentFormSubmit = async (event, fileFromPanel) => {
    event.preventDefault();
    const fileToUpload = fileFromPanel || enrollmentFile;
    await performEnrollmentImport(fileToUpload);
  };

  const performExamImport = async (fileToUpload) => {
    const sem = String(examSemesterId || '').trim();
    if (!fileToUpload || !sem) return;
    setImportLoading((prev) => ({ ...prev, exam: true }));
    setImportError((prev) => ({ ...prev, exam: '' }));
    try {
      const data = await postLearningJourneyV3ExamImport(token, fileToUpload, {
        semesterId: sem,
        replaceMode: examReplaceMode,
      });
      setImportResult((prev) => ({ ...prev, exam: toImportSummary(data) }));
      onImportSuccess?.(sem);
    } catch (err) {
      setImportError((prev) => ({ ...prev, exam: err.message || '考試匯入失敗' }));
    } finally {
      setImportLoading((prev) => ({ ...prev, exam: false }));
    }
  };

  const handleExamFormSubmit = async (event, fileFromPanel) => {
    event.preventDefault();
    const fileToUpload = fileFromPanel || examFile;
    await performExamImport(fileToUpload);
  };

  const performBaselineImport = async (fileToUpload) => {
    if (!fileToUpload) return;
    setImportLoading((prev) => ({ ...prev, baseline: true }));
    setImportError((prev) => ({ ...prev, baseline: '' }));
    try {
      const data = await postLearningJourneyV3BaselineImport(token, fileToUpload);
      setImportResult((prev) => ({ ...prev, baseline: toImportSummary(data) }));
      onImportSuccess?.();
    } catch (err) {
      setImportError((prev) => ({ ...prev, baseline: err.message || '學測 baseline 匯入失敗' }));
    } finally {
      setImportLoading((prev) => ({ ...prev, baseline: false }));
    }
  };

  const handleBaselineFormSubmit = async (event, fileFromPanel) => {
    event.preventDefault();
    const fileToUpload = fileFromPanel || baselineFile;
    await performBaselineImport(fileToUpload);
  };

  const performCourseDryRun = async (fileToUpload) => {
    const sem = String(courseSemesterId || '').trim();
    if (!fileToUpload || !sem) return;
    setImportLoading((prev) => ({ ...prev, courseDryRun: true }));
    setImportError((prev) => ({ ...prev, course: '' }));
    setImportResult((prev) => ({ ...prev, courseApply: null }));
    try {
      const data = await postAcademicCourseRosterDryRun(token, fileToUpload, {
        semesterId: sem,
        syncClassRoster,
      });
      setImportResult((prev) => ({ ...prev, courseDryRun: data }));
    } catch (err) {
      setImportError((prev) => ({ ...prev, course: err.message || '修課預覽失敗' }));
    } finally {
      setImportLoading((prev) => ({ ...prev, courseDryRun: false }));
    }
  };

  const performCourseApply = async (fileToUpload) => {
    const sem = String(courseSemesterId || '').trim();
    if (!fileToUpload || !sem) return;
    setImportLoading((prev) => ({ ...prev, courseApply: true }));
    setImportError((prev) => ({ ...prev, course: '' }));
    try {
      const data = await postAcademicCourseRosterApply(token, fileToUpload, {
        semesterId: sem,
        syncClassRoster,
      });
      if (data?.error) {
        setImportError((prev) => ({ ...prev, course: data.error }));
        setImportResult((prev) => ({ ...prev, courseApply: data }));
        return;
      }
      setImportResult((prev) => ({ ...prev, courseApply: data }));
      onImportSuccess?.(sem);
    } catch (err) {
      setImportError((prev) => ({ ...prev, course: err.message || '修課匯入失敗' }));
    } finally {
      setImportLoading((prev) => ({ ...prev, courseApply: false }));
    }
  };

  const handleCourseDryRunSubmit = async (event, fileFromPanel) => {
    event.preventDefault();
    await performCourseDryRun(fileFromPanel || courseFile);
  };

  const handleCourseApply = async () => {
    await performCourseApply(courseFile);
  };

  const courseBusy = importLoading.courseDryRun || importLoading.courseApply;
  const coursePreviewOk = importResult.courseDryRun
    && !importResult.courseDryRun.error
    && (importResult.courseDryRun.invalidRows || 0) === 0
    && (importResult.courseDryRun.duplicateRows || 0) === 0
    && (importResult.courseDryRun.validRows || 0) > 0;

  const courseStep = importResult.courseApply
    ? 3
    : coursePreviewOk
      ? 2
      : 1;

  return (
    <div className="lj-import-bento">
      <div className="lj-import-block lj-import-block--ewl">
        <div className="lj-import-block__head">
          <div className="lj-import-block__title-group">
            <span className="lj-import-block__kind">EWL</span>
            <h2 className="lj-import-block__title">英文寫作工坊同步</h2>
            <p className="lj-import-block__desc">
              從 EWL API 同步預約與簽到至學習歷程。完整表單與最近同步紀錄請至專頁操作。
            </p>
          </div>
          <Button
            as={Link}
            to="/admin/learning-journey/ewl-sync"
            variant="primary"
            size="sm"
          >
            開啟 EWL 同步頁
          </Button>
        </div>
      </div>

      <div className="lj-import-block lj-import-block--enrollment">
        <div className="lj-import-block__head">
          <div className="lj-import-block__title-group">
            <span className="lj-import-block__kind lj-import-block__kind--enrollment">名冊</span>
            <h2 className="lj-import-block__title">學習歷程名冊匯入</h2>
            <p className="lj-import-block__desc">上傳學期追蹤名冊 Excel，需指定學期。</p>
          </div>
          <SemesterField
            id="lj-enrollment-semester"
            label="學期"
            value={enrollmentSemesterId}
            onChange={(e) => setEnrollmentSemesterId(e.target.value)}
            disabled={importLoading.enrollment}
          />
        </div>
        <ImportUploadPanel
          title=""
          variant="minimal"
          acceptedFileTypes=".xlsx,.xls"
          selectedFile={enrollmentFile}
          onFileChange={(file) => setEnrollmentFile(file || null)}
          onSubmit={handleEnrollmentFormSubmit}
          isSubmitting={importLoading.enrollment}
          submitLabel={importLoading.enrollment ? '匯入中...' : '上傳名冊'}
          disabled={!String(enrollmentSemesterId || '').trim() || importLoading.enrollment}
          notice={(
            <Button
              type="button"
              variant="outline-secondary"
              size="sm"
              onClick={downloadEnrollmentTemplate}
              disabled={importLoading.enrollment}
            >
              下載名冊範例
            </Button>
          )}
        />
        {importError.enrollment ? (
          <div className="lj-import-error-inline" role="alert">{importError.enrollment}</div>
        ) : null}
        <LearningJourneyImportResultBlock summary={importResult.enrollment} />
      </div>

      <div className="lj-import-block lj-import-block--exam">
        <div className="lj-import-block__head">
          <div className="lj-import-block__title-group">
            <span className="lj-import-block__kind lj-import-block__kind--exam">考試</span>
            <h2 className="lj-import-block__title">英檢成績匯入</h2>
            <p className="lj-import-block__desc">上傳英檢成績 Excel；可選 replace mode 處理衝突。</p>
          </div>
          <SemesterField
            id="lj-exam-semester"
            label="學期"
            value={examSemesterId}
            onChange={(e) => setExamSemesterId(e.target.value)}
            disabled={importLoading.exam}
          />
        </div>
        <ImportUploadPanel
          title=""
          variant="minimal"
          acceptedFileTypes=".xlsx,.xls"
          selectedFile={examFile}
          onFileChange={(file) => setExamFile(file || null)}
          onSubmit={handleExamFormSubmit}
          isSubmitting={importLoading.exam}
          submitLabel={importLoading.exam ? '匯入中...' : '上傳考試'}
          disabled={!String(examSemesterId || '').trim() || importLoading.exam}
          notice={(
            <Button
              type="button"
              variant="outline-secondary"
              size="sm"
              onClick={downloadExamTemplate}
              disabled={importLoading.exam}
            >
              下載考試成績範例
            </Button>
          )}
        >
          <Form.Check
            className="mb-0"
            type="checkbox"
            id="exam-replace-mode"
            checked={examReplaceMode}
            onChange={(e) => setExamReplaceMode(e.target.checked)}
            disabled={importLoading.exam}
            label="衝突時先刪舊資料再匯入（replace mode）"
          />
        </ImportUploadPanel>
        {importError.exam ? (
          <div className="lj-import-error-inline" role="alert">{importError.exam}</div>
        ) : null}
        <LearningJourneyImportResultBlock summary={importResult.exam} showCefrMessage />
      </div>

      <div className="lj-import-block lj-import-block--course">
        <div className="lj-import-block__head">
          <div className="lj-import-block__title-group">
            <span className="lj-import-block__kind lj-import-block__kind--course">修課</span>
            <h2 className="lj-import-block__title">教務處修課名單匯入</h2>
            <p className="lj-import-block__desc">
              上傳每學期教務處修課名單（EAP / ESP / GE 多工作表）。會同步寫入學習歷程修課紀錄，並可選擇自動建立班級名冊。
            </p>
          </div>
          <SemesterField
            id="lj-course-semester"
            label="學期"
            value={courseSemesterId}
            onChange={(e) => setCourseSemesterId(e.target.value)}
            disabled={courseBusy}
          />
        </div>
        <div className="lj-import-course-steps" aria-label="修課匯入流程">
          <span className={`lj-import-course-steps__item${courseStep >= 1 ? ' is-active' : ''}`}>
            <span className="lj-import-course-steps__num">1</span>
            預覽匯入
          </span>
          <span className="lj-import-course-steps__sep" aria-hidden="true">→</span>
          <span className={`lj-import-course-steps__item${courseStep >= 2 ? ' is-active' : ''}`}>
            <span className="lj-import-course-steps__num">2</span>
            確認寫入
          </span>
          <span className="lj-import-course-steps__sep" aria-hidden="true">→</span>
          <span className={`lj-import-course-steps__item${courseStep >= 3 ? ' is-active' : ''}`}>
            <span className="lj-import-course-steps__num">3</span>
            完成
          </span>
        </div>
        <ImportUploadPanel
          title=""
          variant="minimal"
          acceptedFileTypes=".xlsx,.xls"
          selectedFile={courseFile}
          onFileChange={(file) => {
            setCourseFile(file || null);
            setImportResult((prev) => ({ ...prev, courseDryRun: null, courseApply: null }));
            setImportError((prev) => ({ ...prev, course: '' }));
          }}
          onSubmit={handleCourseDryRunSubmit}
          isSubmitting={importLoading.courseDryRun}
          submitLabel={importLoading.courseDryRun ? '預覽中...' : '預覽匯入'}
          disabled={courseBusy || !String(courseSemesterId || '').trim()}
          notice={(
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCourseApply}
              disabled={!courseFile || !coursePreviewOk || courseBusy || !String(courseSemesterId || '').trim()}
            >
              {importLoading.courseApply ? '寫入中...' : '確認寫入'}
            </Button>
          )}
        >
          <Form.Check
            className="mb-0"
            type="checkbox"
            id="sync-class-roster"
            checked={syncClassRoster}
            onChange={(e) => setSyncClassRoster(e.target.checked)}
            disabled={courseBusy}
            label="同步建立班級名冊（課程名稱＋授課教師）"
          />
        </ImportUploadPanel>
        {importError.course ? (
          <div className="lj-import-error-inline" role="alert">{importError.course}</div>
        ) : null}
        <CourseImportResultBlock result={importResult.courseApply} mode="apply" />
        {!importResult.courseApply ? (
          <CourseImportResultBlock result={importResult.courseDryRun} mode="dryRun" />
        ) : null}
      </div>

      <div className="lj-import-block lj-import-block--baseline">
        <div className="lj-import-block__head">
          <div className="lj-import-block__title-group">
            <span className="lj-import-block__kind lj-import-block__kind--baseline">Baseline</span>
            <h2 className="lj-import-block__title">學測 baseline 匯入</h2>
            <p className="lj-import-block__desc">
              上傳學測英文 baseline；不需指定學期，匯入後寫入學習歷程事件並重建 analytic。
            </p>
          </div>
        </div>
        <ImportUploadPanel
          title=""
          variant="minimal"
          acceptedFileTypes=".xlsx,.xls"
          selectedFile={baselineFile}
          onFileChange={(file) => setBaselineFile(file || null)}
          onSubmit={handleBaselineFormSubmit}
          isSubmitting={importLoading.baseline}
          submitLabel={importLoading.baseline ? '匯入中...' : '上傳 baseline'}
          disabled={importLoading.baseline}
          notice={(
            <Button
              type="button"
              variant="outline-secondary"
              size="sm"
              onClick={downloadBaselineTemplate}
              disabled={importLoading.baseline}
            >
              下載學測 baseline 範例
            </Button>
          )}
        />
        {importError.baseline ? (
          <div className="lj-import-error-inline" role="alert">{importError.baseline}</div>
        ) : null}
        <LearningJourneyImportResultBlock summary={importResult.baseline} />
      </div>
    </div>
  );
}
