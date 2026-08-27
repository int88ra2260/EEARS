/**
 * 預約查詢結果列表：多筆 ReservationResultCard + 空狀態
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import ReservationResultCard from './ReservationResultCard';
import SkeletonCard from '../ui/SkeletonCard';
import EmptyState from '../ui/EmptyState';
import './ReservationResultList.css';

export default function ReservationResultList({
  records,
  cancelingReservationId,
  cancelLoading,
  cancelError,
  searchError,
  cancellationCode,
  onCancellationCodeChange,
  onStartCancel,
  onCancelCancel,
  onConfirmCancel,
  hasSearched,
  loading,
}) {
  const { t } = useLanguage();

  if (loading && hasSearched) {
    return (
      <section
        className="reservation-result-list reservation-result-list--loading"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="reservation-result-list-cards">
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonCard key={idx} lines={3} titleHeight={14} />
          ))}
        </div>
      </section>
    );
  }

  if (!hasSearched) {
    return (
      <section className="reservation-result-list reservation-result-list--empty" aria-live="polite">
        <EmptyState
          icon="🔎"
          description={t('page.reservationSearchHint')}
        />
      </section>
    );
  }

  if (!records || records.length === 0) {
    return (
      <section className="reservation-result-list reservation-result-list--empty" aria-live="polite">
        <EmptyState
          icon={searchError ? '⚠️' : '📭'}
          title={searchError ? '無法取得預約紀錄' : t('page.reservationNoRecords')}
          description={
            searchError ? (
              '請確認網路連線後再試一次，或核對學號、姓名與 Email 是否與報名時一致。'
            ) : (
              <div>
                <div className="mb-2">目前尚未找到符合的預約紀錄，你可以先核對以下資訊：</div>
                <ul className="text-start mb-0" style={{ paddingLeft: '1.25rem' }}>
                  <li>學號格式是否與報名時一致</li>
                  <li>姓名是否使用報名時填寫的版本</li>
                  <li>Email 是否為接收預約確認信的信箱</li>
                </ul>
                <div className="mt-3">若仍無法查到，歡迎聯絡我們協助確認。</div>
              </div>
            )
          }
          actions={
            <>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                重新查詢
              </button>
              <Link className="btn btn-primary btn-sm" to="/events">
                查看本週場次
              </Link>
              {!searchError ? (
                <>
                  <a className="btn btn-outline-secondary btn-sm" href="/contact">
                    聯絡我們
                  </a>
                  <a className="btn btn-outline-secondary btn-sm" href="mailto:emicenter@mail.nsysu.edu.tw">
                    直接寄信
                  </a>
                </>
              ) : null}
            </>
          }
        />
      </section>
    );
  }

  return (
    <section className="reservation-result-list" aria-labelledby="reservation-result-title">
      <h2 id="reservation-result-title" className="reservation-result-list-title">
        {t('page.reservationResultTitle')}
      </h2>
      <div className="reservation-result-list-cards">
        {records.map((record) => (
          <ReservationResultCard
            key={record.id}
            record={record}
            cancelingReservationId={cancelingReservationId}
            cancelLoading={cancelLoading}
            cancelError={cancelError}
            cancellationCode={cancellationCode}
            onCancellationCodeChange={onCancellationCodeChange}
            onStartCancel={onStartCancel}
            onCancelCancel={onCancelCancel}
            onConfirmCancel={onConfirmCancel}
          />
        ))}
      </div>
      <p className="reservation-result-list-next mt-3 mb-2">{t('page.reservationResultNextHint')}</p>
      <div className="d-flex flex-wrap gap-2">
        <Link className="btn btn-primary btn-sm" to="/events">
          {t('page.reservationResultBookAnother')}
        </Link>
        <Link className="btn btn-outline-secondary btn-sm" to="/student/progress">
          {t('page.reservationResultProgress')}
        </Link>
      </div>
    </section>
  );
}
