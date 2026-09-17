import React, { memo } from 'react';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import { EVENT_DETAIL_COPY } from '../../../../constants/adminEventDetailCopy';
import AdminEventReservationTable from './AdminEventReservationTable';

function AdminEventReservationsTab({
  tabProps,
  onOpenViolationTab,
  onOpenCancel,
  onGoCheckinTab,
}) {
  const p = tabProps;
  const pendingCount = p.noShowReservationCount ?? 0;

  return (
    <Card className="border-0 shadow-sm">
      <Card.Body className="pt-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <h6 className="text-secondary fw-semibold mb-0">主任務：檢視與搜尋全部預約</h6>
          {p.canCheckinStudents && pendingCount > 0 && onGoCheckinTab ? (
            <Button variant="success" size="sm" onClick={onGoCheckinTab}>
              {EVENT_DETAIL_COPY.goCheckinCta}（{pendingCount}）
            </Button>
          ) : null}
        </div>
        {p.resBlocking ? (
          <div className="text-center py-5 text-muted">
            <Spinner animation="border" size="sm" className="me-2" />
            {EVENT_DETAIL_COPY.listLoading}
          </div>
        ) : p.reservationsError ? (
          <Alert variant="danger">{p.reservationsError}</Alert>
        ) : (
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
            showCheckinActions={false}
          />
        )}
      </Card.Body>
    </Card>
  );
}

export default memo(AdminEventReservationsTab);
