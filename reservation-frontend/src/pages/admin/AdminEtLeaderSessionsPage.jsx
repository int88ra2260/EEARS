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
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { P } from '../../constants/permissions';
import { hasPermission } from '../../utils/accessControl';
import { getSemesterOptions } from '../../utils/adminReportUtils';
import UnreadAttentionDot from '../../components/learning-partner/UnreadAttentionDot';
import { notifyLeaderMarkingAttention } from '../../hooks/useLeaderMarkingAttention';
import { checkInLeaderAttendance, fetchEventPracticeBriefs, fetchLeaderMarkingAttention, fetchMyLeaderPayroll, fetchMyLeaderSessions } from '../../services/etGroupingApi';
import { showErrorMessage, showSuccessMessage } from '../../utils/errorHandler';
import AdminListPager, { ADMIN_LIST_PAGE_SIZE, clampPage, slicePage } from '../../components/admin/AdminListPager';
import './AdminEtLeaderSessionsPage.css';

function attendanceBadge(row) {
  const status = row.attendance?.status || row.derivedStatus;
  if (status === 'on_time') return <Badge bg="success">準時</Badge>;
  if (status === 'late') return <Badge bg="warning" text="dark">遲到</Badge>;
  if (status === 'manual') return <Badge bg="info">行政補登</Badge>;
  if (status === 'absent') return <Badge bg="secondary">未出席</Badge>;
  return <Badge bg="light" text="dark" className="border">未簽到</Badge>;
}

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function money(value) {
  return Number(value || 0).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
}

function formatUntil(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

function SessionActions({ row, onCheckIn, onBriefs, onTasks, stacked = false }) {
  const checkedIn = Boolean(row.attendance?.status);
  const className = stacked ? 'd-grid gap-2 leader-session-card__actions' : 'text-nowrap';
  const buttonClass = stacked ? '' : 'me-1';
  return (
    <div className={className}>
      {!checkedIn && row.derivedStatus !== 'absent' ? (
        <Button size="sm" variant="success" className={buttonClass} onClick={() => onCheckIn(row)}>
          出席簽到
        </Button>
      ) : null}
      <Button size="sm" variant="outline-primary" className={stacked ? '' : 'me-1'} onClick={() => onBriefs(row)}>
        會前回答
      </Button>
      <Button size="sm" variant="primary" onClick={() => onTasks(row)}>
        {row.payGate?.status === 'pending' ? (
          <UnreadAttentionDot className="me-1" label="這場還沒勾完" />
        ) : null}
        任務成效
      </Button>
    </div>
  );
}

function payBadge(gate) {
  if (!gate || gate.status === 'unchecked') return <Badge bg="light" text="dark" className="border">未計薪</Badge>;
  if (gate.status === 'ready') return <Badge bg="success">已計入</Badge>;
  if (gate.status === 'released') return <Badge bg="info">行政放行</Badge>;
  if (gate.status === 'pending') {
    if (gate.extended) return <Badge bg="warning" text="dark">已開放補勾</Badge>;
    const days = gate.daysLeft > 0 ? `，還有 ${gate.daysLeft} 天` : '';
    return <Badge bg="warning" text="dark">待勾任務{days}</Badge>;
  }
  if (gate.status === 'expired') return <Badge bg="secondary">已過補登</Badge>;
  return <Badge bg="light" text="dark" className="border">未計薪</Badge>;
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
  const [pay, setPay] = useState(null);
  const [attention, setAttention] = useState(null);
  const [checkInEvent, setCheckInEvent] = useState(null);
  const [checkInToken, setCheckInToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [briefEvent, setBriefEvent] = useState(null);
  const [briefs, setBriefs] = useState([]);
  const [briefsLoading, setBriefsLoading] = useState(false);
  const [briefsError, setBriefsError] = useState('');
  const [page, setPage] = useState(1);

  const loadSessions = useCallback(async () => {
    if (!token || !canAccess) return;
    setLoading(true);
    try {
      const rows = await fetchMyLeaderSessions(token, { semester: selectedSemester });
      setSessions(rows || []);
      try {
        const mine = await fetchMyLeaderPayroll(token, currentYearMonth());
        setPay(mine);
      } catch {
        setPay(null);
      }
      try {
        const notice = await fetchLeaderMarkingAttention(token);
        setAttention(notice);
        notifyLeaderMarkingAttention();
      } catch {
        setAttention(null);
      }
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

  useEffect(() => {
    setPage(1);
  }, [selectedSemester]);

  useEffect(() => {
    setPage((prev) => clampPage(prev, sessions.length, ADMIN_LIST_PAGE_SIZE));
  }, [sessions.length]);

  const pagedSessions = slicePage(sessions, page, ADMIN_LIST_PAGE_SIZE);
  const openTasks = (row) => navigate(`/admin/operations/${row.eventId}?tab=taskMarks`);

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

  const openBriefs = async (row) => {
    setBriefEvent(row);
    setBriefs([]);
    setBriefsError('');
    setBriefsLoading(true);
    try {
      const data = await fetchEventPracticeBriefs(token, row.eventId);
      setBriefs(data.briefs || []);
    } catch (e) {
      setBriefsError(e.message || '無法載入會前回答');
    } finally {
      setBriefsLoading(false);
    }
  };

  const closeBriefs = () => {
    setBriefEvent(null);
    setBriefs([]);
    setBriefsError('');
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
              <Form.Label className="small mb-1" htmlFor="leader-session-semester">學期</Form.Label>
              <Form.Select
                id="leader-session-semester"
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
          <ul className="leader-session-notes small text-muted">
            <li>活動當天先出席簽到，離場前把必填任務勾完。當天勾選最準。</li>
            <li>勾是或勾否都算完成，空白不算。</li>
            <li>超過結束後 3 天就不能再勾，這場也不會計薪。要補勾請聯絡行政。</li>
            <li>時數用活動表上的開始與結束時間。</li>
          </ul>
        </Card.Body>
      </Card>

      {attention?.count > 0 ? (
        <Alert variant="warning">
          <div className="fw-semibold">還有 {attention.count} 場任務沒勾完</div>
          <p className="small mb-2">
            請在活動結束當下勾完，當天最準。超過 3 天就不能再勾，這場也不會計入薪水。若已經超過，請聯絡行政開放補勾；補完才會計薪。
          </p>
          <ul className="small mb-0">
            {(attention.items || []).map((item) => (
              <li key={item.eventId}>
                {item.date} {item.eventName}
                {item.status === 'expired'
                  ? '：已過補登，請聯絡行政開放補勾'
                  : item.extended
                    ? `：行政已開放補勾到 ${formatUntil(item.markingOpenUntil)}`
                    : `：請現在勾完${item.daysLeft > 0 ? `，還有 ${item.daysLeft} 天` : ''}`}
                {item.status !== 'expired' ? (
                  <Link className="ms-2" to={`/admin/operations/${item.eventId}?tab=taskMarks`}>去勾選</Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {pay && (sessions.length > 0 || pay.sessionCount > 0 || pay.pending?.length) ? (
        <Card className="mb-3 border-0 shadow-sm">
          <Card.Body>
            <div className="d-flex flex-wrap justify-content-between gap-2">
              <div>
                <h2 className="h6 mb-1">{pay.yearMonth} 出席與預期薪水</h2>
                <p className="small text-muted mb-0">
                  已計入 {pay.sessionCount} 場、{pay.hours} 小時。
                  {pay.pending?.length ? ` 另有 ${pay.pending.length} 場已簽到但任務未完成，完成後才會計入。` : ''}
                  {Number(pay.hourlyRate) <= 0 ? ' 時薪尚未設定，金額先顯示 0。' : ''}
                </p>
              </div>
              <div className="text-end">
                <div className="small text-muted">目前計入</div>
                <div className="fs-5 fw-semibold">NT$ {money(pay.subtotal)}</div>
              </div>
            </div>
            {(pay.pending || []).length ? (
              <ul className="small mb-0 mt-2">
                {pay.pending.map((session) => (
                  <li key={session.eventId}>
                    {session.date} {session.eventName}：{session.note || '任務未完成'}
                    {Number(session.potentialAmount) > 0 ? `（完成後 NT$ ${money(session.potentialAmount)}）` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card.Body>
        </Card>
      ) : null}

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
          ) : null}
        </Alert>
      ) : null}

      {!loading && sessions.length > 0 ? (
        <>
          <div className="d-md-none">
            {pagedSessions.rows.map((row) => (
              <article key={row.eventId} className="leader-session-card border rounded bg-white p-3 mb-2">
                <div className="fw-semibold">{row.name}</div>
                <div className="small text-muted mb-2">
                  {row.date}
                  {' '}
                  {row.startTime}{row.endTime ? ` – ${row.endTime}` : ''}
                </div>
                <div className="d-flex flex-wrap gap-1 mb-2">
                  {(row.groupLabels || []).map((label) => (
                    <Badge key={label} bg="light" text="dark" className="border">{label}</Badge>
                  ))}
                  {attendanceBadge(row)}
                  {payBadge(row.payGate)}
                </div>
                <SessionActions
                  row={row}
                  stacked
                  onCheckIn={openCheckIn}
                  onBriefs={openBriefs}
                  onTasks={openTasks}
                />
              </article>
            ))}
          </div>
          <div className="d-none d-md-block">
            <Table hover size="sm" className="bg-white border mb-0">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>時間</th>
                  <th>活動</th>
                  <th>負責組別</th>
                  <th>簽到</th>
                  <th>計薪</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pagedSessions.rows.map((row) => (
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
                    <td>{payBadge(row.payGate)}</td>
                    <td>
                      <SessionActions
                        row={row}
                        onCheckIn={openCheckIn}
                        onBriefs={openBriefs}
                        onTasks={openTasks}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <AdminListPager
            page={pagedSessions.current}
            pages={pagedSessions.pages}
            total={sessions.length}
            onPage={setPage}
            label="帶班場次分頁"
          />
        </>
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
              <p className="small text-muted mb-1">用手機相機掃描現場 QR，或向行政取得簽到碼後貼上。</p>
              <p className="small text-muted">開始前 30 分到開始後 10 分內是準時。之後到活動結束是遲到。</p>
              <Form.Label className="small" htmlFor="leader-checkin-token">現場簽到碼</Form.Label>
              <Form.Control
                id="leader-checkin-token"
                value={checkInToken}
                onChange={(e) => setCheckInToken(e.target.value)}
                placeholder="貼上或輸入簽到碼"
                autoFocus
              />
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer className="d-grid gap-2 d-sm-flex justify-content-sm-end">
          <Button variant="outline-secondary" onClick={closeCheckIn} disabled={submitting}>
            取消
          </Button>
          <Button variant="success" onClick={handleSubmitCheckIn} disabled={submitting}>
            {submitting ? '簽到中…' : '確認簽到'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={Boolean(briefEvent)} onHide={closeBriefs} centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">會前回答</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {briefEvent ? (
            <p className="mb-2">
              <strong>{briefEvent.name}</strong>
              <span className="text-muted small ms-2">{briefEvent.date}</span>
            </p>
          ) : null}
          <p className="small text-muted mb-1">只列出你這組、而且練習時有填對學號的學生。</p>
          <p className="small text-muted">這是開場用的第一句，用來接話，不是分數。</p>
          {briefsLoading ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>載入會前回答…</span>
            </div>
          ) : null}
          {briefsError ? <Alert variant="danger">{briefsError}</Alert> : null}
          {!briefsLoading && !briefsError && !briefs.length ? (
            <Alert variant="info" className="mb-0">這組還沒有對到學號的會前練習。現場仍照題目討論。</Alert>
          ) : null}
          {!briefsLoading && briefs.length ? (
            <>
            <div className="d-md-none">
              {briefs.map((brief) => (
                <article key={`${brief.studentId}-${brief.phase || 'any'}-${brief.questionNumber || '0'}`} className="border rounded p-3 mb-2">
                  <div className="fw-semibold">{brief.studentName}</div>
                  <div className="small text-muted mb-2">
                    {brief.groupLabel ? `${brief.groupLabel} · ` : ''}
                    {brief.questionNumber ? `第 ${brief.questionNumber} 題` : '未標題號'}
                  </div>
                  <div className="small text-secondary">系統聽到的第一句</div>
                  <div className="mb-2">{brief.heard || '沒有辨識到英文'}</div>
                  <div className="small text-secondary">可以怎麼接</div>
                  <div>
                    {brief.cue}
                    {brief.phraseId ? (
                      <div>
                        <Link to={`/guides/activity-phrasebook/english-table#${brief.phraseId}`}>對應句庫</Link>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            <div className="d-none d-md-block">
            <Table size="sm" className="mb-0">
              <thead>
                <tr>
                  <th>學生</th>
                  <th>題號</th>
                  <th>系統聽到的第一句</th>
                  <th>可以怎麼接</th>
                </tr>
              </thead>
              <tbody>
                {briefs.map((brief) => (
                  <tr key={`${brief.studentId}-${brief.phase || 'any'}-${brief.questionNumber || '0'}`}>
                    <td>
                      {brief.studentName}
                      {brief.groupLabel ? <div className="small text-muted">{brief.groupLabel}</div> : null}
                    </td>
                    <td className="text-nowrap">
                      {brief.questionNumber ? `第 ${brief.questionNumber} 題` : '—'}
                      {brief.phase === 'post_activity' || brief.phase === 'post' ? <div className="small text-muted">活動後</div> : null}
                      {brief.phase === 'pre_activity' || brief.phase === 'pre' ? <div className="small text-muted">會前</div> : null}
                    </td>
                    <td>{brief.heard || '沒有辨識到英文'}</td>
                    <td>
                      {brief.cue}
                      {brief.phraseId ? (
                        <div>
                          <Link to={`/guides/activity-phrasebook/english-table#${brief.phraseId}`}>對應句庫</Link>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            </div>
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer className="d-grid d-sm-flex justify-content-sm-end">
          <Button variant="outline-secondary" onClick={closeBriefs}>關閉</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
