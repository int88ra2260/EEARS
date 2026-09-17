import React, { memo, useMemo, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import dayjs from 'dayjs';
import { EVENT_DETAIL_COPY } from '../../../../constants/adminEventDetailCopy';
import { isEnglishTableEventType } from '../../../../utils/eventCapacityFields';
import './adminEventCheckinTab.css';

function matchesSearch(reservation, q) {
  if (!q) return true;
  const sid = (reservation.studentId || '').toLowerCase();
  const name = (reservation.studentName || reservation.name || '').toLowerCase();
  return sid.includes(q) || name.includes(q);
}

function AdminEventCheckinTab({ tabProps }) {
  const p = tabProps;
  const [checkinSearchTerm, setCheckinSearchTerm] = useState('');
  const [passportFlags, setPassportFlags] = useState(() => ({}));
  const isEt = isEnglishTableEventType(p.currentEventType);

  const pendingRows = useMemo(() => p.pendingCheckinRows || [], [p.pendingCheckinRows]);
  const checkedInRows = useMemo(
    () => (p.checkedInRows || []).filter((r) => r.checkinStatus === '已簽到'),
    [p.checkedInRows],
  );
  const violationRows = useMemo(
    () => (p.violationRows || []).filter((r) => r.checkinStatus === '已登記違規'),
    [p.violationRows],
  );

  const q = checkinSearchTerm.trim().toLowerCase();
  const filteredPending = useMemo(
    () => pendingRows.filter((r) => matchesSearch(r, q)),
    [pendingRows, q],
  );
  const filteredCheckedIn = useMemo(
    () => checkedInRows.filter((r) => matchesSearch(r, q)),
    [checkedInRows, q],
  );
  const filteredViolations = useMemo(
    () => violationRows.filter((r) => matchesSearch(r, q)),
    [violationRows, q],
  );

  const togglePassportFlag = (reservationId, checked) => {
    setPassportFlags((prev) => ({ ...prev, [reservationId]: checked }));
  };

  const handleCheckinClick = async (reservation) => {
    const countsTowardPassport = !!passportFlags[reservation.id];
    await p.handleCheckin(reservation.id, { countsTowardPassport });
  };

  const canCheckinNow = p.canCheckinStudents
    && (p.isEventToday(p.currentEventDate) || p.canManageEvents);

  return (
    <Card className="shadow-sm border-success border-top border-3 admin-event-checkin-tab">
      <Card.Body className="pt-3">
        <h6 className="text-success fw-semibold mb-2">主任務：現場簽到／補簽到</h6>
        <p className="small text-muted mb-2">
          左側為<strong>待簽到</strong>，右側為<strong>已簽到</strong>。搜尋會同時過濾兩欄。
        </p>
        <Alert variant="light" className="border small py-2 mb-3">
          若學生聲明<strong>累計護照點數</strong>（與課堂加分擇一），請勾選「計入護照」後再簽到。
          已簽到且勾選者會自動入「英語增能活動」點數（每次 5 點，最多 12 次／60 點）；無護照者會暫存，開通後補發。
        </Alert>
        {p.resBlocking ? (
          <div className="text-center py-5 text-muted">
            <Spinner animation="border" size="sm" className="me-2" />
            {EVENT_DETAIL_COPY.listLoading}
          </div>
        ) : p.reservationsError ? (
          <Alert variant="danger">{p.reservationsError}</Alert>
        ) : (
          <>
            <div className="bg-light rounded p-3 mb-3 d-flex flex-wrap align-items-center gap-2 justify-content-between">
              <div className="d-flex flex-wrap gap-3 fw-semibold">
                <span>
                  待簽到 <span className="text-danger">{pendingRows.length}</span>
                </span>
                <span>
                  已簽到 <span className="text-success">{checkedInRows.length}</span>
                </span>
                {violationRows.length > 0 ? (
                  <span>
                    已登記違規 <span className="text-danger">{violationRows.length}</span>
                  </span>
                ) : null}
              </div>
              <div className="flex-grow-1" style={{ minWidth: '200px', maxWidth: '360px' }}>
                <Form.Control
                  size="sm"
                  placeholder="搜尋學號／姓名（兩欄共用）"
                  value={checkinSearchTerm}
                  onChange={(e) => setCheckinSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <Row className="g-3">
              <Col lg={6}>
                <div className="admin-event-checkin-tab__panel admin-event-checkin-tab__panel--pending">
                  <div className="admin-event-checkin-tab__panel-head">
                    待簽到（{filteredPending.length}{q ? `／${pendingRows.length}` : ''}）
                  </div>
                  <div className="table-responsive">
                    <table className="table table-bordered table-sm align-middle mb-0">
                      <thead className="table-success">
                        <tr>
                          <th>學號</th>
                          <th>姓名</th>
                          {isEt && <th>組別</th>}
                          <th style={{ minWidth: '100px' }}>護照</th>
                          <th style={{ minWidth: '120px' }}>簽到</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPending.length === 0 ? (
                          <tr>
                            <td colSpan={isEt ? 5 : 4} className="text-center text-muted">
                              {q ? '沒有符合的待簽到名單' : EVENT_DETAIL_COPY.emptyPendingCheckin}
                            </td>
                          </tr>
                        ) : (
                          filteredPending.map((reservation) => (
                            <tr key={reservation.id}>
                              <td>{reservation.studentId}</td>
                              <td>{reservation.studentName || reservation.name}</td>
                              {isEt && <td>{reservation.group || '—'}</td>}
                              <td>
                                <Form.Check
                                  type="checkbox"
                                  id={`elp-flag-${reservation.id}`}
                                  label="計入"
                                  checked={!!passportFlags[reservation.id]}
                                  onChange={(e) => togglePassportFlag(reservation.id, e.target.checked)}
                                  disabled={!!p.checkinLoading[reservation.id]}
                                />
                              </td>
                              <td>
                                {canCheckinNow ? (
                                  <Button
                                    variant="success"
                                    size="sm"
                                    className="fw-semibold"
                                    onClick={() => handleCheckinClick(reservation)}
                                    disabled={p.checkinLoading[reservation.id]}
                                  >
                                    {p.checkinLoading[reservation.id]
                                      ? '簽到中…'
                                      : !p.isEventToday(p.currentEventDate) && p.canManageEvents
                                        ? '補簽到'
                                        : '簽到'}
                                  </Button>
                                ) : (
                                  <span className="text-muted small">不可簽到</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Col>

              <Col lg={6}>
                <div className="admin-event-checkin-tab__panel admin-event-checkin-tab__panel--done">
                  <div className="admin-event-checkin-tab__panel-head">
                    已簽到（{filteredCheckedIn.length}{q ? `／${checkedInRows.length}` : ''}）
                  </div>
                  <div className="table-responsive">
                    <table className="table table-bordered table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>學號</th>
                          <th>姓名</th>
                          {isEt && <th>組別</th>}
                          <th>時間</th>
                          <th>護照</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCheckedIn.length === 0 ? (
                          <tr>
                            <td colSpan={isEt ? 5 : 4} className="text-center text-muted">
                              {q ? '沒有符合的已簽到名單' : '尚無已簽到學生'}
                            </td>
                          </tr>
                        ) : (
                          filteredCheckedIn.map((reservation) => (
                            <tr key={reservation.id}>
                              <td>{reservation.studentId}</td>
                              <td>{reservation.studentName || reservation.name}</td>
                              {isEt && <td>{reservation.group || '—'}</td>}
                              <td className="small text-muted">
                                {reservation.checkinTime
                                  ? dayjs(reservation.checkinTime).format('HH:mm')
                                  : '—'}
                              </td>
                              <td>
                                {reservation.countsTowardPassport ? (
                                  <span className="badge bg-primary">
                                    {reservation.passportPointsStatus === 'granted'
                                      ? '已入點'
                                      : reservation.passportPointsStatus === 'pending'
                                        ? '待補發'
                                        : reservation.passportPointsStatus === 'blocked_limit'
                                          ? '已滿額'
                                          : '計入'}
                                  </span>
                                ) : (
                                  <span className="text-muted small">—</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {filteredViolations.length > 0 ? (
                    <div className="mt-3">
                      <div className="admin-event-checkin-tab__panel-head admin-event-checkin-tab__panel-head--danger">
                        已登記違規（{filteredViolations.length}）
                      </div>
                      <div className="table-responsive">
                        <table className="table table-bordered table-sm align-middle mb-0">
                          <thead className="table-danger">
                            <tr>
                              <th>學號</th>
                              <th>姓名</th>
                              {isEt && <th>組別</th>}
                              <th>狀態</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredViolations.map((reservation) => (
                              <tr key={reservation.id}>
                                <td>{reservation.studentId}</td>
                                <td>{reservation.studentName || reservation.name}</td>
                                {isEt && <td>{reservation.group || '—'}</td>}
                                <td><span className="badge bg-danger">已登記違規</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Col>
            </Row>
          </>
        )}
      </Card.Body>
    </Card>
  );
}

export default memo(AdminEventCheckinTab);
