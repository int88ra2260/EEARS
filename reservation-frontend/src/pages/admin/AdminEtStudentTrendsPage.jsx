import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import { P } from '../../constants/permissions';
import { hasPermission } from '../../utils/accessControl';
import { getSemesterOptions } from '../../utils/adminReportUtils';
import { fetchStudentEtTrends } from '../../services/etGroupingApi';

export default function AdminEtStudentTrendsPage() {
  const { token, accessProfile } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const semesterOptions = useMemo(() => getSemesterOptions(), []);
  const canView = hasPermission(accessProfile, P.CAN_VIEW_ET_GROUPING)
    || hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING)
    || hasPermission(accessProfile, P.CAN_EXPORT_ET_GROUPING);

  const [studentId, setStudentId] = useState(searchParams.get('studentId') || '');
  const [selectedSemester, setSelectedSemester] = useState(
    searchParams.get('semester') || semesterOptions[0]?.value || 'all',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const loadTrends = useCallback(async (sid, semester) => {
    const normalized = String(sid || '').trim();
    if (!token || !normalized) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchStudentEtTrends(token, normalized, { semester });
      setData(result);
    } catch (e) {
      setData(null);
      setError(e.message || '載入趨勢失敗');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const sid = searchParams.get('studentId') || '';
    const semester = searchParams.get('semester') || selectedSemester;
    setStudentId(sid);
    if (sid) loadTrends(sid, semester);
  }, [searchParams, loadTrends, selectedSemester]);

  const handleSearch = (e) => {
    e.preventDefault();
    const sid = String(studentId || '').trim();
    if (!sid) return;
    const next = new URLSearchParams();
    next.set('studentId', sid);
    if (selectedSemester && selectedSemester !== 'all') next.set('semester', selectedSemester);
    setSearchParams(next);
    loadTrends(sid, selectedSemester);
  };

  if (!canView) {
    return <Alert variant="warning">您沒有檢視 ET 學生趨勢的權限。</Alert>;
  }

  const trend = data?.trend || {};
  const links = data?.links || {};

  return (
    <div className="admin-et-student-trends-page">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h4 className="mb-0">ET 學生學期趨勢</h4>
        <Button as={Link} to="/admin/et-grouping/reports" variant="outline-secondary" size="sm">
          返回場次報表
        </Button>
      </div>

      <Card className="mb-3">
        <Card.Body>
          <Form onSubmit={handleSearch} className="row g-2 align-items-end">
            <Col md={4}>
              <Form.Label className="small mb-1">學號</Form.Label>
              <Form.Control
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="例如 B123456789"
              />
            </Col>
            <Col md={3}>
              <Form.Label className="small mb-1">學期</Form.Label>
              <Form.Select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
              >
                {semesterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md="auto">
              <Button type="submit" disabled={loading || !String(studentId).trim()}>
                查詢
              </Button>
            </Col>
          </Form>
        </Card.Body>
      </Card>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {loading ? (
        <div className="d-flex align-items-center gap-2 py-4">
          <Spinner animation="border" size="sm" />
          <span>載入中…</span>
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <div className="d-flex flex-wrap gap-2 mb-3">
            <Button
              as={Link}
              to={links.learningJourney || `/admin/learning-journey/students/${encodeURIComponent(data.studentId)}`}
              variant="outline-primary"
              size="sm"
            >
              學習歷程檔案
            </Button>
            <Button
              as={Link}
              to={links.learningAnalytics || `/admin/learning-analytics/students/${encodeURIComponent(data.studentId)}`}
              variant="outline-primary"
              size="sm"
            >
              LVA 學習軌跡
            </Button>
          </div>

          <Row className="g-3 mb-3">
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small">ET 場次</div>
                  <div className="fw-semibold fs-5">{trend.sessionCount || 0}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small">已簽到</div>
                  <div className="fw-semibold fs-5">{trend.checkedInCount || 0}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small">平均任務完成率</div>
                  <div className="fw-semibold fs-5">
                    {trend.avgCompletionRate != null ? `${trend.avgCompletionRate}%` : '—'}
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="h-100">
                <Card.Body>
                  <div className="text-muted small">最近一場完成率</div>
                  <div className="fw-semibold fs-5">
                    {trend.latestCompletionRate != null ? `${trend.latestCompletionRate}%` : '—'}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {data.disclaimer ? (
            <Alert variant="light" className="border small">{data.disclaimer}</Alert>
          ) : null}

          <div className="table-responsive">
            <Table striped bordered hover size="sm" className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>活動</th>
                  <th>學期</th>
                  <th>組別</th>
                  <th>能力帶</th>
                  <th>簽到</th>
                  <th>任務完成</th>
                </tr>
              </thead>
              <tbody>
                {(data.points || []).map((point) => (
                  <tr key={`${point.eventId}-${point.date}`}>
                    <td>{point.date || '—'}</td>
                    <td>{point.eventName || '—'}</td>
                    <td>{point.semester || '—'}</td>
                    <td>{point.groupLabel || '—'}</td>
                    <td>
                      {point.bandCode ? (
                        <Badge bg="light" text="dark" className="border">{point.bandCode}</Badge>
                      ) : '—'}
                    </td>
                    <td>{point.checkinStatus || '—'}</td>
                    <td>
                      {point.taskTotal
                        ? `${point.taskCompleted || 0}/${point.taskTotal} (${point.taskCompletionRate ?? '—'}%)`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      ) : null}
    </div>
  );
}
