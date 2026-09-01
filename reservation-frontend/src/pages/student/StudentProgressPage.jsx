/**
 * 我的英語進度：統一讀取 API（活動 / 修課 / 考試 / 護照）
 */
import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import ReservationLookupSection from '../../components/reservations/ReservationLookupSection';
import { fetchStudentProgress } from '../../services/studentProgressApi';
import { setVoluntaryStudentId } from '../../utils/learningStudentLink';
import { useLanguage } from '../../context/LanguageContext';
import { validateReservationFields } from '../../utils/validators';
import '../../styles/public-ui.css';
import './StudentProgressPage.css';

const ENGLISH_TEST_STATUS_LABELS = {
  pending: '審核中',
  approved: '已通過',
  revision: '請修正',
  success: '報名成功',
  failed: '報名失敗',
};

const BESTEP_EXAM_TYPE_LABELS = {
  L: '聽力 (L)',
  R: '閱讀 (R)',
  S: '口說 (S)',
  W: '寫作 (W)',
  LR: '聽讀 (LR)',
  SW: '說寫 (SW)',
};

function formatBestepExamType(examType) {
  return BESTEP_EXAM_TYPE_LABELS[examType] || examType || '—';
}

function formatEventWhen(record) {
  if (!record?.date) return '—';
  const time = record.startTime ? ` ${record.startTime}` : '';
  return `${record.date}${time}`;
}

function ActivityStatusBadge({ status, t }) {
  if (status === 'attended') {
    return <span className="student-progress-badge student-progress-badge--success">{t('page.studentProgressAttendedBadge')}</span>;
  }
  if (status === 'no_show') {
    return <span className="student-progress-badge student-progress-badge--danger">{t('page.studentProgressNoShowBadge')}</span>;
  }
  if (status === 'upcoming') {
    return <span className="student-progress-badge student-progress-badge--info">{t('page.studentProgressUpcomingBadge')}</span>;
  }
  return <span className="student-progress-badge student-progress-badge--muted">{t('page.studentProgressPendingBadge')}</span>;
}

function ActivityRecordList({ title, records, emptyText, t }) {
  if (!records?.length) {
    return (
      <div className="student-progress-activity-block">
        <h3 className="h6 mb-2">{title}</h3>
        <p className="text-muted small mb-0">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="student-progress-activity-block">
      <h3 className="h6 mb-2">{title}</h3>
      <ul className="student-progress-activity-list list-unstyled mb-0">
        {records.map((record) => (
          <li key={record.id} className="student-progress-activity-item">
            <div className="student-progress-activity-item__main">
              <div className="fw-semibold">{record.eventName || '（活動名稱待補）'}</div>
              <div className="text-muted small">{formatEventWhen(record)}</div>
            </div>
            <ActivityStatusBadge status={record.attendanceStatus} t={t} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function StudentProgressPage() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ studentId: '', studentName: '', studentEmail: '' });
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [searchError, setSearchError] = useState('');
  const [progress, setProgress] = useState(null);

  const handleSearch = useCallback(async () => {
    const trimmed = {
      studentId: form.studentId.trim(),
      studentName: form.studentName.trim(),
      studentEmail: form.studentEmail.trim(),
    };
    const validationResult = validateReservationFields(trimmed);
    setValidationErrors(validationResult.fieldErrors || {});
    if (!validationResult.isValid) return;

    setLoading(true);
    setSearchError('');
    setProgress(null);
    setHasSearched(true);
    setVoluntaryStudentId(trimmed.studentId);

    try {
      const result = await fetchStudentProgress(trimmed);
      if (!result.found || !result.data) {
        setProgress(null);
        setSearchError(t('page.studentProgressNotFound'));
        return;
      }
      setProgress(result.data);
    } catch (err) {
      setProgress(null);
      setSearchError(err.message || t('page.studentProgressLoadError'));
    } finally {
      setLoading(false);
    }
  }, [form.studentEmail, form.studentId, form.studentName, t]);

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('page.studentProgressTitle') },
  ];

  const activities = progress?.activities;
  const courses = progress?.courses?.items || [];
  const passport = progress?.passport;
  const englishTests = progress?.exams?.englishTestRegistrations || [];
  const bestepScores = progress?.exams?.bestep?.scores || [];
  const bestepAttendance = progress?.exams?.bestep?.attendance || [];
  const hasExamData = englishTests.length > 0 || bestepScores.length > 0 || bestepAttendance.length > 0;

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
          onStudentIdChange={(v) => setForm((prev) => ({ ...prev, studentId: v }))}
          onStudentNameChange={(v) => setForm((prev) => ({ ...prev, studentName: v }))}
          onStudentEmailChange={(v) => setForm((prev) => ({ ...prev, studentEmail: v }))}
          onSearch={handleSearch}
          loading={loading}
          validationErrors={validationErrors}
          searchError={searchError}
          searchButtonLabel={t('page.reservationSearch')}
          showHint
        />
      </div>

      {hasSearched && !loading && progress ? (
        <>
          <div className="student-progress-grid">
            <section className="student-progress-card public-card student-progress-card--wide">
              <h2 className="h5">{t('page.studentProgressReservations')}</h2>
              {activities?.summary ? (
                <ul className="attendance-summary">
                  <li>{t('page.studentProgressAttended')}{activities.summary.attended}</li>
                  <li>{t('page.studentProgressNoShow')}{activities.summary.noShow}</li>
                  <li>{t('page.studentProgressUpcoming')}{activities.summary.upcoming}</li>
                  <li>{t('page.studentProgressTotal')}{activities.summary.total}</li>
                </ul>
              ) : null}

              <div className="student-progress-activity-grid mt-3">
                <ActivityRecordList
                  title={t('page.studentProgressNextUpcoming')}
                  records={activities?.nextUpcoming ? [activities.nextUpcoming] : []}
                  emptyText={t('page.studentProgressNoUpcoming')}
                  t={t}
                />
                <ActivityRecordList
                  title={t('page.studentProgressRecentActivities')}
                  records={activities?.recent || []}
                  emptyText={t('page.studentProgressNoRecent')}
                  t={t}
                />
              </div>

              <div className="d-flex flex-wrap gap-2 mt-3">
                <Link to="/my-reservations" className="btn btn-primary btn-sm">
                  {t('nav.myReservations')}
                </Link>
                <Link to="/events" className="btn btn-outline-primary btn-sm">
                  {t('nav.eventsBooking')}
                </Link>
              </div>
            </section>

            {passport?.hasRecord ? (
              <section className="student-progress-card public-card">
                <h2 className="h5">{t('page.studentProgressElpPoints')}</h2>
                <p className="student-progress-card__stat">
                  {passport.totalApprovedPoints} / {passport.threshold ?? 100}
                </p>
                <div className="progress-bar-wrapper mt-2">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(passport.totalApprovedPoints) || 0))}%`,
                    }}
                    role="progressbar"
                    aria-valuenow={passport.totalApprovedPoints}
                    aria-valuemin={0}
                    aria-valuemax={passport.threshold ?? 100}
                  />
                </div>
                <Link to="/student/english-learning-passport" className="btn btn-outline-primary btn-sm mt-3">
                  {t('page.studentProgressElpApply')}
                </Link>
              </section>
            ) : null}
          </div>

          {courses.length > 0 ? (
            <section className="student-progress-card public-card student-progress-card--wide mt-3">
              <h2 className="h5">{t('page.studentProgressCourses')}</h2>
              <ul className="student-progress-meta-list list-unstyled mb-2">
                {courses.map((row) => (
                  <li key={`${row.semester}-${row.className}`} className="student-progress-meta-list__item">
                    <span className="fw-semibold">{row.semester}</span>
                    <span>{row.className || '—'}</span>
                    {row.department ? <span className="text-muted small">{row.department}</span> : null}
                  </li>
                ))}
              </ul>
              <p className="text-muted small mb-0">{progress.courses.disclaimer}</p>
            </section>
          ) : null}

          {hasExamData ? (
            <section className="student-progress-card public-card student-progress-card--wide mt-3">
              <h2 className="h5">{t('page.studentProgressExams')}</h2>

              {englishTests.length > 0 ? (
                <div className="mb-3">
                  <h3 className="h6">{t('page.studentProgressEnglishTestRegs')}</h3>
                  <ul className="student-progress-meta-list list-unstyled mb-0">
                    {englishTests.map((row) => (
                      <li key={row.id} className="student-progress-meta-list__item">
                        <span className="fw-semibold">{row.semester || '—'}</span>
                        <span>{ENGLISH_TEST_STATUS_LABELS[row.status] || row.status}</span>
                        {row.examType ? <span className="text-muted small">{row.examType}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {bestepScores.length > 0 ? (
                <div className="mb-3">
                  <h3 className="h6">{t('page.studentProgressBestepScores')}</h3>
                  <ul className="student-progress-meta-list list-unstyled mb-0">
                    {bestepScores.map((row) => (
                      <li key={`${row.semester}-${row.examDate}`} className="student-progress-meta-list__item">
                        <span className="fw-semibold">{row.semester}</span>
                        <span>{row.overallLevel || '—'}</span>
                        {row.totalScore != null ? (
                          <span className="text-muted small">{t('page.studentProgressTotalScore')} {row.totalScore}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {bestepAttendance.length > 0 ? (
                <div className="mb-2">
                  <h3 className="h6">{t('page.studentProgressBestepAttendance')}</h3>
                  <ul className="student-progress-meta-list list-unstyled mb-0">
                    {bestepAttendance.map((row) => (
                      <li key={`${row.semester}-${row.examType}-${row.examDate}`} className="student-progress-meta-list__item">
                        <span className="fw-semibold">{row.semester}</span>
                        <span>{formatBestepExamType(row.examType)}</span>
                        <span className="text-muted small">
                          {row.attended ? t('page.studentProgressBestepAttended') : t('page.studentProgressBestepAbsent')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="text-muted small mb-0">{progress.exams.disclaimer}</p>
            </section>
          ) : null}

          <section className="student-progress-card public-card student-progress-card--wide mt-3">
            <h2 className="h6 mb-2">{t('page.studentProgressCertPath')}</h2>
            <p className="text-muted small mb-2">{t('page.studentProgressCertHint')}</p>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Link to="/course-guide" className="btn btn-outline-secondary btn-sm">
                {t('page.studentProgressCertCta')}
              </Link>
              {!passport?.hasRecord ? (
                <Link to="/student/english-learning-passport" className="btn btn-link btn-sm px-0">
                  {t('page.studentProgressElpOptionalLink')}
                </Link>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
