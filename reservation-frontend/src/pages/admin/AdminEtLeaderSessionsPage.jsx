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
import { checkInLeaderAttendance, fetchEventPracticeBriefs, fetchEventTaskMarks, fetchLeaderMarkingAttention, fetchMyLeaderPayroll, fetchMyLeaderSessions } from '../../services/etGroupingApi';
import { showErrorMessage, showSuccessMessage } from '../../utils/errorHandler';
import { formatYearMonth, leaderSessionBadge, shiftYearMonth, sortLeaderSessions } from '../../utils/leaderSessions';
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

function SessionWhen({ row, sessions }) {
  const badge = leaderSessionBadge(row, sessions);
  return (
    <div className="small text-muted mb-2">
      {badge ? (
        <Badge bg={badge === '今天' ? 'primary' : 'info'} className="me-1">{badge}</Badge>
      ) : null}
      {row.date}
      {' '}
      {row.startTime}{row.endTime ? ` – ${row.endTime}` : ''}
      {row.location ? <div>{row.location}</div> : null}
    </div>
  );
}

function SessionActions({ row, onRoster, onCheckIn, onBriefs, onTasks, stacked = false }) {
  const checkedIn = Boolean(row.attendance?.status);
  const className = stacked ? 'd-grid gap-2 leader-session-card__actions' : 'text-nowrap';
  const buttonClass = stacked ? '' : 'me-1';
  return (
    <div className={className}>
      <Button size="sm" variant="outline-secondary" className={stacked ? '' : 'me-1'} onClick={() => onRoster(row)}>
        這組名單
      </Button>
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
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [rosterEvent, setRosterEvent] = useState(null);
  const [rosterRows, setRosterRows] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState('');

  const loadSessions = useCallback(async () => {
    if (!token || !canAccess) return;
    setLoading(true);
    try {
      const rows = await fetchMyLeaderSessions(token, { semester: selectedSemester });
      setSessions(sortLeaderSessions(rows || []));
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

  const loadPay = useCallback(async () => {
    if (!token || !canAccess) return;
    try {
      const mine = await fetchMyLeaderPayroll(token, yearMonth);
      setPay(mine);
    } catch {
      setPay(null);
    }
  }, [token, canAccess, yearMonth]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    loadPay();
  }, [loadPay]);

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

  const openRoster = async (row) => {
    setRosterEvent(row);
    setRosterRows([]);
    setRosterError('');
    setRosterLoading(true);
    try {
      const [matrix, briefData] = await Promise.all([
        fetchEventTaskMarks(token, row.eventId),
        fetchEventPracticeBriefs(token, row.eventId),
      ]);
      const practiced = new Set((briefData?.briefs || []).map((brief) => String(brief.studentId)));
      const students = (matrix?.students || []).map((student) => ({
        ...student,
        practiced: practiced.has(String(student.studentId)),
      }));
      students.sort((a, b) => {
        const arrivedA = a.checkinStatus === '已簽到' ? 0 : 1;
        const arrivedB = b.checkinStatus === '已簽到' ? 0 : 1;
        if (arrivedA !== arrivedB) return arrivedA - arrivedB;
        return String(a.studentName || '').localeCompare(String(b.studentName || ''), 'zh-Hant');
      });
      setRosterRows(students);
    } catch (e) {
      setRosterError(e.message || '無法載入這組名單');
    } finally {
      setRosterLoading(false);
    }
  };

  const closeRoster = () => {
    setRosterEvent(null);
    setRosterRows([]);
    setRosterError('');
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

      <Card className="mb-3 border-0 shadow-sm">
        <Card.Body>
          <div className="d-flex flex-wrap justify-content-between gap-2">
            <div>
              <h2 className="h6 mb-1">{formatYearMonth(yearMonth)} 出席與預期薪水</h2>
              <p className="small text-muted mb-0">
                {pay ? (
                  <>
                    已計入 {pay.sessionCount} 場、{pay.hours} 小時。
                    {pay.pending?.length ? ` 另有 ${pay.pending.length} 場已簽到但任務未完成，完成後才會計入。` : ''}
                    {Number(pay.hourlyRate) <= 0 ? ' 時薪尚未設定，金額先顯示 0。' : ''}
                  </>
                ) : '這個月的薪水還在載入，或暫時讀不到。'}
              </p>
            </div>
            <div className="text-end">
              <div className="small text-muted">目前計入</div>
              <div className="fs-5 fw-semibold">NT$ {money(pay?.subtotal)}</div>
              <div className="leader-pay-months d-flex justify-content-end gap-2 mt-2">
                <Button size="sm" variant="outline-secondary" onClick={() => setYearMonth((value) => shiftYearMonth(value, -1))}>
                  上個月
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={yearMonth >= currentYearMonth()}
                  onClick={() => setYearMonth((value) => shiftYearMonth(value, 1))}
                >
                  下個月
                </Button>
              </div>
            </div>
          </div>
            {(pay?.pending || []).length ? (
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
                <SessionWhen row={row} sessions={sessions} />
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
                  onRoster={openRoster}
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
                  <th>地點</th>
                  <th>活動</th>
                  <th>負責組別</th>
                  <th>簽到</th>
                  <th>計薪</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pagedSessions.rows.map((row) => {
                  const badge = leaderSessionBadge(row, sessions);
                  return (
                  <tr key={row.eventId}>
                    <td>
                      {badge ? (
                        <Badge bg={badge === '今天' ? 'primary' : 'info'} className="me-1">{badge}</Badge>
                      ) : null}
                      {row.date}
                    </td>
                    <td>{row.startTime}{row.endTime ? ` – ${row.endTime}` : ''}</td>
                    <td>{row.location || '—'}</td>
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
                        onRoster={openRoster}
                        onCheckIn={openCheckIn}
                        onBriefs={openBriefs}
                        onTasks={openTasks}
                      />
                    </td>
                  </tr>
                  );
                })}
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

      <Modal show={Boolean(rosterEvent)} onHide={closeRoster} centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">這組名單</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {rosterEvent ? (
            <p className="mb-2">
              <strong>{rosterEvent.name}</strong>
              <span className="text-muted small ms-2">
                {rosterEvent.date}
                {rosterEvent.location ? ` · ${rosterEvent.location}` : ''}
              </span>
            </p>
          ) : null}
          <p className="small text-muted">只列出你負責的組。已到的人排在前面。勾選仍在離場前的任務成效。</p>
          {rosterLoading ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>載入這組名單…</span>
            </div>
          ) : null}
          {rosterError ? <Alert variant="danger">{rosterError}</Alert> : null}
          {!rosterLoading && !rosterError && !rosterRows.length ? (
            <Alert variant="info" className="mb-0">這組還沒有學生。</Alert>
          ) : null}
          {!rosterLoading && rosterRows.length ? (
            <div className="d-grid gap-2">
              {rosterRows.map((student) => (
                <article key={student.reservationId} className="border rounded p-3">
                  <div className="d-flex justify-content-between gap-2">
                    <div>
                      <div className="fw-semibold">{student.studentName}</div>
                      <div className="small text-muted">
                        {student.studentId}
                        {student.groupLabel ? ` · ${student.groupLabel}` : ''}
                      </div>
                    </div>
                    <div className="d-flex flex-column align-items-end gap-1">
                      <Badge bg={student.checkinStatus === '已簽到' ? 'success' : 'secondary'}>
                        {student.checkinStatus === '已簽到' ? '已到' : '未到'}
                      </Badge>
                      <Badge bg={student.practiced ? 'info' : 'light'} text={student.practiced ? undefined : 'dark'} className={student.practiced ? '' : 'border'}>
                        {student.practiced ? '有會前練習' : '尚未練習'}
                      </Badge>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer className="d-grid d-sm-flex justify-content-sm-end">
          <Button variant="outline-secondary" onClick={closeRoster}>關閉</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
