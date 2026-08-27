/**
 * 預約查詢表單區：學號、姓名、Email + 搜尋
 * 受控元件，由父層提供 value/onChange 或透過 hook 綁定
 */
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import './ReservationLookupSection.css';

function fieldClass(hasError) {
  return hasError ? 'form-control is-invalid' : 'form-control';
}

export default function ReservationLookupSection({
  studentId,
  studentName,
  studentEmail,
  onStudentIdChange,
  onStudentNameChange,
  onStudentEmailChange,
  onSearch,
  loading,
  validationErrors = {},
  searchError,
  searchButtonLabel,
  showHint,
}) {
  const { t } = useLanguage();

  return (
    <section className="reservation-lookup-section" aria-labelledby="reservation-lookup-title">
      <h2 id="reservation-lookup-title" className="reservation-lookup-title">
        {t('page.reservationLookupTitle')}
      </h2>
      {showHint !== false && (
        <p className="reservation-lookup-hint">{t('page.reservationSearchHint')}</p>
      )}
      <div className="reservation-lookup-fields">
        <div className="mb-3">
          <label htmlFor="reservation-student-id" className="form-label">
            {t('page.reservationStudentId')}
          </label>
          <input
            id="reservation-student-id"
            type="text"
            className={fieldClass(validationErrors.studentId)}
            value={studentId}
            onChange={(e) => onStudentIdChange(e.target.value)}
            disabled={loading}
            aria-invalid={validationErrors.studentId ? 'true' : undefined}
            aria-describedby={validationErrors.studentId ? 'reservation-student-id-error' : undefined}
            autoComplete="username"
          />
          {validationErrors.studentId ? (
            <div id="reservation-student-id-error" className="invalid-feedback d-block">
              {validationErrors.studentId}
            </div>
          ) : null}
        </div>
        <div className="mb-3">
          <label htmlFor="reservation-name" className="form-label">
            {t('page.reservationName')}
          </label>
          <input
            id="reservation-name"
            type="text"
            className={fieldClass(validationErrors.studentName)}
            value={studentName}
            onChange={(e) => onStudentNameChange(e.target.value)}
            disabled={loading}
            aria-invalid={validationErrors.studentName ? 'true' : undefined}
            aria-describedby={validationErrors.studentName ? 'reservation-name-error' : undefined}
            autoComplete="name"
          />
          {validationErrors.studentName ? (
            <div id="reservation-name-error" className="invalid-feedback d-block">
              {validationErrors.studentName}
            </div>
          ) : null}
        </div>
        <div className="mb-3">
          <label htmlFor="reservation-email" className="form-label">
            {t('page.reservationEmail')}
          </label>
          <input
            id="reservation-email"
            type="email"
            className={fieldClass(validationErrors.studentEmail)}
            value={studentEmail}
            onChange={(e) => onStudentEmailChange(e.target.value)}
            disabled={loading}
            aria-invalid={validationErrors.studentEmail ? 'true' : undefined}
            aria-describedby={validationErrors.studentEmail ? 'reservation-email-error' : undefined}
            autoComplete="email"
            inputMode="email"
          />
          {validationErrors.studentEmail ? (
            <div id="reservation-email-error" className="invalid-feedback d-block">
              {validationErrors.studentEmail}
            </div>
          ) : null}
        </div>
        {searchError ? (
          <div className="alert alert-danger" role="alert">
            {searchError}
          </div>
        ) : null}
        {searchError && !loading ? (
          <div className="mt-2 d-flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={onSearch}
            >
              重新嘗試
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="btn btn-primary reservation-lookup-submit"
          onClick={onSearch}
          disabled={loading}
        >
          {loading ? (t('home.loading') || '載入中...') : (searchButtonLabel || t('page.reservationSearch'))}
        </button>
      </div>
    </section>
  );
}
