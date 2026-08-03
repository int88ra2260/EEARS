import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../styles/registration-public.css';

export default function RegistrationPageLayout({
  englishTestStep,
  isCheckingRegistrationStatus,
  onClose,
  children,
}) {
  const navigate = useNavigate();
  const isNarrow = englishTestStep === 1;

  return (
    <div className="public-registration">
      <nav className="public-registration__nav" aria-label="報名頁導覽">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/')}>
          返回首頁
        </button>
      </nav>

      <div className={`public-registration__container ${isNarrow ? 'public-registration__container--narrow' : ''}`}>
        <div className="public-registration__card">
          <header className="d-flex justify-content-between align-items-start gap-2 mb-1">
            <div>
              <h1 className="public-registration__title">培力英檢報名</h1>
              <p className="public-registration__subtitle">
                國立中山大學 EMI Center · 請依步驟填寫資料並確認報名資訊
              </p>
            </div>
            <button type="button" className="btn-close" aria-label="關閉" onClick={onClose} />
          </header>

          <div className="public-registration__steps" aria-label="報名進度">
            {[0, 1, 2, 3].map((step) => (
              <div
                key={step}
                className={`public-registration__step-bar ${englishTestStep >= step ? 'is-done' : ''}`}
                aria-hidden
              />
            ))}
            <span className="public-registration__step-label">
              步驟 {englishTestStep + 1} / 4
            </span>
          </div>

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
