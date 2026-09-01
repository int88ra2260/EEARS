/**
 * 預約查詢結果列表：多筆 ReservationResultCard + 空狀態 + 分頁
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import ReservationResultCard from './ReservationResultCard';
import SkeletonCard from '../ui/SkeletonCard';
import EmptyState from '../ui/EmptyState';
import './ReservationResultList.css';

const PAGE_SIZE = 6;

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
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil((records?.length || 0) / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [records]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageRecords = useMemo(() => {
    if (!records?.length) return [];
    const start = (page - 1) * PAGE_SIZE;
    return records.slice(start, start + PAGE_SIZE);
  }, [records, page]);

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

  const rangeStart = (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, records.length);

  return (
    <section className="reservation-result-list" aria-labelledby="reservation-result-title">
      <div className="reservation-result-list-header">
        <h2 id="reservation-result-title" className="reservation-result-list-title">
          {t('page.reservationResultTitle')}
        </h2>
        <p className="reservation-result-list-meta text-muted small mb-0">
          共 {records.length} 筆，依活動時間由新到舊排列
          {records.length > PAGE_SIZE ? ` · 第 ${rangeStart}–${rangeEnd} 筆` : ''}
        </p>
      </div>
      <div className="reservation-result-list-cards">
        {pageRecords.map((record) => (
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
      {totalPages > 1 ? (
        <nav className="reservation-result-list-pagination mt-3" aria-label="查詢結果分頁">
          <ul className="pagination pagination-sm mb-0 justify-content-center">
            <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="上一頁"
              >
                上一頁
              </button>
            </li>
            <li className="page-item active" aria-current="page">
              <span className="page-link">
                {page} / {totalPages}
              </span>
            </li>
            <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="下一頁"
              >
                下一頁
              </button>
            </li>
          </ul>
        </nav>
      ) : null}
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
