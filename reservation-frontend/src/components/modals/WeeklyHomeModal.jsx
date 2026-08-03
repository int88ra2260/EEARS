import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import useMediaQuery from '../../hooks/useMediaQuery';
import { useLanguage } from '../../context/LanguageContext';
import { extractModalTeaser } from '../../constants/weeklyBlocks';
import { scrollToPageTop } from '../../utils/scrollToPageTop';
import './WeeklyHomeModal.css';

function formatMessage(t, key, vars = {}) {
  const tpl = t(key);
  if (typeof tpl !== 'string' || tpl === key) return vars.default || key;
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

function formatWeekRange(weekStart, weekEnd, lang) {
  if (!weekStart || !weekEnd) return '';
  try {
    const opts = { month: 'short', day: 'numeric' };
    const locale = lang === 'en' ? 'en-US' : 'zh-TW';
    const start = new Date(`${weekStart}T00:00:00`);
    const end = new Date(`${weekEnd}T00:00:00`);
    const fmt = (d) => d.toLocaleDateString(locale, opts);
    return `${fmt(start)} – ${fmt(end)}`;
  } catch {
    return `${weekStart} – ${weekEnd}`;
  }
}

export default function WeeklyHomeModal({ show, weekly, onClose }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSmallMobile = useMediaQuery('(max-width: 576px)');
  const { t, lang } = useLanguage();
  const dialogRef = useRef(null);
  const primaryRef = useRef(null);

  const hasBlocks = Array.isArray(weekly?.blocks) && weekly.blocks.length > 0;
  const heroBlock = hasBlocks ? weekly.blocks.find((b) => b.type === 'hero') : null;
  const heroProps = heroBlock?.props || {};

  const teaser = useMemo(() => {
    if (!weekly) return { headline: '', learningTip: '' };
    if (hasBlocks) return extractModalTeaser(weekly.blocks);
    return {
      headline: weekly.headline || '',
      learningTip: weekly.learningTip || '',
    };
  }, [weekly, hasBlocks]);

  const heroTitle = useMemo(() => {
    if (!weekly) return t('weekly.title');
    if (heroProps.title) return heroProps.title;
    return weekly.title || t('weekly.title');
  }, [weekly, heroProps.title, t]);

  const headline = hasBlocks
    ? (teaser.headline || heroProps.subtitle || t('weekly.defaultHeadline'))
    : (teaser.headline || weekly?.headline || t('weekly.defaultHeadline'));

  useLayoutEffect(() => {
    if (!show) return;
    const dialog = dialogRef.current;
    if (dialog) dialog.scrollTop = 0;
    scrollToPageTop();
  }, [show, weekly?.issueKey]);

  useEffect(() => {
    if (!show) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    dialog?.focus({ preventScroll: true });

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus({ preventScroll: true });
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [show, onClose]);

  if (!show || !weekly) return null;

  const weekRange = formatWeekRange(weekly.weekStart, weekly.weekEnd, lang);

  return (
    <div
      className="weekly-home-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-modal-title"
        className="weekly-home-modal"
        tabIndex={-1}
        style={{
          maxWidth: isSmallMobile ? '95%' : isMobile ? '92%' : '520px',
          padding: isSmallMobile ? '1rem' : '1.35rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {heroProps.imageUrl ? (
          <div className="weekly-home-modal__cover">
            <img src={heroProps.imageUrl} alt={heroProps.imageAlt || ''} loading="eager" />
          </div>
        ) : null}

        <p className="weekly-home-modal__kicker">
          {heroProps.kicker || t('weekly.kicker')}
        </p>
        <h2 id="weekly-modal-title" className="weekly-home-modal__title">
          {heroTitle}
        </h2>

        {weekRange ? (
          <p className="weekly-home-modal__meta">
            {formatMessage(t, 'weekly.issueLabel', { issue: weekly.issueKey })}
            {' · '}
            {weekRange}
          </p>
        ) : null}

        <p className="weekly-home-modal__headline">{headline}</p>

        {teaser.learningTip ? (
          <div className="weekly-home-modal__tip">
            <span className="weekly-home-modal__tip-label">{t('weekly.tipLabel')}</span>
            <p>{teaser.learningTip}</p>
          </div>
        ) : null}

        <div className="weekly-home-modal__actions">
          <Link
            ref={primaryRef}
            to={`/weekly/${weekly.slug || weekly.issueKey}`}
            className="btn btn-primary"
            onClick={onClose}
          >
            {t('weekly.readFull')}
          </Link>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            {t('weekly.later')}
          </button>
        </div>
      </div>
    </div>
  );
}
