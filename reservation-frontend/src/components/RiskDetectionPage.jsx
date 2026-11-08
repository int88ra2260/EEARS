import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Button, Spinner, Alert, Form } from 'react-bootstrap';
import { getCurrentSemester, SEMESTER_OPTIONS } from '../utils/semesterUtils';
import { buildAccessProfile } from '../utils/accessControl';
import { canAccessAdminRoute } from '../constants/adminRouteAccess';
import { handleAPIError } from '../utils/errorHandler';
import { fetchAnalyticsRisk } from '../services/reportsAdminApi';
import '../pages/admin/operationsSurfaces.css';

const REASON_KEY_HINT = {
  noShow: '未到／缺席',
  lowParticipation: '低參與',
  noBestep: 'BESTEP 狀態異常',
  violation: '違規紀錄',
};

function useNarrowScreen() {
  const query = '(max-width: 767.98px)';
  const [narrow, setNarrow] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  ));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return narrow;
}

function canOpenStudentRecord(accessProfile, studentId) {
  if (!studentId) return false;
  return canAccessAdminRoute(accessProfile, `/admin/analytics/student/${studentId}`)
    && canAccessAdminRoute(accessProfile, `/admin/learning-journey/students/${studentId}`);
}

function reasonLabel(reason) {
  return reason.label || REASON_KEY_HINT[reason.key] || reason.key || '未命名條件';
}

export default function RiskDetectionPage() {
  const outlet = useOutletContext() || {};
  const token = outlet.token || localStorage.getItem('token');
  const accessProfile = useMemo(() => buildAccessProfile(token), [token]);
  const narrow = useNarrowScreen();
  const requestSeq = useRef(0);

  const [semester, setSemester] = useState(getCurrentSemester() || '114-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [risks, setRisks] = useState([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!token || !semester) return;
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    setError('');
    setRisks([]);
    try {
      const json = await fetchAnalyticsRisk(token, semester);
      if (seq !== requestSeq.current) return;
      setRisks(Array.isArray(json?.risks) ? json.risks : []);
    } catch (e) {
      if (seq !== requestSeq.current) return;
      const fallback = handleAPIError(e);
      const msg = e?.message && typeof e.message === 'string' && e.message.trim()
        ? e.message
        : fallback?.display || fallback?.zh || '載入失敗';
      setError(msg);
      setRisks([]);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [token, semester]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRisks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return risks;
    return risks.filter((r) => {
      const sid = String(r.studentId || '').toLowerCase();
      const name = String(r.studentName || '').toLowerCase();
      const dept = String(r.department || '').toLowerCase();
      const cls = String(r.className || r.classId || '').toLowerCase();
      return sid.includes(q) || name.includes(q) || dept.includes(q) || cls.includes(q);
    });
  }, [risks, search]);

  const profileQuery = `fromSemester=${encodeURIComponent(semester)}&toSemester=${encodeURIComponent(semester)}`;

  const renderReasons = (row) => {
    const reasons = row.reasons || [];
    if (reasons.length === 0) return <p className="small text-muted mb-0">這筆沒有回傳判定條件。</p>;
    return (
      <ul className="small mb-0 ps-3">
        {reasons.map((reason, idx) => (
          <li key={`${row.studentId}-${reason.key}-${idx}`}>
            {reasonLabel(reason)}
            {reason.value === null || reason.value === undefined ? '，觀測值未提供' : `，觀測值 ${reason.value}`}
            {reason.contribution === null || reason.contribution === undefined
              ? ''
              : `，既有加權 ${reason.contribution}`}
          </li>
        ))}
      </ul>
    );
  };

  const renderStudent = (row) => {
    const sid = row.studentId;
    const profileTo = canOpenStudentRecord(accessProfile, sid)
      ? `/admin/analytics/student/${encodeURIComponent(sid)}?${profileQuery}`
      : '';
    const place = [row.department, row.className || row.classId].filter(Boolean).join(' · ') || '未提供系所或班級';
    return (
      <article key={sid} className="ops-risk-card" data-testid="risk-student">
        <h2>{row.studentName && String(row.studentName).trim() ? row.studentName : '未提供姓名'}</h2>
        <p className="small text-muted mb-2">{`${sid} · ${place}`}</p>
        <dl className="ops-result-card__metrics">
          <div>
            <dt>既有分數</dt>
            <dd>{row.riskScore === null || row.riskScore === undefined ? '—' : row.riskScore}</dd>
          </div>
          <div>
            <dt>名單狀態</dt>
            <dd>{row.riskLevel === 'high' ? '既有高關注' : (row.riskLevel || '未提供')}</dd>
          </div>
        </dl>
        {narrow ? (
          <details>
            <summary>判定條件</summary>
            {renderReasons(row)}
          </details>
        ) : renderReasons(row)}
        <p className="small mt-2 mb-0">
          {profileTo ? (
            <>
              <Link to={profileTo}>查看學習歷程</Link>
              <span className="text-muted">。學習歷程是另一份資料，不會沿用這張名單的分數。</span>
            </>
          ) : (
            <span className="text-muted">這個帳號不能開啟這位學生的學習歷程。</span>
          )}
        </p>
      </article>
    );
  };

  return (
    <div className="container-fluid px-2 px-md-3">
      <header className="mb-3">
        <h1 className="h4 mb-2">班級名冊高關注名單</h1>
        <p className="text-muted mb-2">
          側欄的「高關注名單」就是這一頁。它依既有 high 規則列出所選學期班級名冊裡的學生，供行政追蹤。既有分數沒有在這裡重新計算。
        </p>
        <p className="small text-muted mb-0">
          母體是所選學期的班級名冊，不是全中心所有學生。名單只包含 riskLevel 為 high 的列，沒有中、低分級。這不是活動預約異常名單，也不是英語學習成效不足的判定。
        </p>
      </header>

      <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <Form.Group>
          <Form.Label className="small text-muted mb-1" htmlFor="risk-semester">學期</Form.Label>
          <Form.Select
            id="risk-semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            style={{ width: 180 }}
          >
            {SEMESTER_OPTIONS.filter((o) => o.value).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group className="flex-grow-1" style={{ minWidth: 200, maxWidth: 420 }}>
          <Form.Label className="small text-muted mb-1" htmlFor="risk-search">在這份名單裡尋找</Form.Label>
          <Form.Control
            id="risk-search"
            size="sm"
            placeholder="學號、姓名、系所或班級"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Form.Group>
        <Button variant="outline-primary" size="sm" onClick={load} disabled={loading}>
          {loading ? '更新中…' : '重新整理'}
        </Button>
      </div>

      <Alert variant="secondary" className="small py-2">
        Excel 在「營運報表下載」的高關注名單工作簿。那份檔案依學期重新產生，不套用這裡的搜尋字。
        {' '}
        <Link to="/admin/reports">前往報表下載</Link>
      </Alert>

      {loading && (
        <div className="text-center py-5" data-testid="risk-loading">
          <Spinner animation="border" className="text-primary" />
          <div className="text-muted small mt-2">正在讀取 {semester} 的班級名冊名單…</div>
        </div>
      )}
      {error && !loading && <Alert variant="danger">{error}</Alert>}

      {!loading && !error && risks.length === 0 && (
        <Alert variant="secondary">
          本學期沒有符合目前高關注條件的名單。這不代表所有學生都沒有需要處理的事項。
        </Alert>
      )}
      {!loading && risks.length > 0 && filteredRisks.length === 0 && (
        <Alert variant="warning">這份名單裡沒有符合搜尋的學生。</Alert>
      )}
      {!loading && filteredRisks.length > 0 && (
        <section aria-label="高關注學生">
          <p className="small text-muted">
            {semester}，名單 {risks.length} 人
            {search.trim() ? `，搜尋後 ${filteredRisks.length} 人` : ''}。
          </p>
          {narrow ? filteredRisks.map(renderStudent) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>學生</th>
                    <th>系所／班級</th>
                    <th>既有分數</th>
                    <th>判定條件</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRisks.map((row) => {
                    const sid = row.studentId;
                    const profileTo = canOpenStudentRecord(accessProfile, sid)
                      ? `/admin/analytics/student/${encodeURIComponent(sid)}?${profileQuery}`
                      : '';
                    return (
                      <tr key={sid} data-testid="risk-student">
                        <td>
                          {profileTo ? (
                            <Link to={profileTo}>{row.studentName || sid}</Link>
                          ) : (
                            <span>{row.studentName || sid}</span>
                          )}
                          <div className="small text-muted">{sid}</div>
                          {profileTo ? null : (
                            <div className="small text-muted">這個帳號不能開啟這位學生的學習歷程。</div>
                          )}
                        </td>
                        <td className="small">
                          {[row.department, row.className || row.classId].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td>{row.riskScore === null || row.riskScore === undefined ? '—' : row.riskScore}</td>
                        <td>{renderReasons(row)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
