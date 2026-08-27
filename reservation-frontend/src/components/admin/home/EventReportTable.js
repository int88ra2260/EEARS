// components/admin/home/EventReportTable.js
// 活動報表區塊：篩選、表格與操作鈕。由 AdminHome 傳入資料與 handlers.

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { getSemesterOptions } from '../../../utils/adminReportUtils';
import { eventDetailPath, getEventRowStatusBadges } from '../../../utils/eventListStatus';
import ErrorAlert from '../shared/ErrorAlert';
import '../../../styles/admin-operations.css';

/**
 * @param {Object} props
 * @param {Array} props.summary
 * @param {boolean} props.loading
 * @param {string} props.error
 * @param {string} props.selectedSemester
 * @param {string} props.selectedEventType
 * @param {string} props.dateFilterMode
 * @param {string} props.filterDate
 * @param {string} props.filterDateFrom
 * @param {string} props.filterDateTo
 * @param {Array<{value: string, label: string}>} props.eventTypeOptions
 * @param {boolean} props.canExportReports
 * @param {boolean} props.canExportReservations
 * @param {boolean} props.isTeacher
 * @param {string} props.userRole
 * @param {(s: string) => void} props.onSemesterChange
 * @param {(s: string) => void} props.onEventTypeChange
 * @param {(s: string) => void} props.onDateFilterModeChange
 * @param {(s: string) => void} props.onFilterDateChange
 * @param {(s: string) => void} props.onFilterDateFromChange
 * @param {(s: string) => void} props.onFilterDateToChange
 * @param {(preset: 'today' | 'week') => void} props.onApplyDatePreset
 * @param {() => void} props.onClearFilterDate
 * @param {() => void} props.onExportAll
 * @param {(eventId: number|string) => void} props.onExport
 * @param {(eventId: number|string) => void} props.onEventDetail
 * @param {(evt: Object) => void} props.onEditEvent
 * @param {(eventId: number|string, eventName: string) => void} props.onDeleteEvent
 * @param {(dateStr: string) => boolean} props.isEventToday
 * @param {React.ReactNode} [props.middleContent]
 */
export default function EventReportTable({
  summary = [],
  loading,
  error,
  selectedSemester,
  selectedEventType,
  dateFilterMode = 'single',
  filterDate,
  filterDateFrom = '',
  filterDateTo = '',
  eventTypeOptions = [],
  canExportReports,
  canExportReservations,
  isTeacher,
  userRole,
  onSemesterChange,
  onEventTypeChange,
  onDateFilterModeChange,
  onFilterDateChange,
  onFilterDateFromChange,
  onFilterDateToChange,
  onApplyDatePreset,
  onClearFilterDate,
  onExportAll,
  onExport,
  onEditEvent,
  onDeleteEvent,
  isEventToday,
  middleContent = null,
}) {
  const isWorker = userRole === 'worker';

  const stats = useMemo(() => {
    const list = Array.isArray(summary) ? summary : [];
    const todayCount = list.filter((evt) => isEventToday(evt.date)).length;
    const totalReserved = list.reduce((sum, evt) => sum + (Number(evt.reservedCount) || 0), 0);
    const totalSpots = list.reduce((sum, evt) => sum + (Number(evt.availableSpots) || 0), 0);
    return {
      total: list.length,
      todayCount,
      totalReserved,
      totalSpots,
    };
  }, [summary, isEventToday]);

  const renderActions = (evt) => {
    const detailPath = eventDetailPath(evt.eventId);
    const checkinPath = eventDetailPath(evt.eventId, 'checkin');
    const violationPath = eventDetailPath(evt.eventId, 'violations');
    const isToday = isEventToday(evt.date);

    if (isWorker) {
      return (
        <Link to={checkinPath} className="btn btn-sm btn-outline-success">
          簽到／管理
        </Link>
      );
    }

    return (
      <>
        {canExportReservations && (
          <button type="button" className="btn btn-sm btn-outline-info" onClick={() => onExport(evt.eventId)}>
            匯出
          </button>
        )}
        <Link to={detailPath} className="btn btn-sm btn-outline-success">
          明細
        </Link>
        {isToday ? (
          <Link to={checkinPath} className="btn btn-sm btn-success">
            簽到
          </Link>
        ) : null}
        <Link to={violationPath} className="btn btn-sm btn-outline-danger">
          違規
        </Link>
        {!isTeacher ? (
          <>
            <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => onEditEvent(evt)}>
              修改
            </button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDeleteEvent(evt.eventId, evt.name)}>
              刪除
            </button>
          </>
        ) : null}
      </>
    );
  };

  return (
    <div className="admin-operations">
      <div className="admin-operations__stats" aria-label="活動概況">
        <div className="admin-operations__stat">
          <span className="admin-operations__stat-label">篩選後活動數</span>
          <span className="admin-operations__stat-value admin-operations__stat-value--accent">{stats.total}</span>
        </div>
        <div className="admin-operations__stat">
          <span className="admin-operations__stat-label">今日場次</span>
          <span className="admin-operations__stat-value">{stats.todayCount}</span>
        </div>
        <div className="admin-operations__stat">
          <span className="admin-operations__stat-label">總預約人數</span>
          <span className="admin-operations__stat-value">{stats.totalReserved}</span>
        </div>
        <div className="admin-operations__stat">
          <span className="admin-operations__stat-label">總剩餘名額</span>
          <span className="admin-operations__stat-value">{stats.totalSpots}</span>
        </div>
      </div>

      <div className="alert alert-light border mb-3 small" role="note">
        <strong>營運流程：</strong>
        由本頁「明細」進入後，可於同一頁切換「簽到管理」「違規與未到處理」。今日場次可直接按「簽到」。
      </div>

      <div className="admin-operations__filters">
        <div className="admin-operations__filter-group">
          <label className="admin-operations__filter-label" htmlFor="admin-ops-semester">學期</label>
          <select
            id="admin-ops-semester"
            className="form-select"
            value={selectedSemester}
            onChange={(e) => onSemesterChange(e.target.value)}
          >
            {getSemesterOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-operations__filter-group">
          <label className="admin-operations__filter-label" htmlFor="admin-ops-type">活動類別</label>
          <select
            id="admin-ops-type"
            className="form-select"
            value={selectedEventType}
            onChange={(e) => onEventTypeChange(e.target.value)}
          >
            {eventTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-operations__filter-group">
          <label className="admin-operations__filter-label" htmlFor="admin-ops-date-mode">日期篩選</label>
          <select
            id="admin-ops-date-mode"
            className="form-select"
            value={dateFilterMode}
            onChange={(e) => onDateFilterModeChange(e.target.value)}
          >
            <option value="single">單日</option>
            <option value="range">區間</option>
          </select>
        </div>
        {dateFilterMode === 'range' ? (
          <>
            <div className="admin-operations__filter-group">
              <label className="admin-operations__filter-label" htmlFor="admin-ops-date-from">開始日期</label>
              <input
                id="admin-ops-date-from"
                type="date"
                className="form-control"
                value={filterDateFrom}
                onChange={(e) => onFilterDateFromChange(e.target.value)}
              />
            </div>
            <div className="admin-operations__filter-group">
              <label className="admin-operations__filter-label" htmlFor="admin-ops-date-to">結束日期</label>
              <input
                id="admin-ops-date-to"
                type="date"
                className="form-control"
                value={filterDateTo}
                onChange={(e) => onFilterDateToChange(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="admin-operations__filter-group">
            <label className="admin-operations__filter-label" htmlFor="admin-ops-date">日期</label>
            <input
              id="admin-ops-date"
              type="date"
              className="form-control"
              value={filterDate}
              onChange={(e) => onFilterDateChange(e.target.value)}
            />
          </div>
        )}
        <div className="admin-operations__filter-group">
          <span className="admin-operations__filter-label">&nbsp;</span>
          <div className="admin-operations__filter-date-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={() => onApplyDatePreset('today')}>
              今日
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => onApplyDatePreset('week')}>
              近7天
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={onClearFilterDate}>
              不限日期
            </button>
          </div>
        </div>
        {canExportReports && (
          <div className="admin-operations__filter-actions">
            <button type="button" className="btn btn-outline-primary" onClick={onExportAll}>
              匯出總覽報表
            </button>
          </div>
        )}
      </div>

      {middleContent}

      {loading ? (
        <div className="admin-operations__loading" role="status" aria-live="polite">
          <Spinner animation="border" size="sm" />
          <span>載入活動資料中…</span>
        </div>
      ) : error ? (
        <ErrorAlert error={error} />
      ) : !Array.isArray(summary) || summary.length === 0 ? (
        <div className="admin-operations__empty">
          <div className="admin-operations__empty-title">尚無活動資料</div>
          <p className="mb-0 small">請調整學期、類別或日期篩選條件</p>
        </div>
      ) : (
        <div className="admin-operations__table-wrap table-responsive">
          <table className="table table-bordered admin-operations__table mb-0">
            <thead>
              <tr>
                <th>活動名稱</th>
                <th>活動類型</th>
                <th>日期</th>
                <th>時間</th>
                <th>活動地點</th>
                <th>狀態</th>
                <th>預約人數</th>
                <th>剩餘名額</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((evt) => {
                const isToday = isEventToday(evt.date);
                const statusBadges = getEventRowStatusBadges(evt, isToday);
                return (
                  <tr key={evt.eventId} className={isToday ? 'is-today' : ''}>
                    <td>{evt.name}</td>
                    <td>{evt.eventType}</td>
                    <td>{evt.date}</td>
                    <td>{evt.startTime} – {evt.endTime}</td>
                    <td>{evt.location || '地點待公告'}</td>
                    <td>
                      {statusBadges.length === 0 ? '—' : statusBadges.map((badge) => (
                        <span key={badge.label} className={`badge ${badge.className} me-1`}>
                          {badge.label}
                        </span>
                      ))}
                    </td>
                    <td>{evt.reservedCount}</td>
                    <td>{evt.availableSpots}</td>
                    <td>
                      <div className="admin-operations__actions">{renderActions(evt)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
