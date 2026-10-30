import React, { useEffect, useRef } from 'react';
import useCampusSso from '../../hooks/useCampusSso';
import useMediaQuery from '../../hooks/useMediaQuery';
import { useLanguage } from '../../context/LanguageContext';
import ContentText from '../siteContent/ContentText';

export default function ReservationUsageModal({ show, onClose, embedded = false }) {
  const { t } = useLanguage();
  const campusSso = useCampusSso();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSmallMobile = useMediaQuery('(max-width: 576px)');
  const dialogRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!show || embedded) return undefined;
    const prevActive = document.activeElement;
    buttonRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (typeof prevActive?.focus === 'function') prevActive.focus();
    };
  }, [show, onClose, embedded]);

  if (!show) return null;

  return (
    <div
      className="modal-backdrop d-flex justify-content-center align-items-center"
      style={embedded ? {
        position: 'relative',
        width: '100%',
        minHeight: '32rem',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        zIndex: 1,
        padding: '1.5rem 1rem',
        borderRadius: '8px',
      } : {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        padding: isSmallMobile ? '0.5rem' : '1rem',
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="usage-modal-title"
        className="bg-white rounded-lg shadow-lg d-flex flex-column reservation-usage-modal"
        style={{
          zIndex: 10000,
          maxWidth: isSmallMobile ? '95%' : isMobile ? '90%' : '400px',
          width: '100%',
          maxHeight: '80vh',
          padding: isSmallMobile ? '1rem' : isMobile ? '1.125rem' : '1.25rem',
        }}
      >
        <h2
          id="usage-modal-title"
          className="text-center text-primary mb-3"
          style={{
            fontSize: isSmallMobile ? '1.1rem' : isMobile ? '1.2rem' : 'clamp(1.1rem, 4vw, 1.3rem)',
            fontWeight: 'bold',
            flexShrink: 0,
          }}
        >
          <ContentText k="home.usageTitle" />
        </h2>

        <div
          className="scrollable-content"
          style={{
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: '1 1 auto',
            minHeight: 0,
            marginBottom: '1rem',
            paddingRight: '0.5rem',
          }}
        >
          <div
            className="alert alert-info mb-3"
            role="status"
            style={{
              fontSize: isSmallMobile ? '0.813rem' : isMobile ? '0.875rem' : 'clamp(0.875rem, 3vw, 1rem)',
              padding: isSmallMobile ? '0.625rem' : '0.75rem',
            }}
          >
            <strong><ContentText k="home.usageLoginTitle" /></strong>
            <br />
            <ContentText
              k="home.usageLogin"
              style={{ fontSize: isSmallMobile ? '0.75rem' : isMobile ? '0.813rem' : 'clamp(0.813rem, 2.8vw, 0.938rem)' }}
            />
          </div>

          {campusSso ? (
            <div
              className="alert alert-info mb-3"
              role="status"
              style={{
                fontSize: isSmallMobile ? '0.813rem' : isMobile ? '0.875rem' : 'clamp(0.875rem, 3vw, 1rem)',
                padding: isSmallMobile ? '0.625rem' : '0.75rem',
              }}
            >
              <strong>{t('home.usageCampusTitle')}</strong>
              <br />
              <span style={{ fontSize: isSmallMobile ? '0.75rem' : isMobile ? '0.813rem' : 'clamp(0.813rem, 2.8vw, 0.938rem)' }}>
                {t('home.usageCampus')}
              </span>
            </div>
          ) : null}

          <div
            className="alert alert-info mb-3"
            role="alert"
            style={{
              fontSize: isSmallMobile ? '0.813rem' : isMobile ? '0.875rem' : 'clamp(0.875rem, 3vw, 1rem)',
              padding: isSmallMobile ? '0.625rem' : '0.75rem',
            }}
          >
            <i className="fas fa-info-circle me-2" />
            <strong>📋 <ContentText k="home.usageRule" /></strong>
            <br />
            <ContentText
              k="home.ruleNoStamp"
              style={{ fontSize: isSmallMobile ? '0.75rem' : isMobile ? '0.813rem' : 'clamp(0.813rem, 2.8vw, 0.938rem)' }}
            />
          </div>

          <ul className="list-unstyled" style={{ margin: 0 }}>
            <li
              className="mb-3"
              style={{ fontSize: isSmallMobile ? '0.75rem' : isMobile ? '0.813rem' : 'clamp(0.813rem, 2.8vw, 0.938rem)' }}
            >
              <span style={{ fontWeight: 'bold' }}>
                <ContentText k="home.usageBlacklist" />
                <br />
                <ContentText k="home.usageViolations" />
                <br />
                - <ContentText k="home.usageV1" />
                <br />
                - <ContentText k="home.usageV2" />
                <br />
                - <ContentText k="home.usageV3" />
              </span>
            </li>
            <li
              className="mb-3"
              style={{ fontSize: isSmallMobile ? '0.75rem' : isMobile ? '0.813rem' : 'clamp(0.813rem, 2.8vw, 0.938rem)' }}
            >
              <ContentText k="home.usageCancel" style={{ fontWeight: 'bold' }} />
            </li>
          </ul>
        </div>

        {embedded ? (
          <div
            className="btn btn-primary w-100"
            style={{
              fontWeight: 'bold',
              fontSize: isSmallMobile ? '0.875rem' : isMobile ? '0.938rem' : 'clamp(0.938rem, 3.5vw, 1.063rem)',
              padding: isSmallMobile ? '0.5rem' : '0.625rem',
              flexShrink: 0,
              borderRadius: '8px',
            }}
          >
            <ContentText k="home.usageButtonPrimary" />
          </div>
        ) : (
          <button
            ref={buttonRef}
            type="button"
            className="btn btn-primary w-100"
            onClick={onClose}
            style={{
              fontWeight: 'bold',
              fontSize: isSmallMobile ? '0.875rem' : isMobile ? '0.938rem' : 'clamp(0.938rem, 3.5vw, 1.063rem)',
              padding: isSmallMobile ? '0.5rem' : '0.625rem',
              flexShrink: 0,
              borderRadius: '8px',
            }}
          >
            <ContentText k="home.usageButtonPrimary" />
          </button>
        )}
      </div>
    </div>
  );
}
