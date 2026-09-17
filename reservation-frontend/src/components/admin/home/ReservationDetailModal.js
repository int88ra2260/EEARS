// components/admin/home/ReservationDetailModal.js
// 預約詳情 Modal：UI / rendering，API、check-in、違規、匯入 Excel、auto-check、state 與 business logic 保留在 AdminHome。

import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import dayjs from 'dayjs';
import { isEnglishTableEventType } from '../../../utils/eventCapacityFields';

/**
 * @param {Object} props
 * @param {boolean} props.show
 * @param {{ id: number|string|null, name: string, date: string, eventType: string }} props.event
 * @param {Array} props.reservations - 已篩選/排序後的預約列表
 * @param {{ total: number, checkedIn: number, noShow: number, violation: number }} props.stats - 總人數、已簽到、未簽到、已登記違規
 * @param {string} props.searchTerm
 * @param {{ field: string, order: 'asc'|'desc' }} props.sortConfig
 * @param {(value: string) => void} props.onSearchChange
 * @param {(field: string) => void} props.onSortChange
 * @param {() => void} props.onClose
 * @param {boolean} props.canImportExcel
 * @param {boolean} props.isAdmin
 * @param {boolean} props.hasAdminRights
 * @param {(dateStr: string) => boolean} props.isEventToday
 * @param {Array} props.eventViolations
 * @param {Object} props.checkinLoading - { [reservationId]: boolean }
 * @param {boolean} props.batchMarkNoShowLoading
 * @param {boolean} props.autoCheckLoading
 * @param {boolean} props.currentEventAutoCheckCompleted
 * @param {(reservationId: number|string) => void} props.onCheckIn
 * @param {() => void} props.onImportExcel
 * @param {(studentId?: string) => void} props.onOpenViolation
 * @param {() => void} props.onBatchMarkNoShow
 * @param {() => void} props.onAutoCheck
 * @param {(reservationId: number|string, studentId: string, studentName: string) => void} props.onDeleteReservation
 * @param {boolean} props.showCancelButton
 */
export default function ReservationDetailModal({
  show,
  event: eventInfo,
  reservations = [],
  stats = { total: 0, checkedIn: 0, noShow: 0, violation: 0 },
  searchTerm,
  sortConfig = { field: 'studentId', order: 'asc' },
  onSearchChange,
  onSortChange,
  onClose,
  canImportExcel,
  isAdmin,
  hasAdminRights,
  isEventToday,
  eventViolations = [],
  checkinLoading = {},
  batchMarkNoShowLoading,
  autoCheckLoading,
  currentEventAutoCheckCompleted,
  onCheckIn,
  onImportExcel,
  onOpenViolation,
  onBatchMarkNoShow,
  onAutoCheck,
  onDeleteReservation,
  showCancelButton
}) {
  const { id: eventId, name: eventName, date: eventDate, eventType } = eventInfo || {};

  return (
    <Modal
      show={show}
      onHide={onClose}
      size="xl"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          預約詳情 - {eventName}
          {eventDate && (
            <span className="ms-2 text-white small">
              ({eventDate} {isEventToday && isEventToday(eventDate) ? '- 今天' : ''})
            </span>
          )}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex gap-2">
            {canImportExcel && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={onImportExcel}
                disabled={!eventId}
              >
                匯入刷卡機 Excel
              </Button>
            )}
            <Button variant="outline-primary" size="sm" onClick={() => onOpenViolation()}>
              登記違規
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={onBatchMarkNoShow}
              disabled={batchMarkNoShowLoading || !eventId || stats.noShow === 0}
            >
              {batchMarkNoShowLoading ? '處理中...' : `一鍵登記未簽到 (${stats.noShow})`}
            </Button>
            {isAdmin && (
              <Button
                variant="outline-success"
                size="sm"
                onClick={onAutoCheck}
                disabled={autoCheckLoading || !eventId || currentEventAutoCheckCompleted}
                title={currentEventAutoCheckCompleted ? '此活動已執行過活動結束檢查' : ''}
              >
                {autoCheckLoading ? '檢查中...' : currentEventAutoCheckCompleted ? '已執行檢查' : '活動結束檢查'}
              </Button>
            )}
          </div>
          <div className="text-muted">
            總人數：{stats.total} | 已簽到：{stats.checkedIn} | 未簽到：{stats.noShow} | 已登記違規：{stats.violation}
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <label className="form-label mb-0">搜尋：</label>
              <input
                type="text"
                className="form-control"
                placeholder="輸入學號或姓名"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                style={{ minWidth: '200px' }}
              />
            </div>
            <div className="d-flex align-items-center gap-2">
              <label className="form-label mb-0">排序：</label>
              <div className="btn-group" role="group">
                <button
                  type="button"
                  className={`btn btn-sm ${sortConfig.field === 'studentId' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => onSortChange('studentId')}
                >
                  學號 {sortConfig.field === 'studentId' && (sortConfig.order === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${sortConfig.field === 'name' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => onSortChange('name')}
                >
                  姓名 {sortConfig.field === 'name' && (sortConfig.order === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${sortConfig.field === 'checkinStatus' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => onSortChange('checkinStatus')}
                >
                  狀態 {sortConfig.field === 'checkinStatus' && (sortConfig.order === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>
          </div>
          <div className="text-muted">
            總人數：{stats.total} | 已簽到：{stats.checkedIn} | 未簽到：{stats.noShow} | 已登記違規：{stats.violation}
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-bordered table-sm">
            <thead>
              <tr>
                <th>學號</th>
                <th>姓名</th>
                {isEnglishTableEventType(eventType) && <th>組別</th>}
                <th>簽到狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={isEnglishTableEventType(eventType) ? 5 : 4} className="text-center text-muted">
                    {searchTerm ? '沒有符合搜尋條件的預約' : '尚無預約資料'}
                  </td>
                </tr>
              ) : (
                reservations.map((reservation, index) => (
                  <tr key={reservation.id != null ? reservation.id : index}>
                    <td>{reservation.studentId}</td>
                    <td>{reservation.studentName || reservation.name}</td>
                    {isEnglishTableEventType(eventType) && (
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
                        <div className="small text-muted">
                          {dayjs(reservation.checkinTime).format('HH:mm')}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        {reservation.checkinStatus === '未簽到' &&
                          (isEventToday(eventDate) || hasAdminRights) && (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => onCheckIn(reservation.id)}
                              disabled={checkinLoading[reservation.id]}
                              title={
                                isEventToday && !isEventToday(eventDate) && hasAdminRights
                                  ? '補簽到（管理員功能）'
                                  : ''
                              }
                            >
                              {checkinLoading[reservation.id]
                                ? '簽到中...'
                                : isEventToday && !isEventToday(eventDate) && hasAdminRights
                                ? '補簽到'
                                : '簽到'}
                            </Button>
                          )}
                        {reservation.checkinStatus === '未簽到' &&
                          isEventToday &&
                          !isEventToday(eventDate) &&
                          !hasAdminRights && (
                            <span className="text-muted small">
                              {new Date(eventDate) > new Date() ? '尚未到活動日期' : '活動已過期'}
                            </span>
                          )}
                        {reservation.checkinStatus === '已登記違規' && (
                          <span className="text-danger small">已登記違規</span>
                        )}
                        {reservation.checkinStatus !== '已登記違規' && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => onOpenViolation(reservation.studentId)}
                          >
                            違規
                          </Button>
                        )}
                        {showCancelButton && (
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() =>
                              onDeleteReservation(
                                reservation.id,
                                reservation.studentId,
                                reservation.studentName || reservation.name
                              )
                            }
                            title="刪除預約紀錄（管理員功能）"
                          >
                            取消
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

        {eventViolations.length > 0 && (
          <div className="mt-4">
            <h6 className="text-danger">活動期間違規記錄</h6>
            <div className="table-responsive">
              <table className="table table-sm table-bordered">
                <thead className="table-danger">
                  <tr>
                    <th>學號</th>
                    <th>姓名</th>
                    <th>違規類型</th>
                    <th>描述</th>
                    <th>記錄時間</th>
                    <th>記錄者</th>
                  </tr>
                </thead>
                <tbody>
                  {eventViolations.map((violation) => (
                    <tr key={violation.id}>
                      <td>{violation.User?.studentId}</td>
                      <td>{violation.User?.name}</td>
                      <td>
                        <span className="badge bg-danger">{violation.violationType}</span>
                      </td>
                      <td>{violation.description || '—'}</td>
                      <td>{dayjs(violation.recordedAt).format('MM/DD HH:mm')}</td>
                      <td>{violation.recordedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          關閉
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
