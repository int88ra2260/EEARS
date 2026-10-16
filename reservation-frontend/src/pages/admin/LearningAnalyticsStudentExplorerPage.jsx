import React, { useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import { Link } from 'react-router-dom';
import { getLearningAnalyticsStudentExplorer } from '../../services/learningAnalyticsService';
import { pushRecentStudent, studentTrajectoryPath } from '../../utils/learningAnalyticsRecentStudents';

const PAGE_SIZE = 40;

const EMPTY_FILTERS = Object.freeze({
  keyword: '',
  department: '',
  cohort: '',
  minBaselineScore: '',
  hasValidExam: '',
  minActivityHours: '',
});

const SCORE_OPTIONS = [
  { value: '', label: '不限' },
  { value: '8', label: '8' },
  { value: '10', label: '10' },
  { value: '13', label: '13' },
];

const HOURS_OPTIONS = [
  { value: '', label: '不限' },
  { value: '3', label: '3 小時' },
  { value: '6', label: '6 小時' },
  { value: '12', label: '12 小時' },
];

const EXAM_OPTIONS = [
  { value: '', label: '不限' },
  { value: 'true', label: '有有效英檢' },
  { value: 'false', label: '無有效英檢' },
];

const FALLBACK_UNAVAILABLE = [
  {
    id: 'placement',
    label: '起始分級',
    reason: '分析快照只有 CEFR，沒有初級／中級／中高級／高級這套分級。',
  },
  {
    id: 'eap_esp',
    label: 'EAP／ESP 修課',
    reason: '學生快照沒有「已修畢 EAP／ESP」旗標。',
  },
  {
    id: 'exam_pairing',
    label: '英檢配對',
    reason: '不能判斷有前測尚無後測，也不能判斷指定技能是否進步。',
  },
];

const PRESETS = [
  { id: 'all', label: '全部學生', disabled: false, filters: EMPTY_FILTERS },
  {
    id: 'activity6',
    label: '活動參與 ≥ 6 小時',
    disabled: false,
    filters: { ...EMPTY_FILTERS, minActivityHours: '6' },
  },
  { id: 'low', label: '初・中級學生', disabled: true, needs: 'placement' },
  { id: 'awaitPost', label: '尚待後測', disabled: true, needs: 'exam_pairing' },
  { id: 'coursePair', label: '修課 × 前後測', disabled: true, needs: 'eap_esp' },
];

function filtersToParams(filters, offset) {
  return {
    keyword: filters.keyword.trim(),
    department: filters.department,
    cohort: filters.cohort,
    min_baseline_score: filters.minBaselineScore,
    has_valid_exam: filters.hasValidExam,
    min_activity_hours: filters.minActivityHours,
    limit: PAGE_SIZE,
    offset,
  };
}

function formatScore(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '—';
}

function formatHours(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? `${n} hr` : '—';
}

function buildChips(filters) {
  const chips = [];
  if (filters.keyword.trim()) chips.push({ key: 'keyword', label: `搜尋 ${filters.keyword.trim()}` });
  if (filters.department) chips.push({ key: 'department', label: filters.department });
  if (filters.cohort) chips.push({ key: 'cohort', label: `入學 ${filters.cohort}` });
  if (filters.minBaselineScore) chips.push({ key: 'minBaselineScore', label: `學測 ≥ ${filters.minBaselineScore}` });
  if (filters.hasValidExam === 'true') chips.push({ key: 'hasValidExam', label: '有有效英檢' });
  if (filters.hasValidExam === 'false') chips.push({ key: 'hasValidExam', label: '無有效英檢' });
  if (filters.minActivityHours) chips.push({ key: 'minActivityHours', label: `活動 ≥ ${filters.minActivityHours} 小時` });
  return chips;
}

function reasonFor(unavailable, id) {
  return unavailable.find((item) => item.id === id)?.reason || '';
}

export default function LearningAnalyticsStudentExplorerPage() {
  const token = localStorage.getItem('token') || '';
  const [draft, setDraft] = useState({ ...EMPTY_FILTERS });
  const [applied, setApplied] = useState({ ...EMPTY_FILTERS });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const queryKey = JSON.stringify(applied);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getLearningAnalyticsStudentExplorer(token, filtersToParams(applied, offset))
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
  }, [token, queryKey, offset, applied]);

  const unavailable = data?.unavailableFilters?.length ? data.unavailableFilters : FALLBACK_UNAVAILABLE;
  const chips = useMemo(() => buildChips(applied), [applied]);
  const summary = data?.summary;
  const total = data?.pagination?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + (data?.items?.length || 0), total);

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

  return (
    <div className="la-explorer">
      <aside className="la-explorer-filters" aria-label="篩選條件">
        <div className="la-explorer-presets" role="group" aria-label="預設條件">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`la-explorer-preset${preset.disabled ? ' is-disabled' : ''}`}
              disabled={preset.disabled}
              title={preset.disabled ? reasonFor(unavailable, preset.needs) : preset.label}
              onClick={() => applyFilters({ ...preset.filters })}
            >
              {preset.label}
              {preset.disabled ? <span>待補資料</span> : null}
            </button>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <details className="la-explorer-group" open>
            <summary>學生背景</summary>
            <label className="la-explorer-field">
              <span>搜尋學生</span>
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
              <span>學測英文級分至少</span>
              <Form.Select
                size="sm"
                value={draft.minBaselineScore}
                onChange={(event) => patchDraft({ minBaselineScore: event.target.value })}
              >
                {SCORE_OPTIONS.map((option) => (
                  <option key={option.value || 'any'} value={option.value}>{option.label}</option>
                ))}
              </Form.Select>
            </label>
            <label className="la-explorer-field">
              <span>起始分級 <em>待補資料</em></span>
              <Form.Select size="sm" disabled value="">
                <option>尚不能篩選</option>
              </Form.Select>
              <small>{reasonFor(unavailable, 'placement')}</small>
            </label>
          </details>

          <details className="la-explorer-group" open>
            <summary>學習紀錄</summary>
            <label className="la-explorer-field">
              <span>EAP／ESP 修課 <em>待補資料</em></span>
              <Form.Select size="sm" disabled value="">
                <option>尚不能篩選</option>
              </Form.Select>
              <small>{reasonFor(unavailable, 'eap_esp')}</small>
            </label>
            <label className="la-explorer-field">
              <span>有效英檢</span>
              <Form.Select
                size="sm"
                value={draft.hasValidExam}
                onChange={(event) => patchDraft({ hasValidExam: event.target.value })}
              >
                {EXAM_OPTIONS.map((option) => (
                  <option key={option.value || 'any'} value={option.value}>{option.label}</option>
                ))}
              </Form.Select>
            </label>
            <label className="la-explorer-field">
              <span>英檢配對 <em>待補資料</em></span>
              <Form.Select size="sm" disabled value="">
                <option>尚不能篩選</option>
              </Form.Select>
              <small>{reasonFor(unavailable, 'exam_pairing')}</small>
            </label>
            <label className="la-explorer-field">
              <span>活動認列時數至少</span>
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
          </details>

          <div className="la-explorer-actions">
            <Button type="submit" variant="primary" size="sm">套用篩選</Button>
            <Button type="button" variant="outline-secondary" size="sm" onClick={() => applyFilters({ ...EMPTY_FILTERS })}>
              重設
            </Button>
          </div>
        </form>
      </aside>

      <section className="la-explorer-results" aria-label="學生名單">
        <div className="la-explorer-toolbar">
          <div>
            <h2 className="la-explorer-title">學生探索</h2>
            <p className="la-explorer-lead">
              調整左側條件後按「套用篩選」。往下看名單時，篩選區會留在畫面左側。
              {data?.snapshotVersion ? ` 資料版本 ${data.snapshotVersion}。` : ''}
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

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <div className="la-panel">
          <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
            <div className="la-panel-title mb-0">學生名單</div>
            <div className="small text-muted">
              {loading ? '載入中…' : `${pageStart}–${pageEnd} / ${total.toLocaleString('zh-Hant')}`}
            </div>
          </div>
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
                    <th>入學年度</th>
                    <th>學測英文</th>
                    <th>起始 CEFR</th>
                    <th>有效英檢</th>
                    <th>曾重測</th>
                    <th>活動時數</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.studentId}>
                      <td>
                        <Link
                          className="font-monospace"
                          to={studentTrajectoryPath(row.studentId)}
                          onClick={() => openStudent(row)}
                        >
                          {row.studentId}
                        </Link>
                        <div className="small text-muted">{row.studentName || '尚無名冊姓名'}</div>
                      </td>
                      <td>{row.department || '—'}</td>
                      <td>{row.cohort || '—'}</td>
                      <td>{formatScore(row.baselineEnglishScore)}</td>
                      <td>{row.baselineCefr || '—'}</td>
                      <td>{row.hasValidExam ? '有' : '無'}</td>
                      <td>{row.retestFlag ? '是' : '否'}</td>
                      <td>{formatHours(row.totalActivityHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button
              type="button"
              size="sm"
              variant="outline-secondary"
              disabled={loading || offset <= 0}
              onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
            >
              上一頁
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline-secondary"
              disabled={loading || offset + PAGE_SIZE >= total}
              onClick={() => setOffset((current) => current + PAGE_SIZE)}
            >
              下一頁
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
