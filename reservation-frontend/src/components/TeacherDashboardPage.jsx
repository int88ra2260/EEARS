import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Card, Table, Button, Spinner, Alert, Form } from 'react-bootstrap';
import { getCurrentSemester, SEMESTER_OPTIONS } from '../utils/semesterUtils';
import { handleAPIError } from '../utils/errorHandler';
import { fetchTeacherDashboard } from '../services/reportsAdminApi';
import { parseJwtPayload } from '../utils/jwtPayload';

export default function TeacherDashboardPage() {
  const navigate = useNavigate();
  const outlet = useOutletContext() || {};
  const token = outlet.token || localStorage.getItem('token');

  const decoded = useMemo(() => (token ? parseJwtPayload(token) : null), [token]);
  const teacherId = decoded?.id != null ? Number(decoded.id) : null;

  const [semester, setSemester] = useState(getCurrentSemester() || '114-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!token || !teacherId || !semester) return;
    setLoading(true);
    setError('');
    try {
      const json = await fetchTeacherDashboard(token, teacherId, semester);
      setData(json);
    } catch (e) {
      if (e?.status === 403) {
        setError(e?.message || '您沒有權限查看此教師儀表板');
      } else if (e?.message && typeof e.message === 'string' && e.message.trim()) {
        setError(e.message);
      } else {
        const errMsg = handleAPIError(e);
        setError(errMsg?.display || errMsg?.zh || '載入失敗');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, teacherId, semester]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    if (!teacherId && !loading && !error && semester) {
      setError('無法從 token 取得 teacherId，請重新登入。');
    }
  }, [token, teacherId, loading, error, semester]);

  const [sortKey, setSortKey] = useState('riskStudentCount');
  const [sortDir, setSortDir] = useState('desc');

  const classesSorted = useMemo(() => {
    if (!data?.classes) return [];
    const arr = [...data.classes];
    arr.sort((a, b) => {
      const va = a?.[sortKey] ?? 0;
      const vb = b?.[sortKey] ?? 0;
      if (typeof va === 'string' || typeof vb === 'string') {
        const sa = String(va || '');
        const sb = String(vb || '');
        const cmp = sa.localeCompare(sb);
        return sortDir === 'desc' ? -cmp : cmp;
      }
      if (vb === va) return 0;
      return sortDir === 'desc' ? vb - va : va - vb;
    });
    return arr;
  }, [data, sortKey, sortDir]);

  const onSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="container-fluid px-2 px-md-3">
      <p className="text-muted small mb-3">
        <strong>本頁顯示與登入教師相關的班級與學生概況</strong>，為您帳號所負責班級在本學期的彙整；<strong>不代表全校教師總覽</strong>。
        指標母體為 <strong>class_memberships</strong> 與 <code>kpiService</code>（班級行政口徑），與英語學習歷程 active roster 之 canonical 指標不同。
      </p>
      <div className="d-flex justify-content-end align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Form.Select value={semester} onChange={(e) => setSemester(e.target.value)} style={{ width: 180 }}>
            {SEMESTER_OPTIONS.filter((o) => o.value).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Form.Select>
          <Button variant="outline-secondary" size="sm" onClick={() => navigate('/admin/learning-journey')}>
            前往英語學習歷程中心
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={() => navigate('/admin/analytics/overview')}>
            返回分析與報表
          </Button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && data && (
        <>
          <RowKpi
            totalClasses={data.summary?.totalClasses || 0}
            avgParticipationRate={data.summary?.avgParticipationRate ?? 0}
            avgPassRate={data.summary?.avgPassRate ?? 0}
            totalRiskStudents={data.summary?.totalRiskStudents || 0}
          />

          {(!data.classes || data.classes.length === 0) && (
            <Alert variant="secondary" className="mt-3 mb-0">
              目前沒有可顯示的班級資料（本學期可能尚無指派班級，或尚無 class_memberships 紀錄）。
            </Alert>
          )}

          <Card className="mt-3">
            <Card.Header className="d-flex align-items-center justify-content-between">
              <div>班級列表（排序可切換）</div>
              <div className="small text-muted">semester：{semester}</div>
            </Card.Header>
            <Card.Body>
              <div className="table-responsive">
                <Table striped hover size="sm">
                  <thead>
                    <tr>
                      <SortableTh label="班級" field="className" onSort={onSort} sortKey={sortKey} sortDir={sortDir} />
                      <SortableTh label="學生數" field="studentCount" onSort={onSort} sortKey={sortKey} sortDir={sortDir} />
                      <SortableTh label="參與率" field="participationRate" onSort={onSort} sortKey={sortKey} sortDir={sortDir} />
                      <SortableTh label="BESTEP 報考率" field="bestepRegistrationRate" onSort={onSort} sortKey={sortKey} sortDir={sortDir} />
                      <SortableTh label="BESTEP 通過率" field="bestepPassRate" onSort={onSort} sortKey={sortKey} sortDir={sortDir} />
                      <SortableTh label="抵免通過率" field="exemptionApprovedRate" onSort={onSort} sortKey={sortKey} sortDir={sortDir} />
                      <SortableTh label="班級名冊高風險人數" field="riskStudentCount" onSort={onSort} sortKey={sortKey} sortDir={sortDir} />
                    </tr>
                  </thead>
                  <tbody>
                    {classesSorted.map((c) => (
                      <tr key={c.classId}>
                        <td>
                          <Button variant="link" className="p-0" onClick={() => navigate(`/admin/classes/${c.classId}/bestep?semester=${encodeURIComponent(semester)}`)}>
                            {c.className || `Class ${c.classId}`}
                          </Button>
                        </td>
                        <td>{c.studentCount}</td>
                        <td>{c.participationRate}%</td>
                        <td>{c.bestepRegistrationRate}%</td>
                        <td>{c.bestepPassRate}%</td>
                        <td>{c.exemptionApprovedRate}%</td>
                        <td>{c.riskStudentCount}</td>
                      </tr>
                    ))}
                    {classesSorted.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-muted">沒有資料</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
}

function SortableTh({ label, field, onSort, sortKey, sortDir }) {
  const active = sortKey === field;
  return (
    <th style={{ cursor: 'pointer' }} onClick={() => onSort(field)}>
      {label} {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );
}

function RowKpi({ totalClasses, avgParticipationRate, avgPassRate, totalRiskStudents }) {
  return (
    <div className="row g-3 mb-2">
      <div className="col-12 col-md-3">
        <Card className="h-100">
          <Card.Body>
            <div className="text-muted small">班級數</div>
            <div className="fs-4 fw-semibold">{totalClasses}</div>
          </Card.Body>
        </Card>
      </div>
      <div className="col-12 col-md-3">
        <Card className="h-100">
          <Card.Body>
            <div className="text-muted small">平均參與率</div>
            <div className="fs-4 fw-semibold">{avgParticipationRate}%</div>
          </Card.Body>
        </Card>
      </div>
      <div className="col-12 col-md-3">
        <Card className="h-100">
          <Card.Body>
            <div className="text-muted small">平均通過率</div>
            <div className="fs-4 fw-semibold">{avgPassRate}%</div>
          </Card.Body>
        </Card>
      </div>
      <div className="col-12 col-md-3">
        <Card className="h-100 border-danger">
          <Card.Body>
            <div className="text-muted small">班級名冊高風險人數</div>
            <div className="fs-4 fw-semibold">{totalRiskStudents}</div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}

