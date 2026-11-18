/**
 * 單筆預約結果：活動名稱、日期時間、登入後取消
 */
import React, { useState } from 'react';
import dayjs from 'dayjs';
import { Button, Modal } from 'react-bootstrap';
import { useLanguage } from '../../context/LanguageContext';
import { canCancelReservation } from '../../hooks/useReservationLookup';
import { RESERVATION_CUTOFF_HOURS } from '../../constants/reservationRules';
import StatusBadge from '../ui/StatusBadge';
import { formatBookingCode } from '../../utils/bookingCode';
import { reservationTiming } from '../../utils/reservationRecordGroups';
import EnglishTableTopicPanel from '../events/EnglishTableTopicPanel';
import EnglishTablePracticeGuide from '../events/EnglishTablePracticeGuide';
import { isEnglishTableEventType } from '../../utils/eventCapacityFields';
import CheckinQrCanvas from './CheckinQrCanvas';
import './ReservationResultCard.css';

export default function ReservationResultCard({
  record,
  cancelingReservationId,
  cancelLoading = false,
  cancelError = '',
  onConfirmCancel,
}) {
  const { t } = useLanguage();
  const [qrOpen, setQrOpen] = useState(false);
  const canCancel = canCancelReservation(record);
  const eventStart = dayjs(`${record.date}T${record.startTime}`);
  const twoHoursBefore = eventStart.subtract(RESERVATION_CUTOFF_HOURS, 'hour');
  const isThisCanceling = cancelingReservationId === record.id;
  const bookingId = formatBookingCode(record.bookingCode, record.reservationId || record.id);
  const timing = reservationTiming(record);
  const ended = timing === 'ended';
  const canShowQr = !ended && bookingId !== '（未提供）';
  const createdAtRaw = record.createdAt || record.timestamp || null;
  const createdAtLabel = createdAtRaw ? dayjs(createdAtRaw).format('YYYY/MM/DD HH:mm') : '（未提供）';
  const statusHelper = canCancel
    ? '可取消：尚在取消期限內。登入後即可取消，不必輸入驗證碼。'
    : timing === 'in_progress'
      ? '活動進行中，仍可出示簽到 QR。已過取消期限。'
      : '已過取消期限，活動開始前仍可出示簽到 QR。';

  if (ended) {
    return (
      <div className="reservation-result-card reservation-result-card--ended">
        <div className="reservation-result-card-main">
          <div className="reservation-result-card-badges">
            <StatusBadge variant="neutral" className="status-badge--ended">已結束</StatusBadge>
          </div>
          <div className="reservation-result-card-event">{record.eventName}</div>
          <div className="reservation-result-card-meta">
            <span>{record.date}</span>
            <span>{record.startTime} – {record.endTime}</span>
            <span>預約編號：{bookingId}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reservation-result-card">
      <div className="reservation-result-card-main">
        <div className="reservation-result-card-badges" aria-label={t('page.reservationCardStatusAria')}>
          {isThisCanceling ? (
            <StatusBadge variant="warning">{t('page.reservationBadgeCanceling')}</StatusBadge>
          ) : canCancel ? (
            <StatusBadge variant="success">{t('page.reservationBadgeCancelable')}</StatusBadge>
          ) : timing === 'in_progress' ? (
            <StatusBadge variant="info">進行中</StatusBadge>
          ) : (
            <StatusBadge variant="warning">即將開始</StatusBadge>
          )}
        </div>
        <div className="reservation-result-card-event">{record.eventName}</div>
        <div className="reservation-result-card-meta">
          <span>預約編號：{bookingId}</span>
          <span>建立時間：{createdAtLabel}</span>
          <span>{record.date}</span>
          <span>{record.startTime} – {record.endTime}</span>
          <span>地點：{record.location || '地點待公告'}</span>
        </div>
        <div className="text-muted small mt-1">{statusHelper}</div>
        {isEnglishTableEventType(record.eventType) ? (
          <EnglishTablePracticeGuide variant="reservation" />
        ) : null}
        <EnglishTableTopicPanel
          date={record.date}
          eventType={record.eventType}
          defaultOpen={false}
          showPracticeLinks
          showReviewLinks
          practiceByQuestion={record.practiceByQuestion}
        />
      </div>
      <div className="reservation-result-card-actions">
        {canShowQr ? (
          <Button
            type="button"
            variant="outline-primary"
            size="sm"
            onClick={() => setQrOpen(true)}
          >
            出示簽到 QR
          </Button>
        ) : null}
        {canCancel ? (
          <div>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => onConfirmCancel(record.id)}
              disabled={cancelLoading && isThisCanceling}
            >
              {cancelLoading && isThisCanceling ? '處理中...' : t('page.reservationCancelBtn')}
            </button>
            {isThisCanceling && cancelError ? (
              <div className="alert alert-danger py-2 mt-2" role="alert">
                {cancelError}
              </div>
            ) : null}
          </div>
        ) : (
          <small className="text-muted">
            {t('page.reservationCancelDeadline')}: {twoHoursBefore.format('MM/DD HH:mm')}
          </small>
        )}
      </div>
      {canShowQr ? (
        <Modal
          show={qrOpen}
          onHide={() => setQrOpen(false)}
          centered
          contentClassName="reservation-checkin-qr-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>現場簽到 QR</Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center">
            <div className="fw-semibold">{record.eventName}</div>
            <div className="text-muted small mb-2">
              {record.date}　{record.startTime} – {record.endTime}
            </div>
            <div className="mb-2">
              簽到碼：<strong>{bookingId}</strong>
            </div>
            {qrOpen ? (
              <CheckinQrCanvas value={bookingId} size={260} className="reservation-checkin-qr" />
            ) : null}
            <div className="small text-muted mt-2">活動現場請出示此 QR 或簽到碼。請先確認上方場次與要參加的活動相同。</div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setQrOpen(false)}>
              關閉
            </Button>
          </Modal.Footer>
        </Modal>
      ) : null}
    </div>
  );
}
