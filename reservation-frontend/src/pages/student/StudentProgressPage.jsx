/**
 * 我的英語進度 — 學號驗證後彙總預約與護照點數（P1）
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import ReservationLookupSection from '../../components/reservations/ReservationLookupSection';
import useReservationLookup from '../../hooks/useReservationLookup';
import { fetchElpDashboard } from '../../services/englishLearningPassportApi';
import { useLanguage } from '../../context/LanguageContext';
import { formatMessage } from '../../utils/formatMessage';
import '../../styles/public-ui.css';
import './StudentProgressPage.css';

export default function StudentProgressPage() {
  const { t } = useLanguage();
  const [hasSearched, setHasSearched] = useState(false);
  const [elpLoading, setElpLoading] = useState(false);
  const [elpPoints, setElpPoints] = useState(null);
  const [elpError, setElpError] = useState('');

  const {
    form,
    records,
    loading,
    validationErrors,
    searchError,
    search,
  } = useReservationLookup();

  const handleSearch = useCallback(async () => {
    const result = await search();
    if (result?.reason === 'validation') return;

    setHasSearched(true);
    setElpPoints(null);
    setElpError('');

    const identity = {
      studentId: form.studentId.trim(),
      studentName: form.studentName.trim(),
      studentEmail: form.studentEmail.trim(),
    };

    setElpLoading(true);
    try {
      const data = await fetchElpDashboard(identity);
      setElpPoints(data?.passport?.totalApprovedPoints ?? 0);
    } catch (e) {
      if (e.message?.includes('身分') || e.message?.includes('找不到')) {
        setElpPoints(null);
        setElpError('');
      } else {
        setElpError(e.message || '護照資料載入失敗');
      }
    } finally {
      setElpLoading(false);
    }
  }, [search, form.studentId, form.studentName, form.studentEmail]);

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('page.studentProgressTitle') },
  ];

  return (
    <div className="student-progress-page public-reservation-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={t('page.studentProgressTitle')}
        lead={t('page.studentProgressLead')}
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
          loading={loading || elpLoading}
          validationErrors={validationErrors}
          searchError={searchError}
          searchButtonLabel={t('page.reservationSearch')}
          showHint
        />
      </div>

      {hasSearched && !loading && !elpLoading && !searchError ? (
        <div className="student-progress-grid">
          <section className="student-progress-card public-card">
            <h2 className="h5">{t('page.studentProgressReservations')}</h2>
            {records.length > 0 ? (
              <>
                <p className="student-progress-card__stat">
                  {formatMessage(t('page.studentProgressReservationsCount'), { count: records.length })}
                </p>
                <AttendanceSummary records={records} t={t} />
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <Link to="/my-reservations" className="btn btn-primary btn-sm">
                    {t('nav.myReservations')}
                  </Link>
                  <Link to="/events" className="btn btn-outline-primary btn-sm">
                    {t('nav.eventsBooking')}
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted mb-0">{t('page.studentProgressReservationsEmpty')}</p>
                <Link to="/events" className="btn btn-primary btn-sm mt-3">
                  {t('nav.eventsBooking')}
                </Link>
              </>
            )}
          </section>

          <section className="student-progress-card public-card">
            <h2 className="h5">{t('page.studentProgressElpPoints')}</h2>
            {elpError ? (
              <p className="text-danger mb-0">{elpError}</p>
            ) : elpPoints === null ? (
              <>
                <p className="text-muted mb-0">{t('page.studentProgressElpEmpty')}</p>
                <Link to="/student/english-learning-passport" className="btn btn-outline-primary btn-sm mt-3">
                  {t('page.studentProgressElpApply')}
                </Link>
              </>
            ) : (
              <>
                <p className="student-progress-card__stat">{elpPoints} / 100</p>
                <div className="progress-bar-wrapper mt-2">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(100, elpPoints)}%` }}
                    role="progressbar"
                    aria-valuenow={elpPoints}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <Link to="/student/english-learning-passport" className="btn btn-outline-primary btn-sm mt-3">
                  {t('page.studentProgressElpApply')}
                </Link>
              </>
            )}
          </section>

          <section className="student-progress-card public-card student-progress-card--wide">
            <h2 className="h5">{t('page.studentProgressCertPath')}</h2>
            <CertPathProgress elpPoints={elpPoints} t={t} />
            <Link to="/course-guide" className="btn btn-outline-secondary btn-sm mt-3">
              {t('page.studentProgressCertCta')}
            </Link>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function AttendanceSummary({ records, t }) {
  const stats = useMemo(() => {
    let attended = 0;
    let noShow = 0;
    let upcoming = 0;
    const now = Date.now();
    for (const r of records) {
      if (r.attendanceStatus === 'attended' || r.attendanceStatus === 'present') attended++;
      else if (r.attendanceStatus === 'no_show' || r.attendanceStatus === 'absent') noShow++;
      else if (r.eventStartTime && new Date(r.eventStartTime).getTime() > now) upcoming++;
    }
    return { attended, noShow, upcoming };
  }, [records]);

  return (
    <ul className="attendance-summary">
      <li>{t('page.studentProgressAttended')}{stats.attended}</li>
      {stats.noShow > 0 && <li className="text-danger">{t('page.studentProgressNoShow')}{stats.noShow}</li>}
      {stats.upcoming > 0 && <li>{t('page.studentProgressUpcoming')}{stats.upcoming}</li>}
    </ul>
  );
}

const CERT_STEPS = [
  { key: 'course', labelKey: 'page.studentProgressCertStepCourse' },
  { key: 'test', labelKey: 'page.studentProgressCertStepTest' },
  { key: 'passport', labelKey: 'page.studentProgressCertStepPassport' },
];

function CertPathProgress({ elpPoints, t }) {
  const passportDone = typeof elpPoints === 'number' && elpPoints >= 100;

  return (
    <div className="cert-path">
      {CERT_STEPS.map((step) => {
        const done = step.key === 'passport' && passportDone;
        return (
          <div key={step.key} className={`cert-path__step${done ? ' cert-path__step--done' : ''}`}>
            <span className="cert-path__dot" />
            <span className="cert-path__label">{t(step.labelKey)}</span>
          </div>
        );
      })}
    </div>
  );
}
