import React, { memo } from 'react';
import Button from 'react-bootstrap/Button';
import dayjs from 'dayjs';
import { EVENT_DETAIL_COPY } from '../../../../constants/adminEventDetailCopy';

function AdminEventReservationTable({
  rows,
  currentEventType,
  reservationSearchTerm,
  reservationSortField,
  reservationSortOrder,
  onSort,
  onSearchChange,
  canCheckinStudents,
  canManageViolations,
  canManageEvents,
  checkinLoading,
  onCheckin,
  isEventToday,
  currentEventDate,
  onOpenViolation,
  onOpenCancel,
  showCheckinActions = true,
}) {
  const checkedInCount = rows.filter((r) => r.checkinStatus === '已簽到').length;
  const uncheckedCount = rows.filter((r) => r.checkinStatus === '未簽到').length;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 border-bottom pb-2">
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <label className="form-label mb-0 text-nowrap">搜尋</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="學號或姓名"
              value={reservationSearchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{ minWidth: '200px' }}
            />
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="small text-muted text-nowrap">排序</span>
            <div className="btn-group btn-group-sm" role="group">
              {['studentId', 'name', 'checkinStatus'].map((field) => (
                <button
                  key={field}
                  type="button"
                  className={`btn ${reservationSortField === field ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => onSort(field)}
                >
                  {field === 'studentId' ? '學號' : field === 'name' ? '姓名' : '狀態'}
                  {reservationSortField === field && (reservationSortOrder === 'asc' ? ' ↑' : ' ↓')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="text-muted small text-nowrap">
          顯示 {rows.length} 筆｜已簽到 {checkedInCount}｜未簽到 {uncheckedCount}
        </div>
      </div>
      <p className="small text-muted mb-2">
        此分頁以<strong>完整名單</strong>為主；簽到請優先使用「簽到管理」。違規／批次未到請至最後一分頁，避免誤觸。
      </p>
      <div className="table-responsive">
        <table className="table table-bordered table-sm align-middle">
          <thead className="table-light">
            <tr>
              <th>學號</th>
              <th>姓名</th>
              {currentEventType === 'English Table' && <th>組別</th>}
              <th>簽到狀態</th>
              <th style={{ minWidth: '200px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={currentEventType === 'English Table' ? 5 : 4} className="text-center text-muted">
                  {reservationSearchTerm ? '沒有符合搜尋條件的預約' : EVENT_DETAIL_COPY.emptyReservations}
                </td>
              </tr>
            ) : (
              rows.map((reservation, index) => (
                <tr key={reservation.id || index}>
                  <td>{reservation.studentId}</td>
                  <td>{reservation.studentName || reservation.name}</td>
                  {currentEventType === 'English Table' && (
                    <td>
                      <span className="badge bg-info">{reservation.group}</span>
                    </td>
                  )}
                  <td>
                    <span
                      className={`badge ${
                        reservation.checkinStatus === '已簽到'
                          ? 'bg-success'
                          : reservation.checkinStatus === '已登記違規'
                            ? 'bg-danger'
                            : 'bg-warning'
                      }`}
                    >
                      {reservation.checkinStatus}
                    </span>
                    {reservation.checkinTime && (
                      <div className="small text-muted">{dayjs(reservation.checkinTime).format('HH:mm')}</div>
                    )}
                  </td>
                  <td>
                    <div className="d-flex gap-1 flex-wrap align-items-center">
                      {showCheckinActions &&
                        canCheckinStudents &&
                        reservation.checkinStatus === '未簽到' &&
                        (isEventToday(currentEventDate) || canManageEvents) && (
                          <Button
                            variant="success"
                            size="sm"
                            className="fw-semibold"
                            onClick={() => onCheckin(reservation.id)}
                            disabled={checkinLoading[reservation.id]}
                            title={
                              !isEventToday(currentEventDate) && canManageEvents ? '補簽到（管理員）' : '簽到'
                            }
                          >
                            {checkinLoading[reservation.id]
                              ? '簽到中…'
                              : !isEventToday(currentEventDate) && canManageEvents
                                ? '補簽到'
                                : '簽到'}
                          </Button>
                        )}
                      {reservation.checkinStatus === '未簽到' &&
                        !isEventToday(currentEventDate) &&
                        !canManageEvents && (
                          <span className="text-muted small">
                            {new Date(currentEventDate) > new Date() ? '尚未到活動日' : '活動已過期'}
                          </span>
                        )}
                      {reservation.checkinStatus === '已登記違規' && (
                        <span className="text-danger small">已登記違規</span>
                      )}
                      {canManageViolations && reservation.checkinStatus !== '已登記違規' && (
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => onOpenViolation(reservation.studentId)}
                        >
                          違規…
                        </Button>
                      )}
                      {canManageEvents && reservation.checkinStatus !== '已簽到' && (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => onOpenCancel(reservation)}
                          title="刪除預約（管理員）"
                        >
                          取消預約
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default memo(AdminEventReservationTable);
