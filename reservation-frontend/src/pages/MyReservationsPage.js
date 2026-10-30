/**
 * 我的預約：登入後依帳號學號載入，與 ReservationSearchModal 共用查詢與取消流程
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import StudentRecordShell from '../components/student/StudentRecordShell';
import ReservationResultList from '../components/reservations/ReservationResultList';
import useReservationLookup from '../hooks/useReservationLookup';
import ToastMessage from '../components/ui/ToastMessage';
import { loadReservationIdentity } from '../utils/studentIdentityStorage';
import '../styles/public-ui.css';

export default function MyReservationsPage() {
  const { t } = useLanguage();
  const [hasSearched, setHasSearched] = useState(() => Boolean(loadReservationIdentity()));
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });

  const showToast = (message, variant = 'success') => {
    setToast({ show: true, message, variant });
  };

  const {
    records,
    loading,
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

  const handleSearch = useCallback(async () => {
    const result = await search();
    if (result?.reason !== 'validation') {
      setHasSearched(true);
    }
  }, [search]);

  const didAutoSearch = useRef(false);
  useEffect(() => {
    if (didAutoSearch.current) return;
    if (!loadReservationIdentity()) return;
    didAutoSearch.current = true;
    handleSearch();
  }, [handleSearch]);

  return (
    <div className="my-reservations-page my-reservations-page--lookup public-reservation-page">
      <StudentRecordShell lead={t('page.myReservationsLead')} titleKey="nav.myReservations">

      <ReservationResultList
        signedIn
        onRetry={handleSearch}
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

      <ToastMessage
        show={toast.show}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
      </StudentRecordShell>
    </div>
  );
}
