/**
 * 活動預約 Modal：表單、提交、黑名單／問卷子流程
 * 由 EventDetail 對外暴露，EventList 僅依賴 EventDetail
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { animate, stagger } from 'motion';
import useEventBooking from '../../hooks/useEventBooking';
import EventBookingSummary from './EventBookingSummary';
import EventBookingFormSection from './EventBookingFormSection';
import BookingStepIndicator from './BookingStepIndicator';
import EnglishTableSurveyModal from '../EnglishTableSurveyModal';
import { useLanguage } from '../../context/LanguageContext';
import { formatMessage } from '../../utils/formatMessage';
import '../EventDetail.css';
import '../../styles/student-events.css';
import BookingSuccessView from './BookingSuccessView';
import { getEventBookingState } from '../../utils/eventBookingState';

const BOOKING_EASE = [0.16, 1, 0.3, 1];

export default function EventBookingModal({ show, event, onClose }) {
  const { t, lang } = useLanguage();
  const [isMobile, setIsMobile] = useState(false);
  // 1:填寫, 2:問卷, 3:成功
  const [bookingStep, setBookingStep] = useState(1);
  const [mobileSubStep, setMobileSubStep] = useState('session');
  const [successEmail, setSuccessEmail] = useState('');
  const bodyScopeRef = useRef(null);
  const blacklistScopeRef = useRef(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const booking = useEventBooking();
  const {
    form,
    message,
    isSubmitting,
    violationWarning,
    blacklist,
    survey,
    successMeta,
    handleReserve,
    handleSurveyClose,
    handleSurveyComplete,
    resetBookingModalState,
  } = booking;

  const waitlistInfo = useMemo(() => {
    const state = getEventBookingState(event);
    return {
      isFull: state.code === 'FULL',
    };
  }, [event]);

  const surveyMayBeRequired =
    event?.eventType === 'English Table' || event?.eventType === 'English Club';

  // Step 2：若內建問卷 modal 開啟，就高亮 Step 2
  useEffect(() => {
    if (!show) return;
    if (survey?.showSurvey) setBookingStep(2);
  }, [show, survey?.showSurvey]);

  // Step 3：處理「問卷完成後自動回填」的 success 承接
  useEffect(() => {
    if (!show || !event) return;

    try {
      const recoveredStr = sessionStorage.getItem('pendingReservationRecoveredSuccess');
      if (!recoveredStr) return;
      const recovered = JSON.parse(recoveredStr);

      if (recovered && String(recovered.eventId) === String(event.id)) {
        setSuccessEmail(recovered.studentEmail || '');
        setBookingStep(3);
        sessionStorage.removeItem('pendingReservationRecoveredSuccess');
      }
    } catch (_) {
      // ignore
    }
  }, [show, event]);

  const handleReserveClick = () => {
    // 成功後不直接關 modal，而是切到成功狀態（由使用者自行離開）
    handleReserve(
      event,
      () => {
        setSuccessEmail(form.studentEmail);
        setBookingStep(3);
      },
      {
        onSurveyRequired: () => {
          // 讓語意變得清楚：先標示 step2（問卷），再進行 redirect
          setBookingStep(2);
        },
      },
    );
  };

  const resetLocalFlowState = () => {
    setBookingStep(1);
    setMobileSubStep('session');
    setSuccessEmail('');
  };

  const handleCloseModal = () => {
    resetLocalFlowState();
    if (typeof resetBookingModalState === 'function') resetBookingModalState();
    if (typeof onClose === 'function') onClose();
  };

  const handleSurveyCloseClick = () => {
    // 不要把 booking modal 一起關掉；只關問卷子流程
    handleSurveyClose();
  };

  const handleSurveyCompleteClick = () => {
    handleSurveyComplete(event, () => {
      setSuccessEmail(form.studentEmail);
      setBookingStep(3);
    });
  };

  // 每次打開時先重置；若有 recovered success 會由上方 effect 再切到 Step3
  useEffect(() => {
    if (!show) return;
    setBookingStep(1);
    setMobileSubStep('session');
    setSuccessEmail('');
    if (typeof resetBookingModalState === 'function') resetBookingModalState();
  }, [show, resetBookingModalState]);

  const showBookingSummary =
    bookingStep !== 3
    && (!isMobile || bookingStep !== 1 || mobileSubStep === 'session' || bookingStep === 2);
  const showStep1Form = bookingStep === 1 && (!isMobile || mobileSubStep === 'form');
  const isMobileSessionPanel = isMobile && bookingStep === 1 && mobileSubStep === 'session';

  useEffect(() => {
    if (!show) {
      wasOpenRef.current = false;
      return undefined;
    }

    const root = bodyScopeRef.current;
    if (!root) return undefined;

    const isOpening = !wasOpenRef.current;
    wasOpenRef.current = true;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduceMotion ? 0 : 0.42;
    const staggerStep = reduceMotion ? 0 : 0.07;
    const controls = [];

    if (isOpening) {
      const intro = root.querySelector('[data-booking-intro]');
      const dots = root.querySelectorAll('[data-booking-step-dot]');
      const summary = root.querySelector('[data-booking-summary]');

      if (intro) {
        controls.push(
          animate(intro, { opacity: [0, 1], y: [-10, 0] }, { duration, ease: BOOKING_EASE }),
        );
      }
      if (dots.length) {
        controls.push(
          animate(
            dots,
            { opacity: [0, 1], scale: [0.85, 1] },
            { duration, delay: stagger(staggerStep), ease: BOOKING_EASE },
          ),
        );
      }
      if (summary) {
        controls.push(
          animate(
            summary,
            { opacity: [0, 1], y: [14, 0] },
            { duration, delay: reduceMotion ? 0 : 0.08, ease: BOOKING_EASE },
          ),
        );
      }
    }

    const activePanel = root.querySelector(`[data-booking-step="${bookingStep}"]`);
    if (activePanel) {
      controls.push(
        animate(activePanel, { opacity: [0, 1], y: [18, 0] }, { duration, ease: BOOKING_EASE }),
      );
    }

    const activeDot = root.querySelector(`[data-booking-step-dot="${bookingStep}"]`);
    if (activeDot && duration > 0) {
      controls.push(
        animate(activeDot, { scale: [0.82, 1] }, { duration: 0.34, ease: [0.34, 1.56, 0.64, 1] }),
      );
    }

    return () => {
      controls.forEach((c) => {
        try {
          c?.stop?.();
        } catch (_) {
          /* ignore */
        }
      });
    };
  }, [show, bookingStep]);

  useEffect(() => {
    if (!blacklist?.showBlacklistModal) return undefined;

    const root = blacklistScopeRef.current;
    if (!root) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduceMotion ? 0 : 0.38;
    const controls = [];

    const intro = root.querySelector('[data-blacklist-intro]');
    const details = root.querySelectorAll('[data-blacklist-detail]');

    if (intro) {
      controls.push(
        animate(intro, { opacity: [0, 1], y: [16, 0] }, { duration, ease: BOOKING_EASE }),
      );
    }
    if (details.length) {
      controls.push(
        animate(
          details,
          { opacity: [0, 1], y: [12, 0] },
          { duration, delay: stagger(reduceMotion ? 0 : 0.08), ease: BOOKING_EASE },
        ),
      );
    }

    return () => {
      controls.forEach((c) => {
        try {
          c?.stop?.();
        } catch (_) {
          /* ignore */
        }
      });
    };
  }, [blacklist?.showBlacklistModal]);

  if (!event) return null;
  const surveyKeyByEventType = event.eventType === 'English Club'
    ? 'english_club_feedback_114_1'
    : 'english_table_feedback_114_1';

  const footerStyle = isMobile
    ? {
        position: 'sticky',
        bottom: 0,
        backgroundColor: 'white',
        borderTop: '1px solid #dee2e6',
        padding: '15px',
        zIndex: 1050,
      }
    : {};
  const bodyStyle = isMobile ? { paddingBottom: '80px' } : {};
  const buttonStyle = isMobile ? { minHeight: '48px', fontSize: '16px' } : {};
  const buttonClass = isMobile ? 'flex-fill' : '';

  return (
    <>
      <Modal
        show={show}
        onHide={handleCloseModal}
        centered={!isMobile}
        fullscreen={isMobile ? 'sm-down' : false}
        scrollable={isMobile}
        className={`event-booking-modal${isMobileSessionPanel ? ' event-booking-modal--mobile-session' : ''}`}
        dialogClassName="event-booking-modal__dialog"
        style={isMobile ? { zIndex: 1055 } : {}}
      >
        <Modal.Header closeButton>
          <Modal.Title>{formatMessage(t('booking.modalTitle'), { name: event.name })}</Modal.Title>
        </Modal.Header>

        <Modal.Body ref={bodyScopeRef} style={bodyStyle}>
          <BookingStepIndicator step={bookingStep} />

          {showBookingSummary ? (
            <div data-booking-summary>
              <EventBookingSummary
                event={event}
                surveyRequired={surveyMayBeRequired}
              />
            </div>
          ) : null}

          {isMobileSessionPanel ? (
            <p className="event-booking-mobile-hint mb-0" role="status">
              {t('booking.mobileSessionStep')}
            </p>
          ) : null}

          {showStep1Form && (
            <div data-booking-step="1">
              {waitlistInfo.isFull && (
                <div className="alert alert-warning py-2 mb-3" role="alert">
                  {t('booking.fullNoWaitlist')}
                </div>
              )}

              <EventBookingFormSection
                studentId={form.studentId}
                studentName={form.studentName}
                studentEmail={form.studentEmail}
                onStudentIdChange={form.setStudentId}
                onStudentNameChange={form.setStudentName}
                onStudentEmailChange={form.setStudentEmail}
                violationWarning={violationWarning}
                msg={message.msg}
                variant={message.variant}
                isMobile={isMobile}
              />
            </div>
          )}

          {bookingStep === 2 && (
            <div data-booking-step="2">
              <EventBookingFormSection
                studentId={form.studentId}
                studentName={form.studentName}
                studentEmail={form.studentEmail}
                onStudentIdChange={form.setStudentId}
                onStudentNameChange={form.setStudentName}
                onStudentEmailChange={form.setStudentEmail}
                violationWarning={violationWarning}
                msg={message.msg || t('booking.surveyStepMsg')}
                variant={message.variant || 'info'}
                isMobile={isMobile}
                disabled
              />
              <div className="alert alert-info mt-3 mb-0" role="status">
                <i className="fas fa-info-circle me-2" aria-hidden />
                {t('booking.surveyStepInfo')}
              </div>
            </div>
          )}

          {bookingStep === 3 && (
            <div data-booking-step="3">
              <BookingSuccessView
                event={event}
                studentEmail={successMeta?.studentEmail || successEmail || form.studentEmail}
                reservationId={successMeta?.reservationId || null}
                bookingCode={successMeta?.bookingCode || null}
                successAt={successMeta?.createdAt || null}
                onClose={handleCloseModal}
              />
            </div>
          )}
        </Modal.Body>

        <Modal.Footer style={footerStyle}>
          {bookingStep === 1 && isMobileSessionPanel && (
            <div className="d-flex w-100 gap-2">
              <Button
                variant="secondary"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className={buttonClass}
                style={buttonStyle}
              >
                {t('booking.btnCancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => setMobileSubStep('form')}
                disabled={waitlistInfo.isFull}
                className={buttonClass}
                style={buttonStyle}
              >
                {t('booking.mobileContinue')}
              </Button>
            </div>
          )}

          {bookingStep === 1 && showStep1Form && (
            <div className={isMobile ? 'd-flex w-100 gap-2' : 'd-flex gap-2'}>
              <Button
                variant="secondary"
                onClick={isMobile ? () => setMobileSubStep('session') : handleCloseModal}
                disabled={isSubmitting}
                className={buttonClass}
                style={buttonStyle}
              >
                {isMobile ? t('booking.mobileBackSession') : t('booking.btnCancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleReserveClick}
                disabled={isSubmitting || waitlistInfo.isFull}
                className={buttonClass}
                style={buttonStyle}
              >
                {isSubmitting
                  ? t('booking.btnProcessing')
                  : t('booking.btnReserve')}
              </Button>
            </div>
          )}

          {bookingStep === 2 && (
            <div className={isMobile ? 'd-flex w-100 gap-2' : 'd-flex gap-2'}>
              <Button
                variant="secondary"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className={buttonClass}
                style={buttonStyle}
              >
                {t('booking.btnBack')}
              </Button>
              <Button variant="primary" disabled className={buttonClass} style={buttonStyle}>
                {t('booking.btnSurveyPending')}
              </Button>
            </div>
          )}

          {bookingStep === 3 && (
            <div className="d-flex w-100 justify-content-end">
              <Button variant="secondary" onClick={handleCloseModal} className={buttonClass} style={buttonStyle}>
                {t('booking.btnClose')}
              </Button>
            </div>
          )}
        </Modal.Footer>
      </Modal>

      <EnglishTableSurveyModal
        show={survey.showSurvey}
        onClose={handleSurveyCloseClick}
        onSurveyComplete={handleSurveyCompleteClick}
        surveyKey={surveyKeyByEventType}
        userInfo={{
          studentId: form.studentId || localStorage.getItem('lastStudentId') || '',
          studentName: form.studentName || localStorage.getItem('lastStudentName') || '',
          studentEmail: form.studentEmail || localStorage.getItem('lastStudentEmail') || '',
        }}
      />

      <Modal
        show={blacklist.showBlacklistModal}
        onHide={() => blacklist.setShowBlacklistModal(false)}
        centered
      >
        <Modal.Header closeButton className="bg-danger text-white">
          <Modal.Title>
            <i className="fas fa-ban me-2" aria-hidden />
            {t('booking.blacklistTitle')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body ref={blacklistScopeRef}>
          <div className="alert alert-danger" data-blacklist-intro>
            <h5 className="alert-heading">
              <i className="fas fa-exclamation-triangle me-2" aria-hidden />
              {t('booking.blacklistHeading')}
            </h5>
            <p className="mb-2">
              {formatMessage(t('booking.blacklistBody'), {
                count: blacklist.blacklistInfo?.violationCount || 0,
              })}
            </p>
            {blacklist.blacklistInfo?.blacklistUntil && (
              <p className="mb-0">
                <strong>{t('booking.blacklistUntil')}</strong>
                <br />
                {new Date(blacklist.blacklistInfo.blacklistUntil).toLocaleString(lang === 'en' ? 'en-US' : 'zh-TW', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
          <div className="mt-3" data-blacklist-detail>
            <h6>{t('booking.blacklistViolationsTitle')}</h6>
            <ul className="mb-0">
              <li>{t('booking.blacklistViolation1')}</li>
              <li>{t('booking.blacklistViolation2')}</li>
              <li>{t('booking.blacklistViolation3')}</li>
              <li>{t('booking.blacklistViolation4')}</li>
            </ul>
          </div>
          <div className="mt-3" data-blacklist-detail>
            <h6>{t('booking.blacklistRulesTitle')}</h6>
            <p className="text-muted mb-0">{t('booking.blacklistRulesBody')}</p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => blacklist.setShowBlacklistModal(false)}>
            {t('booking.blacklistAck')}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
