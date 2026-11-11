/**
 * 單筆預約結果：活動名稱、日期時間、登入後取消
 */
import React from 'react';
import dayjs from 'dayjs';
import { useLanguage } from '../../context/LanguageContext';
import { canCancelReservation } from '../../hooks/useReservationLookup';
import { RESERVATION_CUTOFF_HOURS } from '../../constants/reservationRules';
import StatusBadge from '../ui/StatusBadge';
import { formatBookingCode } from '../../utils/bookingCode';
import EnglishTableTopicPanel from '../events/EnglishTableTopicPanel';
import './ReservationResultCard.css';

export default function ReservationResultCard({
  record,
  cancelingReservationId,
  cancelLoading = false,
  cancelError = '',
  onConfirmCancel,
}) {
  const { t } = useLanguage();
  const canCancel = canCancelReservation(record);
  const eventStart = dayjs(`${record.date}T${record.startTime}`);
  const twoHoursBefore = eventStart.subtract(RESERVATION_CUTOFF_HOURS, 'hour');
  const isThisCanceling = cancelingReservationId === record.id;
  const bookingId = formatBookingCode(record.bookingCode, record.reservationId || record.id);
  const createdAtRaw = record.createdAt || record.timestamp || null;
  const createdAtLabel = createdAtRaw ? dayjs(createdAtRaw).format('YYYY/MM/DD HH:mm') : '（未提供）';
  const statusHelper = canCancel
    ? '可取消：尚在取消期限內。登入後即可取消，不必輸入驗證碼。'
    : '不可取消：已超過取消期限或活動即將開始/已開始。';

  return (
    <div className="reservation-result-card">
      <div className="reservation-result-card-main">
        <div className="reservation-result-card-badges" aria-label={t('page.reservationCardStatusAria')}>
          {isThisCanceling ? (
            <StatusBadge variant="warning">{t('page.reservationBadgeCanceling')}</StatusBadge>
          ) : canCancel ? (
            <StatusBadge variant="success">{t('page.reservationBadgeCancelable')}</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">{t('page.reservationBadgeLocked')}</StatusBadge>
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
          <div>
            <button type="button" className="btn btn-secondary btn-sm" disabled>
              {t('page.reservationCannotCancel')}
            </button>
            <small className="text-muted d-block mt-1">
              {t('page.reservationCancelDeadline')}: {twoHoursBefore.format('MM/DD HH:mm')}
            </small>
          </div>
        )}
      </div>
    </div>
  );
}
