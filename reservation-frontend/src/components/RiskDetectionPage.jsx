import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { Card, Table, Button, Spinner, Alert, Form, Badge } from 'react-bootstrap';
import { getCurrentSemester, SEMESTER_OPTIONS } from '../utils/semesterUtils';
import { handleAPIError } from '../utils/errorHandler';
import { fetchAnalyticsRisk } from '../services/reportsAdminApi';

const RISK_LABEL = { low: '低', medium: '中', high: '高' };

/** 後端 key 之行政補充說明（若已有 label 仍以 label 為主） */
const REASON_KEY_HINT = {
  noShow: '未到／缺席',
  lowParticipation: '低參與',
  noBestep: 'BESTEP 狀態異常',
  violation: '違規紀錄',
};

function formatReasonLine(reason) {
  const label = reason.label || REASON_KEY_HINT[reason.key] || reason.key;
  return (
    <span>
      <strong>{label}</strong>
      {' — '}
      觀測值 <code>{String(reason.value)}</code>，影響分數 <span className="text-danger">+{reason.contribution}</span>
    </span>
  );
}

export default function RiskDetectionPage() {
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const token = outlet.token || localStorage.getItem('token');

  const [semester, setSemester] = useState(getCurrentSemester() || '114-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [risks, setRisks] = useState([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!token || !semester) return;
    setLoading(true);
    setError('');
    try {
      const json = await fetchAnalyticsRisk(token, semester);
      setRisks(json.risks || []);
    } catch (e) {
      const fallback = handleAPIError(e);
      const msg =
        e?.message && typeof e.message === 'string' && e.message.trim()
          ? e.message
          : fallback?.display || fallback?.zh || '載入失敗';
      setError(msg);
      setRisks([]);
    } finally {
      setLoading(false);
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

  return (
    <div className="container-fluid px-2 px-md-3">
      <Alert variant="info" className="small py-2 mb-3">
        <strong>母體：</strong>本學期 <code>class_memberships</code> 曾出現之 DISTINCT 學生（班級名冊口徑，非 LJ active roster）。
        <strong> 規則：</strong>風險分數由未到、簽到參與偏低、BESTEP 報名狀態、違規紀錄等因子加權。
        <strong> 清單：</strong>目前 API 僅回傳 <strong>高風險（riskLevel=high）</strong> 學生，不含中／低風險。
      </Alert>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div className="flex-grow-1" style={{ minWidth: 200, maxWidth: 420 }}>
          <Form.Label className="small text-muted mb-1">搜尋（學號、姓名、系所、班級）</Form.Label>
          <Form.Control
            size="sm"
            placeholder="輸入關鍵字篩選…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Form.Select value={semester} onChange={(e) => setSemester(e.target.value)} style={{ width: 180 }}>
            {SEMESTER_OPTIONS.filter((o) => o.value).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Form.Select>
          <Button variant="outline-primary" size="sm" onClick={load} disabled={loading}>
            {loading ? '更新中…' : '重新整理'}
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={() => navigate('/admin/analytics/overview')}>
            返回行政總覽
          </Button>
        </div>
      </div>

      <Alert variant="secondary" className="small py-2 mb-3">
        <strong>匯出：</strong>請至「報表下載」選擇 <strong>高風險學生名單</strong>（Excel）；本頁提供即時篩選與學習歷程連結。
      </Alert>

      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" className="text-primary" />
          <div className="text-muted small mt-2">載入高風險名冊…</div>
        </div>
      )}
      {error && !loading && <Alert variant="danger">{error}</Alert>}

      {!loading && (
        <Card className="border-danger-subtle">
          <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2 bg-danger-subtle">
            <div className="fw-semibold">班級名冊高風險學生（僅列 high）</div>
            <div className="small text-muted">
              學期：{semester}，筆數：{risks.length}
              {search.trim() ? `（篩選後 ${filteredRisks.length} 筆）` : ''}
            </div>
          </Card.Header>
          <Card.Body>
            {!error && risks.length === 0 && (
              <Alert variant="success" className="mb-3 py-2">
                目前沒有高風險學生（於本學期班級名冊母體與現行規則下）。
              </Alert>
            )}
            {risks.length > 0 && filteredRisks.length === 0 && (
              <Alert variant="warning" className="mb-3 py-2">
                沒有符合搜尋條件的學生，請調整關鍵字。
              </Alert>
            )}
            <div className="table-responsive">
              <Table striped hover size="sm" className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>學號</th>
                    <th>姓名</th>
                    <th>系所／班級</th>
                    <th>風險分數</th>
                    <th>風險等級</th>
                    <th>風險原因</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRisks.map((r) => {
                    const sid = r.studentId;
                    const profileTo = `/admin/analytics/student/${encodeURIComponent(sid)}?${profileQuery}`;
                    const showName = r.studentName && String(r.studentName).trim();
                    return (
                      <tr key={sid}>
                        <td>
                          <Link to={profileTo}>{sid}</Link>
                        </td>
                        <td>
                          {showName ? (
                            <Link to={profileTo} className="text-decoration-none">
                              {r.studentName}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="small text-muted">
                          {[r.department, r.className || r.classId].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td>{r.riskScore}</td>
                        <td>
                          <Badge bg="danger">{RISK_LABEL[r.riskLevel] || r.riskLevel}</Badge>
                        </td>
                        <td className="small">
                          {(r.reasons || []).length > 0 ? (
                            <ul className="mb-0 ps-3">
                              {(r.reasons || []).map((reason, idx) => (
                                <li key={`${sid}-${reason.key}-${idx}`}>{formatReasonLine(reason)}</li>
                              ))}
                            </ul>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
