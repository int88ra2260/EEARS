import React, { memo } from 'react';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import dayjs from 'dayjs';
import { EVENT_DETAIL_COPY } from '../../../../constants/adminEventDetailCopy';
import AdminEventReservationTable from './AdminEventReservationTable';

function AdminEventReservationsTab({
  tabProps,
  onOpenViolationTab,
  onOpenCancel,
}) {
  const p = tabProps;

  return (
    <Card className="border-0 shadow-sm">
      <Card.Body className="pt-3">
        <h6 className="text-secondary fw-semibold mb-3">主任務：檢視與搜尋全部預約</h6>
        {p.resBlocking ? (
          <div className="text-center py-5 text-muted">
            <Spinner animation="border" size="sm" className="me-2" />
            {EVENT_DETAIL_COPY.listLoading}
          </div>
        ) : p.reservationsError ? (
          <Alert variant="danger">{p.reservationsError}</Alert>
        ) : (
          <>
            <AdminEventReservationTable
              rows={p.filteredReservationData}
              currentEventType={p.currentEventType}
              reservationSearchTerm={p.reservationSearchTerm}
              reservationSortField={p.reservationSortField}
              reservationSortOrder={p.reservationSortOrder}
              onSort={p.handleReservationSort}
              onSearchChange={p.setReservationSearchTerm}
              canCheckinStudents={p.canCheckinStudents}
              canManageViolations={p.canManageViolations}
              canManageEvents={p.canManageEvents}
              checkinLoading={p.checkinLoading}
              onCheckin={p.handleCheckin}
              isEventToday={p.isEventToday}
              currentEventDate={p.currentEventDate}
              onOpenViolation={(studentId) => {
                onOpenViolationTab(studentId);
              }}
              onOpenCancel={onOpenCancel}
            />
            {p.canViewReservations && (
              <div className="mt-4 pt-3 border-top">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                  <h6 className="text-secondary fw-semibold mb-0">候補已停用（歷史）</h6>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    type="button"
                    onClick={() => p.refreshWaitlist && p.refreshWaitlist()}
                    disabled={p.waitlistLoading}
                  >
                    {p.waitlistLoading ? '載入中…' : '重新整理歷史'}
                  </Button>
                </div>
                {p.waitlistError ? (
                  <Alert variant="warning" className="mb-0 py-2">
                    {p.waitlistError}
                  </Alert>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-bordered table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>順位</th>
                          <th>學號</th>
                          <th>姓名</th>
                          <th>Email</th>
                          <th>狀態</th>
                          <th>建立時間</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!p.waitlistItems || p.waitlistItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center text-muted">
                              {p.waitlistLoading ? '載入中…' : '目前無候補歷史紀錄'}
                            </td>
                          </tr>
                        ) : (
                          p.waitlistItems.map((row) => (
                            <tr key={row.id}>
                              <td>{row.position != null ? row.position : '—'}</td>
                              <td>{row.studentId}</td>
                              <td>{row.studentName}</td>
                              <td className="text-break">{row.studentEmail}</td>
                              <td>{row.status}</td>
                              <td>
                                {row.createdAt ? dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') : '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}

export default memo(AdminEventReservationsTab);
