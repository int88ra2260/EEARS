/**
 * 我的預約查詢頁：專用查詢表單 + 結果列表，不再使用 EventList
 * 與 ReservationSearchModal 共用 reservationService / useReservationLookup / 查詢與取消流程
 */
import React, { useState, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/layout/PageHeader';
import ReservationLookupSection from '../components/reservations/ReservationLookupSection';
import ReservationResultList from '../components/reservations/ReservationResultList';
import useReservationLookup from '../hooks/useReservationLookup';
import ToastMessage from '../components/ui/ToastMessage';
import '../styles/public-ui.css';

export default function MyReservationsPage() {
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
    error,
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

  const handleSearch = useCallback(() => {
    search();
    setHasSearched(true);
  }, [search]);

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('page.myReservationsTitle') },
  ];

  return (
    <div className="my-reservations-page my-reservations-page--lookup public-reservation-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={t('page.myReservationsTitle')}
        lead={t('page.myReservationsLead')}
      />

      <div className="public-card">
      <ReservationLookupSection
        studentId={form.studentId}
        studentName={form.studentName}
        studentEmail={form.studentEmail}
        onStudentIdChange={form.setStudentId}
        onStudentNameChange={form.setStudentName}
        onStudentEmailChange={form.setStudentEmail}
        onSearch={handleSearch}
        loading={loading}
        error={error}
        showHint={true}
      />
      </div>

      <ReservationResultList
        records={records}
        hasSearched={hasSearched}
        cancelingReservationId={cancelingReservationId}
        cancelLoading={cancelLoading}
        cancelError={cancelError}
        error={error}
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
    </div>
  );
}
