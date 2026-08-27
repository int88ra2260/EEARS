import React from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { getEventLocationDisplay } from '../../utils/eventLocation';
import { calculateReservationTime } from '../../utils/reservationTime';
import { formatBookingCode } from '../../utils/bookingCode';
import { eventTypeFilterToQueryParam } from '../../utils/eventTypeQuery';

export default function BookingSuccessView({
  event,
  studentEmail,
  reservationId,
  bookingCode,
  successAt,
  onClose,
}) {
  const navigate = useNavigate();

  const safeEvent = event || {};
  const eventName = safeEvent.name || '（未提供活動名稱）';
  const eventDate = safeEvent.date || '（未提供日期）';
  const eventStart = safeEvent.startTime || '--:--';
  const eventEnd = safeEvent.endTime || '--:--';
  const typeSlug = eventTypeFilterToQueryParam(safeEvent.eventType || 'all');
  const phrasebookPath = typeSlug && typeSlug !== 'all'
    ? `/guides/activity-phrasebook/${typeSlug}`
    : '/guides/activity-phrasebook';

  let openStartLabel = '';
  let openEndLabel = '';
  try {
    const { openStart, openEnd } = calculateReservationTime(safeEvent);
    openStartLabel = openStart.format('YYYY/MM/DD dddd HH:mm');
    openEndLabel = openEnd.format('YYYY/MM/DD dddd HH:mm');
  } catch {
    // ignore
  }

  const locationLabel = getEventLocationDisplay(safeEvent) || '（未提供地點）';
  const emailLabel = studentEmail || '您填寫的 Email';
  const bookingIdLabel = formatBookingCode(bookingCode, reservationId);
  const successAtLabel = successAt ? new Date(successAt).toLocaleString('zh-TW') : new Date().toLocaleString('zh-TW');

  const handleMyReservations = () => {
    if (typeof onClose === 'function') onClose();
    navigate('/my-reservations');
  };

  const handleBookAnother = () => {
    if (typeof onClose === 'function') onClose();
    navigate('/events');
  };

  const handleProgress = () => {
    if (typeof onClose === 'function') onClose();
    navigate('/student/progress');
  };

  const handlePhrasebook = () => {
    if (typeof onClose === 'function') onClose();
    navigate(phrasebookPath);
  };

  return (
    <div>
      <div className="d-flex align-items-start gap-2">
        <div
          className="rounded-circle d-flex align-items-center justify-content-center"
          style={{ width: 44, height: 44, backgroundColor: '#198754', color: 'white' }}
        >
          <i className="fas fa-check" />
        </div>
        <div>
          <h4 className="mb-1">預約成功！</h4>
          <p className="text-muted mb-0">已完成此次預約流程，接下來請依建議完成後續事項。</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="alert alert-info mb-3">
          <strong>活動資訊：</strong>
          <div className="mt-2">
            <div><strong>活動名稱：</strong> {eventName}</div>
            <div><strong>日期：</strong> {eventDate}</div>
            <div><strong>時間：</strong> {eventStart} - {eventEnd}</div>
            <div><strong>地點：</strong> {locationLabel}</div>
            {openStartLabel && openEndLabel ? (
              <div className="mt-2">
                <div><strong>開放時間：</strong> {openStartLabel}</div>
                <div><strong>截止時間：</strong> {openEndLabel}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="alert alert-secondary mb-0">
          <strong>已送出預約的提示：</strong>
          <div className="mt-2">
            <strong>預約編號：</strong> {bookingIdLabel}
          </div>
          <div className="mt-1">
            <strong>建立時間：</strong> {successAtLabel}
          </div>
          <div className="mt-2">
            預約資訊將寄送至 <strong>{emailLabel}</strong>。
          </div>
          <div className="mt-2">
            若無法參加，請在<strong>活動開始前至少 2 小時</strong>取消，否則可能記違規。
          </div>
          <div className="mt-2 text-muted">
            若稍後未收到通知，請先確認垃圾信匣，或前往「我的預約」查詢與取消。
          </div>
          <div className="mt-2 text-muted">
            請保留此預約編號，可作為預約成功的查詢依據。
          </div>
        </div>

        <div className="alert alert-light border mt-3 mb-0">
          <strong>活動前語言支援：</strong>
          <div className="mt-1">
            出發前可先看應答指南與常用句，暖身後再參加會更有把握。
          </div>
        </div>
      </div>

      <div className="mt-3 d-flex flex-column flex-sm-row flex-wrap gap-2">
        <Button variant="primary" onClick={handleMyReservations}>
          查看我的預約
        </Button>
        <Button variant="outline-primary" onClick={handlePhrasebook}>
          活動前語言支援
        </Button>
        <Button variant="outline-primary" onClick={handleBookAnother}>
          再預約一場
        </Button>
        <Button variant="outline-secondary" onClick={handleProgress}>
          查看我的英語進度
        </Button>
      </div>
    </div>
  );
}

