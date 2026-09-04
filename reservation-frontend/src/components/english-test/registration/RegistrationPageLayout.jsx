import React from 'react';
import {
  ENGLISH_TEST_REGISTRATION_STEP_LABELS,
  ENGLISH_TEST_REGISTRATION_TOTAL_STEPS,
} from '../../../constants/englishTestRegistrationSteps';
import '../../../styles/registration-public.css';

export default function RegistrationPageLayout({
  englishTestStep,
  maxReachedStep = 0,
  isCheckingRegistrationStatus,
  onClose,
  onStepSelect,
  children,
}) {
  const isNarrow = englishTestStep === 2;
  const currentStepLabel = ENGLISH_TEST_REGISTRATION_STEP_LABELS[englishTestStep] || '';
  const totalSteps = ENGLISH_TEST_REGISTRATION_TOTAL_STEPS;

  const handleHomeClick = () => {
    void onClose();
  };

  const handleCloseClick = () => {
    void onClose();
  };

  return (
    <div className="public-registration">
      <nav className="public-registration__nav" aria-label="報名頁導覽">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleHomeClick}>
          返回首頁
        </button>
      </nav>

      <div className={`public-registration__container ${isNarrow ? 'public-registration__container--narrow' : ''}`}>
        <div className="public-registration__card">
          <header className="d-flex justify-content-between align-items-start gap-2 mb-1">
            <div>
              <h1 className="public-registration__title">培力英檢報名</h1>
              <p className="public-registration__subtitle">
                國立中山大學 EMI Center · 完整報名共 5 步，預估 10–15 分鐘
              </p>
              <p className="public-registration__subtitle-hint">
                若只需修改已報名資料，請至「身分驗證」步驟使用「檢視與修正」，無需重填整份表單。
              </p>
            </div>
            <button type="button" className="btn-close" aria-label="關閉" onClick={handleCloseClick} />
          </header>

          <nav
            className="public-registration__steps"
            aria-label={`報名進度：步驟 ${englishTestStep + 1} / ${totalSteps}${currentStepLabel ? `，${currentStepLabel}` : ''}`}
          >
            <ol className="public-registration__stepper">
              {ENGLISH_TEST_REGISTRATION_STEP_LABELS.map((label, step) => {
                const isCompleted = englishTestStep > step;
                const isCurrent = englishTestStep === step;
                const isReachable = step <= maxReachedStep;
                const className = [
                  'public-registration__step',
                  isCompleted ? 'is-completed' : '',
                  isCurrent ? 'is-current' : '',
                  isReachable ? 'is-clickable' : 'is-locked',
                ].filter(Boolean).join(' ');

                return (
                  <li key={label} className={className}>
                    <button
                      type="button"
                      className="public-registration__step-btn"
                      title={isReachable ? `前往：${label}` : `尚未開放：${label}`}
                      aria-label={`${label}（步驟 ${step + 1}${isCurrent ? '，目前步驟' : isCompleted ? '，已完成' : ''}）`}
                      aria-current={isCurrent ? 'step' : undefined}
                      aria-disabled={!isReachable}
                      disabled={!isReachable || !onStepSelect}
                      onClick={() => {
                        if (!isReachable || !onStepSelect) return;
                        onStepSelect(step);
                      }}
                    >
                      <span className="public-registration__step-index" aria-hidden="true">
                        {isCompleted ? '✓' : step + 1}
                      </span>
                      <span className="public-registration__step-name">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="public-registration__step-status" aria-hidden="true">
              目前：步驟 {englishTestStep + 1} / {totalSteps}
              {currentStepLabel ? ` · ${currentStepLabel}` : ''}
              {maxReachedStep > englishTestStep ? '（可點選已開放步驟跳轉）' : ''}
            </p>
          </nav>

          {isCheckingRegistrationStatus ? (
            <div className="text-center py-5" role="status" aria-live="polite">
              <div className="spinner-border text-primary mb-3" />
              <p className="text-muted mb-0">正在檢查報名狀態…</p>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
