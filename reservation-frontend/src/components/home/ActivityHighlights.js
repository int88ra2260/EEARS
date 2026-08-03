import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { HOME_ACTIVITIES } from '../../data/homeActivities';
import './home.css';

export default function ActivityHighlights() {
  const { t } = useLanguage();

  return (
    <section id="activities" className="home-section home-section--flat" aria-labelledby="activities-title">
      <div className="home-shell home-reveal">
        <header className="home-section__header">
          <p className="home-kicker home-kicker--section">{t('homePage.activitiesKicker')}</p>
          <h2 id="activities-title" className="home-section__title">
            {t('homePage.activitiesTitle')}
          </h2>
          <p className="home-section__lead">{t('homePage.activitiesLead')}</p>
        </header>

        <div className="home-activities-bento">
          {HOME_ACTIVITIES.map((activity, index) => (
            <article
              key={activity.id}
              className={`home-activity-tile${index === 0 ? ' home-activity-tile--span' : ''}`}
              style={{ '--index': index }}
            >
              <div className="home-activity-tile__top">
                <span className={`home-tag home-tag--${activity.tagTone}`}>{activity.tag}</span>
                <h3>{t(activity.titleKey)}</h3>
              </div>
              <p>{t(activity.introKey)}</p>
              <Link to={`/activities/${activity.slug}`} className="home-text-link">
                {activity.cta === 'reserve' ? t('homePage.activityReserve') : t('homePage.activityLearnMore')}
                <span aria-hidden="true"> →</span>
              </Link>
            </article>
          ))}
        </div>

        <div className="home-section__footer">
          <Link to="/activities" className="home-btn home-btn--ghost">
            {t('homePage.viewAllActivities')}
          </Link>
        </div>
      </div>
    </section>
  );
}
