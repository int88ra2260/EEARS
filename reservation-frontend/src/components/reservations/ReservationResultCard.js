/**
 * 單筆預約結果：活動名稱、日期時間、取消按鈕或驗證碼表單
 * 與 ReservationSearchModal 內取消流程一致（2 小時前可取消、驗證碼確認）
 */
import React from 'react';
import dayjs from 'dayjs';
import { useLanguage } from '../../context/LanguageContext';
import { canCancelReservation } from '../../hooks/useReservationLookup';
import { RESERVATION_CUTOFF_HOURS } from '../../constants/reservationRules';
import StatusBadge from '../ui/StatusBadge';
import { formatBookingCode } from '../../utils/bookingCode';
import './ReservationResultCard.css';

export default function ReservationResultCard({
  record,
  cancelingReservationId,
  cancelLoading = false,
  cancelError = '',
  cancellationCode,
  onCancellationCodeChange,
  onStartCancel,
  onCancelCancel,
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
  const statusHelper = isThisCanceling
    ? '請輸入 Email 中的驗證碼完成取消。'
    : canCancel
      ? '可取消：尚在取消期限內。'
      : '不可取消：已超過取消期限或活動即將開始/已開始。';

  const cancelCodeEmail = record.studentEmail || '你的 Email';

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
      </div>
      <div className="reservation-result-card-actions">
        {canCancel ? (
          isThisCanceling ? (
            <div className="reservation-result-card-cancel-form">
              <label className="form-label small">{t('page.reservationVerifyCode')}</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder={t('page.reservationVerifyPlaceholder')}
                value={cancellationCode}
                onChange={(e) => onCancellationCodeChange(e.target.value)}
                maxLength={6}
                disabled={cancelLoading}
              />
              <small className="text-muted d-block mt-1">{t('page.reservationVerifyHint')}</small>
              <small className="text-muted d-block mt-2">
                驗證碼來源：你的預約確認信（寄送至 <strong>{cancelCodeEmail}</strong>）。
                此驗證碼用於確認「取消預約」操作；請務必使用最新一封 Email 中的驗證碼。
              </small>
              {cancelError ? (
                <div className="alert alert-danger py-2 mt-3" role="alert">
                  {cancelError}
                </div>
              ) : null}
              <div className="mt-2 text-muted small">
                沒收到驗證碼？
                （重寄功能待後端支援）你可以先返回確認預約資訊，或前往 <a href="/contact">聯絡我們</a>，
                也可直接寄信至 <a href="mailto:emicenter@mail.nsysu.edu.tw">emicenter@mail.nsysu.edu.tw</a>。
              </div>
              <div className="mt-2 d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => onConfirmCancel(record.id)}
                  disabled={cancelLoading}
                >
                  {cancelLoading ? '處理中...' : t('page.reservationConfirmCancel')}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onCancelCancel}>
                  {t('page.reservationCancelBack')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => onStartCancel(record.id)}
            >
              {t('page.reservationCancelBtn')}
            </button>
          )
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
