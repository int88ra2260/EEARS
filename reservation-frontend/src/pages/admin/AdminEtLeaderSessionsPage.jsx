import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { P } from '../../constants/permissions';
import { hasPermission } from '../../utils/accessControl';
import { getSemesterOptions } from '../../utils/adminReportUtils';
import { fetchMyLeaderSessions } from '../../services/etGroupingApi';
import { showErrorMessage } from '../../utils/errorHandler';

export default function AdminEtLeaderSessionsPage() {
  const { token, accessProfile } = useOutletContext();
  const navigate = useNavigate();
  const canAccess = hasPermission(accessProfile, P.CAN_MARK_ET_SESSION_TASKS);

  const semesterOptions = useMemo(() => getSemesterOptions(), []);
  const [selectedSemester, setSelectedSemester] = useState(semesterOptions[0]?.value || 'all');
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);

  const loadSessions = useCallback(async () => {
    if (!token || !canAccess) return;
    setLoading(true);
    try {
      const rows = await fetchMyLeaderSessions(token, { semester: selectedSemester });
      setSessions(rows || []);
    } catch (e) {
      showErrorMessage(e.message || '載入帶班場次失敗');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [token, canAccess, selectedSemester]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  if (!canAccess) {
    return <Alert variant="warning">您沒有 Leader 任務勾選權限。</Alert>;
  }

  return (
    <div className="admin-et-leader-sessions-page">
      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={4}>
              <Form.Label className="small mb-1">學期</Form.Label>
              <Form.Select
                size="sm"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
              >
                {semesterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md="auto" className="ms-auto">
              <Button variant="outline-secondary" size="sm" onClick={loadSessions} disabled={loading}>
                重新整理
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {loading ? (
        <div className="d-flex align-items-center gap-2 py-4">
          <Spinner animation="border" size="sm" />
          <span>載入我的帶班場次…</span>
        </div>
      ) : null}

      {!loading && !sessions.length ? (
        <Alert variant="info">目前學期尚無被指派為 Leader 的 ET 場次。</Alert>
      ) : null}

      {!loading && sessions.length > 0 ? (
        <Table responsive hover size="sm" className="bg-white border">
          <thead>
            <tr>
              <th>日期</th>
              <th>時間</th>
              <th>活動</th>
              <th>負責組別</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sessions.map((row) => (
              <tr key={row.eventId}>
                <td>{row.date}</td>
                <td>{row.startTime}{row.endTime ? ` – ${row.endTime}` : ''}</td>
                <td>{row.name}</td>
                <td>
                  {(row.groupLabels || []).map((label) => (
                    <Badge key={label} bg="light" text="dark" className="me-1 border">{label}</Badge>
                  ))}
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => navigate(`/admin/operations/${row.eventId}?tab=taskMarks`)}
                  >
                    任務成效
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </div>
  );
}
