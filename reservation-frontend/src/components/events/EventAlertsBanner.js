/**
 * 頁頂條件式通知：僅在後台啟用問卷時顯示「需先填問卷」跑馬燈
 * 供 EventList 使用；實際文案與連結由 SURVEY_ALERT_CONFIG 驅動
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SURVEY_ALERT_CONFIG } from '../../constants/eventsContentConfig';
import AppIcon from '../ui/AppIcon';

export default function EventAlertsBanner({ enabledSurveys = [], t }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !Array.isArray(enabledSurveys) || enabledSurveys.length === 0) return null;

  return (
    <div className="alert alert-warning alert-dismissible fade show mb-3" role="alert">
      <div className="d-flex align-items-center">
        <span className="me-3 d-inline-flex" aria-hidden>
          <AppIcon name="megaphone" size="md" />
        </span>
        <div className="flex-grow-1">
          <strong>{t(SURVEY_ALERT_CONFIG.titleKey)}</strong>
          <span className="ms-2">
            {t(SURVEY_ALERT_CONFIG.prefixKey)}
            <Link to={SURVEY_ALERT_CONFIG.linkTo} className="alert-link fw-bold">
              {t(SURVEY_ALERT_CONFIG.linkKey)}
            </Link>
            {t(SURVEY_ALERT_CONFIG.suffixKey)}
          </span>
        </div>
        <button
          type="button"
          className="btn-close"
          aria-label="Close"
          onClick={() => setDismissed(true)}
        />
      </div>
    </div>
  );
}
