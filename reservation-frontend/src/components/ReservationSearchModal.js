/**
 * 查詢預約紀錄 Modal：與 MyReservationsPage 共用 ReservationLookupSection、ReservationResultList 與 useReservationLookup
 * 保留既有 modal 行為與 API，僅改為使用拆出的元件與 hook
 */
import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import useReservationLookup from '../hooks/useReservationLookup';
import ReservationLookupSection from './reservations/ReservationLookupSection';
import ReservationResultList from './reservations/ReservationResultList';
import ToastMessage from './ui/ToastMessage';
import '../styles/public-ui.css';

function ReservationSearchModal({ show, onClose }) {
  const { t } = useLanguage();
  const [hasSearched, setHasSearched] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  const showToast = (message, variant = 'success') => {
    setToast({ show: true, message, variant });
  };

  const {
    form,
    records,
    loading,
    validationErrors,
    searchError,
    cancelingReservationId,
    cancellationCode,
    setCancellationCode,
    search,
    startCancel,
    cancelCancel,
    performCancel,
    cancelError,
    cancelLoading,
  } = useReservationLookup({ showToast });

  const handleSearch = async () => {
    const result = await search();
    if (result?.reason !== 'validation') {
      setHasSearched(true);
    }
  };

  if (!show) return null;

  return (
    <>
      <div className="modal fade show public-reservation-modal" style={{ display: 'block' }} role="dialog">
        <div className="modal-dialog modal-dialog-scrollable modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{t('page.reservationLookupTitle')}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label={t('page.reservationClose')} />
            </div>
            <div className="modal-body">
              <ReservationLookupSection
                studentId={form.studentId}
                studentName={form.studentName}
                studentEmail={form.studentEmail}
                onStudentIdChange={form.setStudentId}
                onStudentNameChange={form.setStudentName}
                onStudentEmailChange={form.setStudentEmail}
                onSearch={handleSearch}
                loading={loading}
                validationErrors={validationErrors}
                searchError={searchError}
                showHint={false}
              />
              <ReservationResultList
                records={records}
                hasSearched={hasSearched}
                cancelingReservationId={cancelingReservationId}
                cancelLoading={cancelLoading}
                cancelError={cancelError}
                searchError={searchError}
                cancellationCode={cancellationCode}
                onCancellationCodeChange={setCancellationCode}
                onStartCancel={startCancel}
                onCancelCancel={cancelCancel}
                onConfirmCancel={performCancel}
                loading={loading}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {t('page.reservationClose')}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />

      <ToastMessage
        show={toast.show}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </>
  );
}

export default ReservationSearchModal;
