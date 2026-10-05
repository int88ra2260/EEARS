import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { getEventLocationDisplay } from '../../utils/eventLocation';
import { calculateReservationTime } from '../../utils/reservationTime';
import { formatBookingCode } from '../../utils/bookingCode';
import { eventTypeFilterToQueryParam } from '../../utils/eventTypeQuery';
import EnglishTableTopicPanel from '../events/EnglishTableTopicPanel';

export default function BookingSuccessView({
  event,
  studentEmail,
  reservationId,
  bookingCode,
  successAt,
  onClose,
}) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [qrError, setQrError] = useState('');

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

  useEffect(() => {
    let cancelled = false;
    async function drawQr() {
      if (!bookingIdLabel || bookingIdLabel === '（未提供）' || !canvasRef.current) return;
      try {
        await QRCode.toCanvas(canvasRef.current, bookingIdLabel, {
          width: 180,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#111111', light: '#ffffff' },
        });
        if (!cancelled) setQrError('');
      } catch (err) {
        if (!cancelled) setQrError('QR 產生失敗，請改以簽到碼出示');
      }
    }
    drawQr();
    return () => {
      cancelled = true;
    };
  }, [bookingIdLabel]);

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
    <div className="booking-success">
      <div className="d-flex align-items-center gap-2">
        <div
          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
          style={{ width: 36, height: 36, backgroundColor: '#198754', color: 'white' }}
        >
          <i className="fas fa-check" />
        </div>
        <div>
          <h4 className="mb-0">預約成功！</h4>
          <p className="text-muted mb-0 small">已完成此次預約，請留意下方提醒。</p>
        </div>
      </div>

      <div className="alert alert-warning py-2 mt-2 mb-2">
        <strong>請攜帶學生證。</strong>
        參加活動請務必攜帶學生證。現場簽到時需出示學生證，才能計入課堂加分。
      </div>

      <div className="booking-success__columns">
        <div className="alert alert-info py-2 mb-2 mb-md-0">
          <strong>活動資訊</strong>
          <div className="mt-1">
            <div><strong>活動名稱：</strong> {eventName}</div>
            <div><strong>日期：</strong> {eventDate}</div>
            <div><strong>時間：</strong> {eventStart} - {eventEnd}</div>
            <div><strong>地點：</strong> {locationLabel}</div>
            {openStartLabel && openEndLabel ? (
              <>
                <div><strong>開放時間：</strong> {openStartLabel}</div>
                <div><strong>截止時間：</strong> {openEndLabel}</div>
              </>
            ) : null}
          </div>
        </div>

        <div className="alert alert-secondary py-2 mb-2 mb-md-0 text-center">
          <div><strong>預約編號／現場簽到碼</strong></div>
          <div className="mt-1">{bookingIdLabel}</div>
          <div className="booking-success__qr mt-2">
            <canvas ref={canvasRef} aria-label={`簽到 QR ${bookingIdLabel}`} />
          </div>
          {qrError ? <div className="small text-danger mt-1">{qrError}</div> : null}
          <div className="small text-muted mt-1">活動現場請出示此 QR 或簽到碼</div>
          <div className="small text-muted mt-1">建立時間：{successAtLabel}</div>
        </div>
      </div>

      <EnglishTableTopicPanel
        date={safeEvent.date}
        eventType={safeEvent.eventType}
        defaultOpen
      />

      <p className="small text-muted mb-0 mt-2">
        預約資訊將寄至 <strong>{emailLabel}</strong>。
        若無法參加，請在<strong>活動開始前至少 2 小時</strong>取消，否則可能記違規。
        未收到信請先看垃圾信匣，或到「我的預約」查詢。
      </p>

      <div className="mt-2 d-flex flex-column flex-sm-row flex-wrap gap-2">
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
