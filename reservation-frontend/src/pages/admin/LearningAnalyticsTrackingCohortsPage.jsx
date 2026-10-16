import React, { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteLearningAnalyticsTrackingCohort,
  getLearningAnalyticsTrackingCohort,
  listLearningAnalyticsTrackingCohorts,
} from '../../services/learningAnalyticsService';
import { studentTrajectoryPath } from '../../utils/learningAnalyticsRecentStudents';

const PAGE_SIZE = 40;

function formatHours(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? `${n}` : '—';
}

function formatDelta(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n > 0) return `+${n}`;
  return String(n);
}

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-TW', { hour12: false });
}

function filterSummary(filters = {}) {
  const parts = [];
  if (filters.keyword) parts.push(`關鍵字 ${filters.keyword}`);
  if (filters.department) parts.push(filters.department);
  if (filters.cohort) parts.push(`入學 ${filters.cohort}`);
  if (filters.placement) parts.push(`起始分級 ${filters.placement}`);
  if (filters.hasPreTest === true) parts.push('有前測');
  if (filters.hasPreTest === false) parts.push('無前測');
  if (filters.hasPostTest === true) parts.push('有後測');
  if (filters.hasPostTest === false) parts.push('無後測');
  if (filters.minActivityHours != null) parts.push(`活動 ≥ ${filters.minActivityHours} 小時`);
  if (filters.courseType) parts.push(`修課 ${filters.courseType}`);
  if (filters.minCourseHours != null) parts.push(`修課 ≥ ${filters.minCourseHours} 小時`);
  return parts.length ? parts.join('、') : '未另加篩選';
}

export default function LearningAnalyticsTrackingCohortsPage() {
  const token = localStorage.getItem('token') || '';
  const { id } = useParams();
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setOffset(0);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const request = id
      ? getLearningAnalyticsTrackingCohort(token, id, { limit: PAGE_SIZE, offset })
      : listLearningAnalyticsTrackingCohorts(token);
    request
      .then((payload) => {
        if (cancelled) return;
        if (id) setDetail(payload);
        else setList(payload.items || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || '追蹤名單取得失敗。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, offset, token]);

  const removeCohort = async () => {
    if (!id || deleting) return;
    if (!window.confirm('刪除後無法從這份名單回看當時的數字。確定刪除？')) return;
    setDeleting(true);
    setError('');
    try {
      await deleteLearningAnalyticsTrackingCohort(token, id);
      navigate('/admin/learning-analytics/tracking-cohorts');
    } catch (err) {
      setError(err.message || '刪除追蹤名單失敗。');
      setDeleting(false);
    }
  };

  if (!id) {
    return (
      <section className="la-panel">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h2 className="la-explorer-title">追蹤名單</h2>
            <p className="la-explorer-lead mb-0">
              名單裡的人固定在儲存當下。之後打開同一份名單，會用最新數據和當時的英檢、時數比較。
            </p>
          </div>
          <Link className="btn btn-sm btn-outline-secondary" to="/admin/learning-analytics/explore">回學生探索</Link>
        </div>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {loading ? <div className="text-muted"><Spinner size="sm" className="me-2" />載入中…</div> : null}
        {!loading && list.length === 0 ? <p className="text-muted mb-0">還沒有追蹤名單。請先到學生探索篩選，再按「儲存追蹤名單」。</p> : null}
        {list.length ? (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>名稱</th>
                  <th>人數</th>
                  <th>當時條件</th>
                  <th>建立</th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/admin/learning-analytics/tracking-cohorts/${item.id}`}>{item.name}</Link>
                      {item.truncated ? <div className="small text-muted">儲存時已達人數上限</div> : null}
                    </td>
                    <td>{item.memberCount}</td>
                    <td className="small">{filterSummary(item.filters)}</td>
                    <td className="small text-nowrap">
                      {formatWhen(item.createdAt)}
                      {item.createdByName ? <div className="text-muted">{item.createdByName}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    );
  }

  const cohort = detail?.cohort;
  const summary = detail?.summary;
  const total = detail?.pagination?.total ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
  const currentPage = total === 0 ? 0 : Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <section className="la-panel">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h2 className="la-explorer-title">{cohort?.name || '追蹤名單'}</h2>
          <p className="la-explorer-lead mb-0">
            {cohort ? `${filterSummary(cohort.filters)}。建立於 ${formatWhen(cohort.createdAt)}。` : ''}
            人保持不變，數字拿來和儲存當下比較。
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link className="btn btn-sm btn-outline-secondary" to="/admin/learning-analytics/tracking-cohorts">全部名單</Link>
          <Button type="button" size="sm" variant="outline-danger" disabled={deleting || loading} onClick={removeCohort}>
            {deleting ? '刪除中…' : '刪除名單'}
          </Button>
        </div>
      </div>
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {cohort?.truncated ? (
        <Alert variant="warning" className="py-2">
          儲存時符合條件共 {cohort.sourceTotal} 人，這份名單只保留前 {cohort.memberCount} 人。
        </Alert>
      ) : null}
      {loading && !detail ? <div className="text-muted"><Spinner size="sm" className="me-2" />載入中…</div> : null}
      {summary ? (
        <div className="la-explorer-stats mb-3">
          <div>
            <strong>{summary.memberCount}</strong>
            <span>名單人數</span>
          </div>
          <div>
            <strong>{summary.gainedPostTest}</strong>
            <span>新增後測</span>
          </div>
          <div>
            <strong>{summary.averageActivityDelta == null ? '—' : formatDelta(summary.averageActivityDelta)}</strong>
            <span>平均活動時數差</span>
          </div>
          <div>
            <strong>{summary.averageCourseDelta == null ? '—' : formatDelta(summary.averageCourseDelta)}</strong>
            <span>平均修課時數差</span>
          </div>
        </div>
      ) : null}
      {detail?.items?.length ? (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>學生</th>
                <th>系所</th>
                <th>入學年度</th>
                <th>起始分級</th>
                <th>英檢當時</th>
                <th>英檢現在</th>
                <th>活動當時</th>
                <th>活動現在</th>
                <th>活動差</th>
                <th>修課當時</th>
                <th>修課現在</th>
                <th>修課差</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((row) => (
                <tr key={row.studentId}>
                  <td>
                    <Link className="font-monospace" to={studentTrajectoryPath(row.studentId)}>{row.studentId}</Link>
                    {row.studentName ? <div className="small text-muted">{row.studentName}</div> : null}
                    {row.missingFromSnapshot ? <div className="small text-warning">最新快照沒有這位學生</div> : null}
                  </td>
                  <td>{row.department || '—'}</td>
                  <td>{row.enrollmentCohort || '—'}</td>
                  <td>{row.placementLabel || '—'}</td>
                  <td>{row.baseline.examLabel}</td>
                  <td>{row.current?.examLabel || '—'}</td>
                  <td>{formatHours(row.baseline.activityHours)}</td>
                  <td>{formatHours(row.current?.activityHours)}</td>
                  <td>{formatDelta(row.delta.activityHours)}</td>
                  <td>{formatHours(row.baseline.courseHours)}</td>
                  <td>{formatHours(row.current?.courseHours)}</td>
                  <td>{formatDelta(row.delta.courseHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {totalPages > 1 ? (
        <div className="d-flex justify-content-end align-items-center gap-2 mt-3">
          <span className="small text-muted">第 {currentPage} / 共 {totalPages} 頁</span>
          <Button type="button" size="sm" variant="outline-secondary" disabled={loading || currentPage <= 1} onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}>
            上一頁
          </Button>
          <Button type="button" size="sm" variant="outline-secondary" disabled={loading || currentPage >= totalPages} onClick={() => setOffset((current) => current + PAGE_SIZE)}>
            下一頁
          </Button>
        </div>
      ) : null}
    </section>
  );
}
