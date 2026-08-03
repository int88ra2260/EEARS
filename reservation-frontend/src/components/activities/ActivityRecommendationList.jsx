import React from 'react';
import { Link } from 'react-router-dom';
import { getEventsCalendarPath } from '../../utils/eventTypeQuery';
import {
  getExternalRecommendationUrl,
  isExternalRecommendation,
  WRITING_WORKSHOP_KEY,
} from '../../utils/wordBridgeRecommendations';
import './ActivityRecommendationList.css';

const ACTIVITY_META = {
  'english-table': { tone: 'blue', titleKey: 'activities.englishTable', slug: 'english-table' },
  'english-club': { tone: 'green', titleKey: 'activities.englishClub', slug: 'english-club' },
  'international-forum': { tone: 'yellow', titleKey: 'activities.internationalForum', slug: 'international-forum' },
  'job-talk': { tone: 'red', titleKey: 'activities.jobTalk', slug: 'job-talk' },
  [WRITING_WORKSHOP_KEY]: { tone: 'purple', titleKey: 'activities.writingWorkshop', external: true },
};

/**
 * @param {{ activities: string[], t: (key: string) => string, compact?: boolean, reasonPrefix?: string }} props
 */
export default function ActivityRecommendationList({
  activities,
  t,
  compact = false,
  reasonPrefix = 'wordBridge.activityReason',
}) {
  if (!activities?.length) return null;

  return (
    <ul className={`activity-rec-list${compact ? ' activity-rec-list--compact' : ''}`}>
      {activities.map((activityKey) => {
        const meta = ACTIVITY_META[activityKey];
        if (!meta) return null;
        const external = isExternalRecommendation(activityKey);
        const externalUrl = getExternalRecommendationUrl(activityKey);
        const reasonKey = `${reasonPrefix}.${activityKey}`;
        const reason = t(reasonKey);
        const title = t(meta.titleKey);

        return (
          <li key={activityKey} className={`activity-rec-list__item activity-rec-list__item--${meta.tone}`}>
            <div className="activity-rec-list__main">
              <span className="activity-rec-list__tag">{t(`wordBridge.activityTag.${activityKey}`)}</span>
              <span className="activity-rec-list__title">{title}</span>
              {!compact && reason !== reasonKey ? (
                <p className="activity-rec-list__reason">{reason}</p>
              ) : null}
            </div>
            {external && externalUrl ? (
              <a
                href={externalUrl}
                className="activity-rec-list__link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('wordBridge.visitExternalSite')}
              </a>
            ) : (
              <Link to={getEventsCalendarPath(meta.slug)} className="activity-rec-list__link">
                {t('wordBridge.bookActivity')}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
