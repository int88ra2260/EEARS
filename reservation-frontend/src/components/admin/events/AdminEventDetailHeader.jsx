import React from 'react';
import { Link } from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import { EVENT_DETAIL_COPY } from '../../../constants/adminEventDetailCopy';
import { resolveEventTypeDisplayName } from '../../../services/eventTypeApi';

/**
 * 活動明細頁首：基本資料 + 狀態摘要（不重複 AdminLayout 之「活動明細」標題）
 */
export default function AdminEventDetailHeader({ ws, onGoCheckinTab, onGoViolationsTab }) {
  const cap = ws.eventMeta?.maxCapacity;
  const loc = ws.eventMeta?.location;
  const endT = ws.eventMeta?.endTime;
  const kioskPath = ws.currentEventId
    ? `/admin/operations/${encodeURIComponent(ws.currentEventId)}/checkin-kiosk`
    : null;

  const timeRange =
    ws.currentEventStartTime && endT
      ? `${ws.currentEventStartTime} – ${endT}`
      : ws.currentEventStartTime || '—';

  return (
    <div className="mb-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-2">
        <div className="flex-grow-1 min-w-0">
          <h3 className="h5 mb-2 text-break">{ws.currentEventName || '活動'}</h3>
          <div className="row g-2 small text-muted">
            <div className="col-12 col-sm-6 col-lg-4">
              <span className="text-secondary">日期：</span>
              {ws.currentEventDate || '—'}
            </div>
            <div className="col-12 col-sm-6 col-lg-4">
              <span className="text-secondary">時間：</span>
              {timeRange}
            </div>
            <div className="col-12 col-sm-6 col-lg-4">
              <span className="text-secondary">類型：</span>
              {ws.currentEventType ? resolveEventTypeDisplayName(ws.currentEventType) : '—'}
            </div>
            <div className="col-12 col-sm-6 col-lg-4">
              <span className="text-secondary">地點：</span>
              {loc && String(loc).trim() ? loc : '—'}
            </div>
            <div className="col-12 col-sm-6 col-lg-4">
              <span className="text-secondary">名額／報名／已簽到：</span>
              {cap != null && cap !== '' ? `${cap}／` : '—／'}
              {ws.enrolledCount ?? 0}／
              {ws.headerCountsReady ? ws.checkedInCount : '—'}
            </div>
            <div className="col-12 col-sm-6 col-lg-4">
              <span className="text-secondary">未簽到／已登記違規：</span>
              {ws.headerCountsReady ? ws.noShowReservationCount : '—'}／
              {ws.headerCountsReady ? ws.violationRegisteredCount : '—'}
            </div>
          </div>
        </div>
        <div className="d-flex flex-column align-items-stretch gap-2 flex-shrink-0">
          <Link to="/admin/operations">
            <Button variant="outline-secondary" size="sm" className="w-100">
              ← 返回活動列表
            </Button>
          </Link>
          {onGoCheckinTab && kioskPath && ws.canCheckinStudents ? (
            <Link to={kioskPath}>
              <Button variant="success" size="sm" className="w-100">
                現場 Kiosk 簽到
              </Button>
            </Link>
          ) : null}
          {onGoCheckinTab && ws.checkinOpenHint && ws.headerCountsReady && ws.noShowReservationCount > 0 && (
            <Button variant="outline-success" size="sm" className="w-100" onClick={onGoCheckinTab}>
              前往簽到分頁（{ws.noShowReservationCount} 人未簽）
            </Button>
          )}
          {onGoCheckinTab && ws.checkinOpenHint && !ws.headerCountsReady && (
            <Button variant="outline-success" size="sm" className="w-100" disabled>
              {EVENT_DETAIL_COPY.headerStatsLoading}
            </Button>
          )}
        </div>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-0">
        {ws.checkinOpenHint ? (
          <Badge bg="success">今日活動</Badge>
        ) : (
          <Badge bg="secondary">非今日活動</Badge>
        )}
        {ws.eventEnded ? <Badge bg="dark">活動時間已結束</Badge> : <Badge bg="info">活動尚未結束</Badge>}
        {ws.checkinOpenHint && !ws.eventEnded && (
          <Badge bg="primary">可進行現場簽到</Badge>
        )}
        {ws.headerCountsReady && ws.currentEventAutoCheckCompleted && (
          <Badge bg="warning" text="dark">
            已執行活動結束檢查
          </Badge>
        )}
        {ws.violationsLoaded && (ws.eventViolations?.length || 0) > 0 && (
          onGoViolationsTab ? (
            <button
              type="button"
              className="btn btn-link p-0 border-0 align-baseline"
              onClick={onGoViolationsTab}
              title="前往違規與未到處理"
            >
              <Badge bg="danger">本活動違規紀錄 {ws.eventViolations.length} 筆</Badge>
            </button>
          ) : (
            <Badge bg="danger">本活動違規紀錄 {ws.eventViolations.length} 筆</Badge>
          )
        )}
      </div>
    </div>
  );
}
