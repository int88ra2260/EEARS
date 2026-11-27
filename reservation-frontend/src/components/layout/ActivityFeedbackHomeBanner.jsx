import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { ACTIVITY_FEEDBACK_PATH } from '../../constants/activityFeedback';
import './WeeklyHomeBanner.css';

/**
 * 佔用原本手機首頁週報卡片的位置。完整問卷在下一頁。
 */
export default function ActivityFeedbackHomeBanner({ onDismiss }) {
  const { t } = useLanguage();

  return (
    <aside className="weekly-home-banner" aria-label={t('homeFeedback.aria')}>
      <div className="weekly-home-banner__card">
        <div className="weekly-home-banner__copy">
          <p className="weekly-home-banner__kicker">{t('homeFeedback.kicker')}</p>
          <p className="weekly-home-banner__title">{t('homeFeedback.title')}</p>
          <p className="weekly-home-banner__headline">{t('homeFeedback.headline')}</p>
        </div>
        <div className="weekly-home-banner__actions">
          <Link to={ACTIVITY_FEEDBACK_PATH} className="btn btn-primary btn-sm">
            {t('homeFeedback.start')}
          </Link>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onDismiss}>
            {t('homeFeedback.later')}
          </button>
        </div>
      </div>
    </aside>
  );
}
