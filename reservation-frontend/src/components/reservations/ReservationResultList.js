/**
 * 預約查詢結果列表：依學期分組，尚未結束的場次在前，已結束的場次可收合
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import ReservationResultCard from './ReservationResultCard';
import SkeletonCard from '../ui/SkeletonCard';
import EmptyState from '../ui/EmptyState';
import { buildReservationSemesterViews } from '../../utils/reservationRecordGroups';
import './ReservationResultList.css';

export default function ReservationResultList({
  records,
  cancelingReservationId,
  cancelLoading,
  cancelError,
  searchError,
  onConfirmCancel,
  hasSearched,
  loading,
  signedIn = false,
  onRetry,
}) {
  const { t } = useLanguage();
  const [semesterId, setSemesterId] = useState(null);
  const [endedPreference, setEndedPreference] = useState(null);
  const views = useMemo(() => buildReservationSemesterViews(records), [records]);
  const active = views.find((view) => view.id === semesterId)
    || views.find((view) => view.isCurrent)
    || views[0]
    || null;
  const endedOpen = active
    && endedPreference?.id === active.id
    ? endedPreference.open
    : Boolean(active && active.upcoming.length === 0 && active.ended.length > 0);

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
          icon="search"
          description={t('page.reservationSearchHint')}
        />
      </section>
    );
  }

  if (!records || records.length === 0) {
    const signedInEmpty = signedIn && !searchError;
    return (
      <section className="reservation-result-list reservation-result-list--empty" aria-live="polite">
        <EmptyState
          icon={searchError ? 'warning' : 'inbox'}
          title={searchError ? '無法取得預約紀錄' : (signedInEmpty ? '目前沒有預約' : t('page.reservationNoRecords'))}
          description={
            searchError ? (
              signedIn
                ? '暫時無法載入這個帳號的預約，請稍後再試。'
                : '請確認網路連線後再試一次，或核對學號、姓名與 Email 是否與報名時一致。'
            ) : signedInEmpty ? (
              '用這個帳號完成的預約會列在這裡。'
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
              {searchError && onRetry ? (
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={onRetry}
                >
                  再試一次
                </button>
              ) : null}
              {!signedIn ? (
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  重新查詢
                </button>
              ) : null}
              <Link className="btn btn-primary btn-sm" to="/events">
                查看本週場次
              </Link>
              {!searchError && !signedIn ? (
                <>
                  <a className="btn btn-outline-secondary btn-sm" href="/about#contact">
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

  if (!active) return null;

  const semesterLabel = active.isCurrent ? `${active.label}（本學期）` : active.label;

  return (
    <section className="reservation-result-list" aria-labelledby="reservation-result-title">
      <div className="reservation-result-list-header">
        <h2 id="reservation-result-title" className="reservation-result-list-title">
          {t('page.reservationResultTitle')}
        </h2>
        <p className="reservation-result-list-meta text-muted small mb-0">
          全部 {records.length} 筆。目前看 {semesterLabel}：{active.upcoming.length} 場尚未結束
          {active.ended.length ? `，${active.ended.length} 場已結束` : ''}。
        </p>
      </div>
      <div className="reservation-semester-tabs" role="tablist" aria-label="依學期查看預約">
        {views.map((view) => {
          const selected = view.id === active.id;
          return (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`reservation-semester-tab${selected ? ' is-active' : ''}`}
              onClick={() => setSemesterId(view.id)}
            >
              <span>{view.label}</span>
              {view.isCurrent ? <span className="reservation-semester-tab__current">本學期</span> : null}
              <span className="reservation-semester-tab__count">{view.records.length}</span>
            </button>
          );
        })}
      </div>
      {active.records.length === 0 ? (
        <EmptyState
          icon="inbox"
          title={`${active.label} 目前沒有預約`}
          description="這個學期還沒有預約。其他學期的紀錄可以從上方切換查看。"
        />
      ) : (
        <>
          {active.upcoming.length > 0 ? (
            <div className="reservation-result-list-cards">
              {active.upcoming.map((record) => (
                <ReservationResultCard
                  key={record.id}
                  record={record}
                  cancelingReservationId={cancelingReservationId}
                  cancelLoading={cancelLoading}
                  cancelError={cancelError}
                  onConfirmCancel={onConfirmCancel}
                />
              ))}
            </div>
          ) : null}
          {active.ended.length > 0 ? (
            <section className="reservation-ended-section" aria-label="已結束的預約">
              <button
                type="button"
                className="reservation-ended-toggle"
                aria-expanded={endedOpen}
                onClick={() => setEndedPreference({ id: active.id, open: !endedOpen })}
              >
                <span className="reservation-ended-toggle__label">已結束</span>
                <span className="reservation-ended-toggle__count">{active.ended.length} 場</span>
                <span className="reservation-ended-toggle__action">{endedOpen ? '收合' : '展開'}</span>
              </button>
              {endedOpen ? (
                <div className="reservation-result-list-cards reservation-result-list-cards--ended">
                  {active.ended.map((record) => (
                    <ReservationResultCard
                      key={record.id}
                      record={record}
                      cancelingReservationId={cancelingReservationId}
                      cancelLoading={cancelLoading}
                      cancelError={cancelError}
                      onConfirmCancel={onConfirmCancel}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
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
