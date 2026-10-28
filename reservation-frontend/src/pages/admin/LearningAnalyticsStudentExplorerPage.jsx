import React, { useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Pagination from 'react-bootstrap/Pagination';
import Spinner from 'react-bootstrap/Spinner';
import { Link } from 'react-router-dom';
import {
  createLearningAnalyticsTrackingCohort,
  exportLearningAnalyticsStudentExplorer,
  getLearningAnalyticsStudentExplorer,
} from '../../services/learningAnalyticsService';
import LearningAnalyticsPageFrame from '../../components/learningAnalytics/LearningAnalyticsPageFrame';
import ColumnHead, { HEAD } from '../../components/learningAnalytics/ColumnHead';
import LearningAnalyticsNextSteps from '../../components/learningAnalytics/LearningAnalyticsNextSteps';
import { useLearningAnalyticsWorkingSet } from '../../utils/learningAnalyticsWorkingSet';
import { pushRecentStudent, studentTrajectoryPath } from '../../utils/learningAnalyticsRecentStudents';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';

const PAGE_SIZE = 40;

function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = [1, total, current - 1, current, current + 1]
    .filter((page, index, list) => page >= 1 && page <= total && list.indexOf(page) === index)
    .sort((a, b) => a - b);
  const items = [];
  let previous = 0;
  for (const page of pages) {
    if (page - previous > 1) items.push('…');
    items.push(page);
    previous = page;
  }
  return items;
}

const EMPTY_FILTERS = Object.freeze({
  keyword: '',
  department: '',
  cohort: '',
  placement: '',
  hasPreTest: '',
  hasPostTest: '',
  minActivityHours: '',
  courseType: '',
  minCourseHours: '',
});

const HOURS_OPTIONS = [
  { value: '', label: '不限' },
  { value: '3', label: '3 小時' },
  { value: '6', label: '6 小時' },
  { value: '12', label: '12 小時' },
];

const COURSE_HOURS_OPTIONS = [
  { value: '', label: '不限' },
  { value: '18', label: '18 小時' },
  { value: '36', label: '36 小時' },
  { value: '54', label: '54 小時' },
];

const PHASE_OPTIONS = [
  { value: '', label: '不限' },
  { value: 'true', label: '有' },
  { value: 'false', label: '無' },
];

const PLACEMENT_OPTIONS = ['初級', '中級', '中高級', '高級'];

function filtersToParams(filters, offset) {
  return {
    keyword: filters.keyword.trim(),
    department: filters.department,
    cohort: filters.cohort,
    placement: filters.placement,
    has_pre_test: filters.hasPreTest,
    has_post_test: filters.hasPostTest,
    min_activity_hours: filters.minActivityHours,
    course_type: filters.courseType,
    min_course_hours: filters.minCourseHours,
    limit: PAGE_SIZE,
    offset,
  };
}

function filtersToExportParams(filters) {
  const params = filtersToParams(filters, 0);
  delete params.limit;
  delete params.offset;
  return params;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatHours(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? `${n} hr` : '—';
}

function buildChips(filters) {
  const chips = [];
  if (filters.keyword.trim()) chips.push({ key: 'keyword', label: `姓名或學號 ${filters.keyword.trim()}` });
  if (filters.department) chips.push({ key: 'department', label: filters.department });
  if (filters.cohort) chips.push({ key: 'cohort', label: `入學 ${filters.cohort}` });
  if (filters.placement) chips.push({ key: 'placement', label: `起始分級 ${filters.placement}` });
  if (filters.hasPreTest === 'true') chips.push({ key: 'hasPreTest', label: '有前測' });
  if (filters.hasPreTest === 'false') chips.push({ key: 'hasPreTest', label: '無前測' });
  if (filters.hasPostTest === 'true') chips.push({ key: 'hasPostTest', label: '有後測' });
  if (filters.hasPostTest === 'false') chips.push({ key: 'hasPostTest', label: '無後測' });
  if (filters.minActivityHours) chips.push({ key: 'minActivityHours', label: `活動 ≥ ${filters.minActivityHours} 小時` });
  if (filters.courseType) chips.push({ key: 'courseType', label: `修課 ${filters.courseType}` });
  if (filters.minCourseHours) chips.push({ key: 'minCourseHours', label: `修課 ≥ ${filters.minCourseHours} 小時` });
  return chips;
}

function examPhaseLabel(row) {
  if (row.hasPreTest && row.hasPostTest) return '前後測';
  if (row.hasPreTest) return '前測';
  if (row.hasPostTest) return '後測';
  return row.hasValidExam ? '有效' : '無';
}

function displayName(row) {
  const name = String(row.studentName || '').trim();
  const id = String(row.studentId || '').trim();
  if (!name || name.toUpperCase() === id.toUpperCase()) return '';
  return name;
}

export default function LearningAnalyticsStudentExplorerPage() {
  const token = localStorage.getItem('token') || '';
  const accessProfile = useMemo(() => buildAccessProfile(token), [token]);
  const canExport = hasPermission(accessProfile, P.CAN_EXPORT_LEARNING_ANALYTICS);
  const [draft, setDraft] = useState({ ...EMPTY_FILTERS });
  const [applied, setApplied] = useState({ ...EMPTY_FILTERS });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [cohortName, setCohortName] = useState('');
  const [savingCohort, setSavingCohort] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedCohort, setSavedCohort] = useState(null);
  const [data, setData] = useState(null);
  const [pageDraft, setPageDraft] = useState('1');
  const { active: workingSetActive, withWorkingSet } = useLearningAnalyticsWorkingSet();

  const queryKey = JSON.stringify(applied);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getLearningAnalyticsStudentExplorer(token, withWorkingSet(filtersToParams(applied, offset)))
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || '學生探索名單取得失敗。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, queryKey, offset, applied, withWorkingSet]);

  const chips = useMemo(() => buildChips(applied), [applied]);
  const summary = data?.summary;
  const total = data?.pagination?.total ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
  const currentPage = total === 0 ? 0 : Math.floor(offset / PAGE_SIZE) + 1;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + (data?.items?.length || 0), total);
  const pageItems = pageWindow(currentPage || 1, Math.max(totalPages, 1));

  useEffect(() => {
    if (currentPage > 0) setPageDraft(String(currentPage));
  }, [currentPage]);

  const patchDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const applyFilters = (next) => {
    const filters = next || draft;
    setDraft(filters);
    setApplied(filters);
    setOffset(0);
  };

  const clearChip = (key) => {
    const next = { ...applied, [key]: '' };
    setDraft(next);
    setApplied(next);
    setOffset(0);
  };

  const openStudent = (row) => {
    pushRecentStudent({ studentId: row.studentId, name: row.studentName });
  };

  const exportLimit = data?.options?.exportRowLimit || 5000;

  const goToPage = (page) => {
    const parsed = Number(page);
    if (!Number.isFinite(parsed) || totalPages < 1) return;
    const next = Math.min(totalPages, Math.max(1, Math.floor(parsed)));
    setOffset((next - 1) * PAGE_SIZE);
  };

  const handleExport = async () => {
    if (!canExport || exporting || total === 0) return;
    setExporting(true);
    setExportError('');
    try {
      const { blob, fileName } = await exportLearningAnalyticsStudentExplorer(
        token,
        withWorkingSet(filtersToExportParams(applied)),
      );
      downloadBlob(blob, fileName);
    } catch (err) {
      setExportError(err.message || '匯出篩選名單失敗。');
    } finally {
      setExporting(false);
    }
  };

  const openSave = () => {
    if (savingCohort || total === 0) return;
    setSaveError('');
    setSavedCohort(null);
    setSaveOpen(true);
  };

  const handleSaveCohort = async (event) => {
    event.preventDefault();
    if (savingCohort || total === 0) return;
    setSavingCohort(true);
    setSaveError('');
    try {
      const created = await createLearningAnalyticsTrackingCohort(token, {
        name: cohortName,
        filters: filtersToExportParams(applied),
      });
      setSavedCohort(created);
      setCohortName('');
    } catch (err) {
      setSaveError(err.message || '儲存追蹤名單失敗。');
    } finally {
      setSavingCohort(false);
    }
  };

  return (
    <LearningAnalyticsPageFrame
      title="學生探索"
      showWorkingSet
      workingSetHere="explore"
      question="用條件找出一批學生，再點進個人軌跡。"
      scope="分析快照裡的學生。條件改完後按搜尋才會重查。學測只用於起始分級，不算英檢前測。"
    >
    <div className="la-explorer">
      <aside className="la-explorer-filters" aria-label="篩選條件">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <details className="la-explorer-group" open>
            <summary>學生背景</summary>
            <label className="la-explorer-field">
              <span>姓名或學號</span>
              <Form.Control
                size="sm"
                value={draft.keyword}
                placeholder="姓名或學號"
                onChange={(event) => patchDraft({ keyword: event.target.value })}
              />
            </label>
            <label className="la-explorer-field">
              <span>系所</span>
              <Form.Select
                size="sm"
                value={draft.department}
                onChange={(event) => patchDraft({ department: event.target.value })}
              >
                <option value="">全部系所</option>
                {(data?.options?.departments || []).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </Form.Select>
            </label>
            <label className="la-explorer-field">
              <span>入學年度</span>
              <Form.Select
                size="sm"
                value={draft.cohort}
                onChange={(event) => patchDraft({ cohort: event.target.value })}
              >
                <option value="">全部年度</option>
                {(data?.options?.cohorts || []).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </Form.Select>
            </label>
            <label className="la-explorer-field">
              <span>起始分級</span>
              <Form.Select
                size="sm"
                value={draft.placement}
                onChange={(event) => patchDraft({ placement: event.target.value })}
              >
                <option value="">不限</option>
                {(data?.options?.placements?.length ? data.options.placements : PLACEMENT_OPTIONS).map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </Form.Select>
              <small>依入學英文分級。學測成績只作為分級依據，不是前測。</small>
            </label>
          </details>

          <details className="la-explorer-group" open>
            <summary>學習紀錄</summary>
            <div className="la-explorer-block">
              <div className="la-explorer-block-title">有效英檢</div>
              <label className="la-explorer-field">
                <span>前測</span>
                <Form.Select
                  size="sm"
                  value={draft.hasPreTest}
                  onChange={(event) => patchDraft({ hasPreTest: event.target.value })}
                >
                  {PHASE_OPTIONS.map((option) => (
                    <option key={`pre-${option.value || 'any'}`} value={option.value}>{option.label}</option>
                  ))}
                </Form.Select>
              </label>
              <label className="la-explorer-field">
                <span>後測</span>
                <Form.Select
                  size="sm"
                  value={draft.hasPostTest}
                  onChange={(event) => patchDraft({ hasPostTest: event.target.value })}
                >
                  {PHASE_OPTIONS.map((option) => (
                    <option key={`post-${option.value || 'any'}`} value={option.value}>{option.label}</option>
                  ))}
                </Form.Select>
              </label>
              <small className="la-explorer-note">前測是第一梯有效英檢（含只有一次）；後測是第二梯。學測不算前測。</small>
            </div>
            <label className="la-explorer-field">
              <span>活動時數至少</span>
              <Form.Select
                size="sm"
                value={draft.minActivityHours}
                onChange={(event) => patchDraft({ minActivityHours: event.target.value })}
              >
                {HOURS_OPTIONS.map((option) => (
                  <option key={option.value || 'any'} value={option.value}>{option.label}</option>
                ))}
              </Form.Select>
            </label>
            <div className="la-explorer-block">
              <div className="la-explorer-block-title">修課</div>
              <label className="la-explorer-field">
                <span>修課類型</span>
                <Form.Select
                  size="sm"
                  value={draft.courseType}
                  onChange={(event) => patchDraft({ courseType: event.target.value })}
                >
                  <option value="">不限</option>
                  {(data?.options?.courseTypes || [
                    { value: 'GE', label: '通識英文（GE）' },
                    { value: 'EAP', label: '學術英文（EAP）' },
                    { value: 'ESP', label: '專業英文（ESP）' },
                  ]).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Form.Select>
              </label>
              <label className="la-explorer-field">
                <span>修課時數至少</span>
                <Form.Select
                  size="sm"
                  value={draft.minCourseHours}
                  onChange={(event) => patchDraft({ minCourseHours: event.target.value })}
                >
                  {COURSE_HOURS_OPTIONS.map((option) => (
                    <option key={`course-${option.value || 'any'}`} value={option.value}>{option.label}</option>
                  ))}
                </Form.Select>
              </label>
            </div>
          </details>

          <div className="la-explorer-actions">
            <Button type="submit" variant="primary" size="sm">搜尋</Button>
            <Button type="button" variant="outline-secondary" size="sm" onClick={() => applyFilters({ ...EMPTY_FILTERS })}>
              重設
            </Button>
          </div>
        </form>
      </aside>

      <section className="la-explorer-results" aria-label="學生名單">
        <div className="la-explorer-toolbar">
          <div>
            <h2 className="la-explorer-title">學生名單</h2>
            <p className="la-explorer-lead">
              {data?.snapshotVersion ? `資料版本 ${data.snapshotVersion}。` : '符合條件的學生會列在下方。'}
            </p>
          </div>
          <div className="la-explorer-chips" aria-label="目前篩選">
            {chips.length === 0 ? <span className="la-explorer-chip is-quiet">目前是全部學生</span> : null}
            {chips.map((chip) => (
              <button key={chip.key} type="button" className="la-explorer-chip" onClick={() => clearChip(chip.key)}>
                {chip.label}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
          <div className="la-explorer-stats">
            <div>
              <strong>{summary ? summary.matched.toLocaleString('zh-Hant') : '—'}</strong>
              <span>符合條件</span>
            </div>
            <div>
              <strong>{summary ? summary.withValidExam.toLocaleString('zh-Hant') : '—'}</strong>
              <span>具有效英檢</span>
            </div>
            <div>
              <strong>{summary?.averageActivityHours == null ? '—' : `${summary.averageActivityHours} hr`}</strong>
              <span>平均活動時數</span>
            </div>
          </div>
        </div>
        {data?.handoff?.studentIds?.length && (chips.length > 0 || workingSetActive || data.handoff.total <= 2000) ? (
          <LearningAnalyticsNextSteps
            label={workingSetActive ? '目前這批人裡、符合搜尋條件的學生' : '目前搜尋結果'}
            studentIds={data.handoff.studentIds}
            total={data.handoff.total}
            truncated={data.handoff.truncated}
            note={workingSetActive ? '會再依目前的搜尋條件縮小。' : ''}
            source="student-explorer"
            sourcePath="/admin/learning-analytics/explore"
            hide={['explore']}
          />
        ) : null}

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <div className="la-panel">
          <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
            <div className="la-panel-title mb-0">學生名單</div>
            <div className="d-flex align-items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline-secondary"
                disabled={loading || savingCohort || total === 0}
                onClick={openSave}
              >
                儲存追蹤名單
              </Button>
              {canExport ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline-primary"
                  disabled={loading || exporting || total === 0}
                  onClick={handleExport}
                >
                  {exporting ? '匯出中…' : '匯出篩選名單'}
                </Button>
              ) : (
                <span className="small text-muted">匯出名單需要學習成效分析匯出權限。</span>
              )}
              <div className="small text-muted">
                {loading ? '載入中…' : `${pageStart}–${pageEnd} / ${total.toLocaleString('zh-Hant')}`}
              </div>
            </div>
          </div>
          {total > exportLimit ? (
            <p className="small text-muted mb-2">
              符合條件 {total.toLocaleString('zh-Hant')} 人，匯出與追蹤名單最多各保留 {exportLimit.toLocaleString('zh-Hant')} 人（依學號排序）。
            </p>
          ) : null}
          {exportError ? <Alert variant="danger" className="py-2">{exportError}</Alert> : null}
          <Modal show={saveOpen} onHide={() => setSaveOpen(false)} centered>
            <Form onSubmit={handleSaveCohort}>
              <Modal.Header closeButton>
                <Modal.Title as="h2" className="h5 mb-0">儲存追蹤名單</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <p className="small text-muted">
                  會固定目前篩選結果的學號，以及當時的英檢、活動時數與修課時數。之後打開同一份名單，用最新數據和這次的數字比較。
                </p>
                {total > exportLimit ? (
                  <Alert variant="warning" className="py-2">
                    目前符合 {total.toLocaleString('zh-Hant')} 人，這份名單只會保留前 {exportLimit.toLocaleString('zh-Hant')} 人。
                  </Alert>
                ) : (
                  <p className="small mb-2">將儲存 {total.toLocaleString('zh-Hant')} 人。</p>
                )}
                <Form.Group>
                  <Form.Label>名單名稱</Form.Label>
                  <Form.Control
                    value={cohortName}
                    maxLength={80}
                    autoFocus
                    placeholder="例如：114 中高級、尚無後測"
                    onChange={(event) => setCohortName(event.target.value)}
                  />
                </Form.Group>
                {saveError ? <Alert variant="danger" className="py-2 mt-3 mb-0">{saveError}</Alert> : null}
                {savedCohort ? (
                  <Alert variant="success" className="py-2 mt-3 mb-0">
                    已儲存「{savedCohort.name}」。
                    {' '}
                    <Link to={`/admin/learning-analytics/tracking-cohorts/${savedCohort.id}`}>打開這份名單</Link>
                  </Alert>
                ) : null}
              </Modal.Body>
              <Modal.Footer>
                <Button type="button" variant="outline-secondary" onClick={() => setSaveOpen(false)}>關閉</Button>
                <Button type="submit" variant="primary" disabled={savingCohort || !cohortName.trim()}>
                  {savingCohort ? '儲存中…' : '儲存'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal>
          {loading && !data ? (
            <div className="py-4 text-center text-muted">
              <Spinner size="sm" className="me-2" />
              正在讀取分析快照…
            </div>
          ) : null}
          {!loading && data && data.items.length === 0 ? (
            <p className="text-muted mb-0">
              {chips.length === 0 && !(data.options?.departments?.length)
                ? '目前沒有分析快照可探索。請先完成學習歷程分析重建。'
                : '這個條件下沒有學生。可在左側放寬條件後再套用。'}
            </p>
          ) : null}
          {data?.items?.length ? (
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>學生</th>
                    <th>系所</th>
                    <th><ColumnHead {...HEAD.admissionYear} /></th>
                    <th><ColumnHead {...HEAD.placement} /></th>
                    <th><ColumnHead {...HEAD.examPhase} /></th>
                    <th className="text-end"><ColumnHead {...HEAD.activityHours} /></th>
                    <th className="text-end"><ColumnHead {...HEAD.courseHours} /></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => {
                    const name = displayName(row);
                    return (
                    <tr key={row.studentId}>
                      <td>
                        <Link
                          className="font-monospace"
                          to={studentTrajectoryPath(row.studentId)}
                          onClick={() => openStudent(row)}
                        >
                          {row.studentId}
                        </Link>
                        {name ? <div className="small text-muted">{name}</div> : null}
                      </td>
                      <td>{row.department || '—'}</td>
                      <td>{row.cohort || '—'}</td>
                      <td>{row.placementLabel || '—'}</td>
                      <td>{examPhaseLabel(row)}</td>
                      <td>{formatHours(row.totalActivityHours)}</td>
                      <td>{formatHours(row.totalCourseHours)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          {totalPages > 0 ? (
            <div className="d-flex flex-wrap justify-content-end align-items-center gap-2 mt-3">
              <Pagination className="mb-0" size="sm" aria-label="學生名單分頁">
                <Pagination.Prev
                  disabled={loading || currentPage <= 1}
                  onClick={(event) => {
                    event.preventDefault();
                    goToPage(currentPage - 1);
                  }}
                >
                  上一頁
                </Pagination.Prev>
                {pageItems.map((item, index) => (
                  item === '…' ? (
                    <Pagination.Ellipsis key={`gap-${index}`} disabled />
                  ) : (
                    <Pagination.Item
                      key={item}
                      active={item === currentPage}
                      disabled={loading}
                      onClick={(event) => {
                        event.preventDefault();
                        goToPage(item);
                      }}
                    >
                      {item}
                    </Pagination.Item>
                  )
                ))}
                <Pagination.Next
                  disabled={loading || currentPage >= totalPages}
                  onClick={(event) => {
                    event.preventDefault();
                    goToPage(currentPage + 1);
                  }}
                >
                  下一頁
                </Pagination.Next>
              </Pagination>
              <form
                className="d-flex align-items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  goToPage(pageDraft);
                }}
              >
                <span className="small text-muted text-nowrap">共 {totalPages} 頁</span>
                <Form.Control
                  type="number"
                  size="sm"
                  min={1}
                  max={totalPages}
                  value={pageDraft}
                  disabled={loading || totalPages <= 1}
                  aria-label="前往頁碼"
                  style={{ width: '4.5rem' }}
                  onChange={(event) => setPageDraft(event.target.value)}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline-secondary"
                  disabled={loading || totalPages <= 1}
                >
                  前往
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </section>
    </div>
    </LearningAnalyticsPageFrame>
  );
}
