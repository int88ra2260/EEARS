import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { P } from '../../constants/permissions';
import { hasPermission } from '../../utils/accessControl';
import { getSemesterOptions } from '../../utils/adminReportUtils';
import { checkInLeaderAttendance, fetchMyLeaderSessions } from '../../services/etGroupingApi';
import { showErrorMessage, showSuccessMessage } from '../../utils/errorHandler';

function attendanceBadge(row) {
  const status = row.attendance?.status || row.derivedStatus;
  if (status === 'on_time') return <Badge bg="success">準時</Badge>;
  if (status === 'late') return <Badge bg="warning" text="dark">遲到</Badge>;
  if (status === 'manual') return <Badge bg="info">行政補登</Badge>;
  if (status === 'absent') return <Badge bg="secondary">未出席</Badge>;
  return <Badge bg="light" text="dark" className="border">未簽到</Badge>;
}

export default function AdminEtLeaderSessionsPage() {
  const { token, accessProfile } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canAccess = hasPermission(accessProfile, P.CAN_MARK_ET_SESSION_TASKS);

  const semesterOptions = useMemo(() => getSemesterOptions(), []);
  const [selectedSemester, setSelectedSemester] = useState(semesterOptions[0]?.value || 'all');
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [checkInEvent, setCheckInEvent] = useState(null);
  const [checkInToken, setCheckInToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!token || !canAccess) return;
    setLoading(true);
    try {
      const rows = await fetchMyLeaderSessions(token, { semester: selectedSemester });
      setSessions(rows || []);
      return rows || [];
    } catch (e) {
      showErrorMessage(e.message || '載入帶班場次失敗');
      setSessions([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [token, canAccess, selectedSemester]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Deep link from on-site QR: /admin/et-grouping/my-sessions?eventId=&checkInToken=
  useEffect(() => {
    const eventId = Number(searchParams.get('eventId'));
    const tokenFromQr = searchParams.get('checkInToken') || searchParams.get('token') || '';
    if (!eventId || !tokenFromQr || !sessions.length) return;
    const match = sessions.find((row) => Number(row.eventId) === eventId);
    if (!match) return;
    setCheckInEvent(match);
    setCheckInToken(tokenFromQr);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('eventId');
      next.delete('checkInToken');
      next.delete('token');
      return next;
    }, { replace: true });
  }, [sessions, searchParams, setSearchParams]);

  const openCheckIn = (row) => {
    setCheckInEvent(row);
    setCheckInToken('');
  };

  const closeCheckIn = () => {
    setCheckInEvent(null);
    setCheckInToken('');
  };

  const handleSubmitCheckIn = async () => {
    if (!checkInEvent || !checkInToken.trim()) {
      showErrorMessage('請輸入現場簽到碼');
      return;
    }
    setSubmitting(true);
    try {
      const data = await checkInLeaderAttendance(token, checkInEvent.eventId, checkInToken.trim());
      const label = data.status === 'on_time' ? '準時' : data.status === 'late' ? '遲到' : data.status;
      showSuccessMessage(`出席簽到成功（${label}）`);
      closeCheckIn();
      await loadSessions();
    } catch (e) {
      showErrorMessage(e.message || '簽到失敗');
      if (e.status === 409) await loadSessions();
    } finally {
      setSubmitting(false);
    }
  };

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
          <p className="small text-muted mb-0 mt-2">
            活動當天請向現場行政取得簽到 QR／簽到碼，完成出席簽到後再進行任務勾選。無需簽退。
          </p>
        </Card.Body>
      </Card>

      {loading ? (
        <div className="d-flex align-items-center gap-2 py-4">
          <Spinner animation="border" size="sm" />
          <span>載入我的帶班場次…</span>
        </div>
      ) : null}

      {!loading && !sessions.length ? (
        <Alert variant="info">
          <div className="fw-semibold mb-1">目前學期尚無被指派的帶班場次</div>
          <p className="mb-2 small">
            英語桌場次由 ET 負責人指派 Leader。若你應出現在名單中，請聯繫 English Table 負責人，或請行政於「ET 分組設定」指派。
          </p>
          {hasPermission(accessProfile, P.CAN_MANAGE_ET_GROUPING) ? (
            <Button size="sm" variant="outline-primary" onClick={() => navigate('/admin/et-grouping/settings')}>
              前往 ET 分組設定
            </Button>
          ) : (
            <Button size="sm" variant="outline-secondary" onClick={() => navigate('/admin/operations')}>
              前往活動列表
            </Button>
          )}
        </Alert>
      ) : null}

      {!loading && sessions.length > 0 ? (
        <Table responsive hover size="sm" className="bg-white border">
          <thead>
            <tr>
              <th>日期</th>
              <th>時間</th>
              <th>活動</th>
              <th>負責組別</th>
              <th>出席</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sessions.map((row) => {
              const checkedIn = Boolean(row.attendance?.status);
              return (
                <tr key={row.eventId}>
                  <td>{row.date}</td>
                  <td>{row.startTime}{row.endTime ? ` – ${row.endTime}` : ''}</td>
                  <td>{row.name}</td>
                  <td>
                    {(row.groupLabels || []).map((label) => (
                      <Badge key={label} bg="light" text="dark" className="me-1 border">{label}</Badge>
                    ))}
                  </td>
                  <td>{attendanceBadge(row)}</td>
                  <td className="text-nowrap">
                    {!checkedIn && row.derivedStatus !== 'absent' ? (
                      <Button
                        size="sm"
                        variant="success"
                        className="me-1"
                        onClick={() => openCheckIn(row)}
                      >
                        出席簽到
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => navigate(`/admin/operations/${row.eventId}?tab=taskMarks`)}
                    >
                      任務成效
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : null}

      <Modal show={Boolean(checkInEvent)} onHide={closeCheckIn} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">出席簽到</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {checkInEvent ? (
            <>
              <p className="mb-2">
                <strong>{checkInEvent.name}</strong>
                <span className="text-muted small ms-2">
                  {checkInEvent.date} {checkInEvent.startTime}
                </span>
              </p>
              <p className="small text-muted">
                請掃描現場 QR（手機相機開啟連結會自動帶入），或向行政取得簽到碼後貼上。
                開始前 30 分至開始後 10 分內為準時；之後至活動結束為遲到。
              </p>
              <Form.Label className="small">現場簽到碼</Form.Label>
              <Form.Control
                value={checkInToken}
                onChange={(e) => setCheckInToken(e.target.value)}
                placeholder="貼上或輸入簽到碼"
                autoFocus
              />
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeCheckIn} disabled={submitting}>
            取消
          </Button>
          <Button variant="success" onClick={handleSubmitCheckIn} disabled={submitting}>
            {submitting ? '簽到中…' : '確認簽到'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
