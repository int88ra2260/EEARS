import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Maven 式三步驟進度條（預約 modal 頂部）
 */
export default function BookingStepIndicator({
  step,
  waitlistSuccess = false,
}) {
  const { t } = useLanguage();

  const step1DotClass =
    step === 1 ? 'booking-step__dot--active' : step > 1 ? 'booking-step__dot--done' : 'booking-step__dot--pending';
  const step2DotClass =
    step === 2 ? 'booking-step__dot--survey' : step > 2 ? 'booking-step__dot--done' : 'booking-step__dot--pending';
  const step3DotClass = step === 3 ? 'booking-step__dot--done' : 'booking-step__dot--pending';

  const step3Label = waitlistSuccess ? t('booking.step3Waitlist') : t('booking.step3Reserve');

  return (
    <div className="booking-steps" aria-label={t('booking.stepAria')} data-booking-intro>
      <div className="booking-step">
        <div data-booking-step-dot="1" className={`booking-step__dot ${step1DotClass}`}>1</div>
        <span className={`booking-step__label ${step === 1 ? 'booking-step__label--active' : ''}`}>
          {t('booking.step1')}
        </span>
      </div>
      <div
        className={`booking-step__connector${step > 1 ? ' booking-step__connector--done' : ''}`}
        aria-hidden="true"
      />
      <div className="booking-step">
        <div data-booking-step-dot="2" className={`booking-step__dot ${step2DotClass}`}>2</div>
        <span className={`booking-step__label ${step === 2 ? 'booking-step__label--survey-active' : ''}`}>
          {t('booking.step2')}
        </span>
      </div>
      <div
        className={`booking-step__connector${step > 2 ? ' booking-step__connector--done' : ''}`}
        aria-hidden="true"
      />
      <div className="booking-step">
        <div data-booking-step-dot="3" className={`booking-step__dot ${step3DotClass}`}>3</div>
        <span className={`booking-step__label ${step === 3 ? 'booking-step__label--success-active' : ''}`}>
          {step3Label}
        </span>
      </div>
    </div>
  );
}
