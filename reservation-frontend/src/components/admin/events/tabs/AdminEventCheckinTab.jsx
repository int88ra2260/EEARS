import React, { memo, useMemo, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import { EVENT_DETAIL_COPY } from '../../../../constants/adminEventDetailCopy';

function AdminEventCheckinTab({ tabProps }) {
  const p = tabProps;
  const [checkinSearchTerm, setCheckinSearchTerm] = useState('');

  const filteredPendingCheckin = useMemo(() => {
    const rows = p.pendingCheckinRows || [];
    if (!checkinSearchTerm.trim()) return rows;
    const q = checkinSearchTerm.toLowerCase();
    return rows.filter((r) => {
      const sid = (r.studentId || '').toLowerCase();
      const name = (r.studentName || r.name || '').toLowerCase();
      return sid.includes(q) || name.includes(q);
    });
  }, [p.pendingCheckinRows, checkinSearchTerm]);

  return (
    <Card className="shadow-sm border-success border-top border-3">
      <Card.Body className="pt-3">
        <h6 className="text-success fw-semibold mb-2">主任務：現場簽到／補簽到</h6>
        <p className="small text-muted mb-3">
          僅列出<strong>尚未簽到</strong>者；請依學號或姓名搜尋後點<strong className="text-success">簽到</strong>。
        </p>
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
              <div className="fw-semibold">
                待簽到 <span className="text-danger">{p.pendingCheckinRows.length}</span> 人
              </div>
              <div className="d-flex align-items-center gap-2 flex-grow-1 flex-wrap" style={{ minWidth: '200px' }}>
                <Form.Control
                  size="sm"
                  placeholder="搜尋待簽到學號／姓名"
                  value={checkinSearchTerm}
                  onChange={(e) => setCheckinSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-bordered table-sm align-middle">
                <thead className="table-success">
                  <tr>
                    <th>學號</th>
                    <th>姓名</th>
                    {p.currentEventType === 'English Table' && <th>組別</th>}
                    <th style={{ minWidth: '140px' }}>簽到</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingCheckin.length === 0 ? (
                    <tr>
                      <td
                        colSpan={p.currentEventType === 'English Table' ? 4 : 3}
                        className="text-center text-muted"
                      >
                        {checkinSearchTerm.trim() ? '沒有符合的待簽到名單' : EVENT_DETAIL_COPY.emptyPendingCheckin}
                      </td>
                    </tr>
                  ) : (
                    filteredPendingCheckin.map((reservation, index) => (
                      <tr key={reservation.id || index}>
                        <td>{reservation.studentId}</td>
                        <td>{reservation.studentName || reservation.name}</td>
                        {p.currentEventType === 'English Table' && <td>{reservation.group}</td>}
                        <td>
                          {p.canCheckinStudents && (p.isEventToday(p.currentEventDate) || p.canManageEvents) && (
                            <Button
                              variant="success"
                              size="lg"
                              className="px-4 fw-semibold"
                              onClick={() => p.handleCheckin(reservation.id)}
                              disabled={p.checkinLoading[reservation.id]}
                            >
                              {p.checkinLoading[reservation.id]
                                ? '簽到中…'
                                : !p.isEventToday(p.currentEventDate) && p.canManageEvents
                                  ? '補簽到'
                                  : '簽到'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  );
}

export default memo(AdminEventCheckinTab);
