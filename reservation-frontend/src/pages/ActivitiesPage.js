import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import ContentText from '../components/siteContent/ContentText';
import PageHeader from '../components/layout/PageHeader';
import { getEventsCalendarPath } from '../utils/eventTypeQuery';
import ActivityFlowSteps from '../components/activities/ActivityFlowSteps';
import useSessionShuffled from '../hooks/useSessionShuffled';
import {
  BOOKABLE_ACTIVITY_CARDS,
  CATALOG_DISPLAY_CARDS,
} from '../constants/activityCatalog';
import { MINI_GAMES_CATALOG } from '../constants/miniGamesCatalog';
import { LEARNING_GUIDES_CATALOG } from '../constants/learningGuidesCatalog';
import './ActivitiesPage.css';
import '../components/guides/ActivityPhrasebook.css';

function ActivityCardActions({ card, t }) {
  if (card.kind === 'external') {
    return (
      <div className="activity-card-actions">
        <a
          href={card.externalUrl}
          className="btn btn-primary activity-card-cta"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ContentText k="activitiesPage.visitExternalSite" />
        </a>
      </div>
    );
  }

  return (
    <div className="activity-card-actions">
      <Link to={getEventsCalendarPath(card.slug)} className="btn btn-primary activity-card-cta">
        <ContentText k="homePage.activityReserve" />
      </Link>
      <Link to={`/activities/${card.slug}`} className="btn btn-outline-secondary activity-card-cta">
        <ContentText k="homePage.activityLearnMore" />
      </Link>
    </div>
  );
}

export default function ActivitiesPage() {
  const { t } = useLanguage();
  const shuffledCatalogCards = useSessionShuffled(CATALOG_DISPLAY_CARDS, 'activities-catalog');

  const breadcrumbs = useMemo(() => [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.activities') },
  ], [t]);

  return (
    <div className="activities-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={<ContentText k="activitiesPage.title" />}
        lead={<ContentText k="page.activitiesLead" />}
      />

      <ActivityFlowSteps />

      <section className="activities-catalog" aria-labelledby="activities-catalog-title">
        <div className="activities-section-heading">
          <ContentText k="activitiesPage.catalogKicker" as="p" className="activities-eyebrow" />
          <ContentText k="activitiesPage.catalogTitle" as="h2" id="activities-catalog-title" />
          <ContentText k="activitiesPage.catalogLead" as="p" />
        </div>

        <div className="activities-page-grid">
          {shuffledCatalogCards.map((card) => (
            <article key={card.slug} className="activity-card">
              <div className={`activity-card-visual activity-card-visual--${card.tone}`}>
                <img
                  src={card.image}
                  alt={t(card.titleKey)}
                  className="activity-card-visual__photo"
                  loading="lazy"
                />
                <div className="activity-card-visual__scrim" aria-hidden="true" />
                <span className="activity-card-tag">{card.tag}</span>
                <div className="activity-card-visual__track">
                  {card.visualKeys.map((key, index) => (
                    <span key={key} style={{ '--index': index }}>
                      <ContentText k={key} />
                    </span>
                  ))}
                </div>
              </div>
              <div className="activity-card-body">
                <ContentText k={card.titleKey} as="h3" className="activity-card-title" />
                <ContentText k={card.introKey} as="p" className="activity-card-desc" />
                <dl className="activity-card-facts">
                  <div>
                    <dt><ContentText k="activitiesPage.fitLabel" /></dt>
                    <dd><ContentText k={card.fitKey} /></dd>
                  </div>
                  <div>
                    <dt><ContentText k="activitiesPage.formatLabel" /></dt>
                    <dd><ContentText k={card.formatKey} /></dd>
                  </div>
                  <div>
                    <dt><ContentText k="activitiesPage.durationLabel" /></dt>
                    <dd><ContentText k={card.durationKey} /></dd>
                  </div>
                </dl>
                <ActivityCardActions card={card} t={t} />
              </div>
            </article>
          ))}
        </div>

        <div className="activities-schedule" aria-labelledby="activities-schedule-title">
          <div className="activities-section-heading activities-section-heading--compact">
            <ContentText k="activitiesPage.scheduleKicker" as="p" className="activities-eyebrow" />
            <ContentText k="activitiesPage.scheduleTitle" as="h3" id="activities-schedule-title" />
            <ContentText k="activitiesPage.scheduleLead" as="p" />
          </div>
          <div className="activities-schedule-table-wrap">
            <table className="activities-schedule-table">
              <thead>
                <tr>
                  <th scope="col"><ContentText k="activitiesPage.tableActivity" /></th>
                  <th scope="col"><ContentText k="activitiesPage.tableTime" /></th>
                  <th scope="col"><ContentText k="activitiesPage.tableFormat" /></th>
                  <th scope="col"><ContentText k="activitiesPage.tableBooking" /></th>
                </tr>
              </thead>
              <tbody>
                {BOOKABLE_ACTIVITY_CARDS.map((card) => (
                  <tr key={card.slug}>
                    <th scope="row"><ContentText k={card.titleKey} /></th>
                    <td><ContentText k={card.scheduleKey} /></td>
                    <td><ContentText k={card.formatKey} /></td>
                    <td>
                      <Link to={getEventsCalendarPath(card.slug)}>
                        <ContentText k="activitiesPage.tableBookingLink" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="activities-page-cta" aria-labelledby="activities-calendar-title">
        <ContentText k="page.calendarBookingTitle" as="p" className="activities-eyebrow" />
        <ContentText k="activitiesPage.calendarTitle" as="h2" id="activities-calendar-title" />
        <ContentText k="page.calendarBookingLead" as="p" />
        <Link to="/events" className="btn btn-primary">
          <ContentText k="activitiesPage.bookFromCalendar" />
        </Link>
      </section>

      <section className="activities-practice" aria-labelledby="activities-practice-title">
        <div className="activities-section-heading">
          <ContentText k="miniGames.practiceKicker" as="p" className="activities-eyebrow" />
          <ContentText k="miniGames.practiceTitle" as="h2" id="activities-practice-title" />
          <ContentText k="miniGames.practiceLead" as="p" />
        </div>
        <div className="activities-practice-grid">
          {MINI_GAMES_CATALOG.filter((card) => card.available).map((card) => (
            <Link key={card.id} to={card.path} className="activities-practice-card">
              <span className="activities-practice-card__tag">{card.tag}</span>
              <h3 className="activities-practice-card__title">{t(card.titleKey)}</h3>
              <p className="activities-practice-card__intro">{t(card.introKey)}</p>
              <span className="activities-practice-card__cta">{t('miniGames.startPractice')} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="activities-guides" aria-labelledby="activities-guides-title">
        <div className="activities-section-heading">
          <ContentText k="miniGames.guidesKicker" as="p" className="activities-eyebrow" />
          <ContentText k="miniGames.guidesTitle" as="h2" id="activities-guides-title" />
          <ContentText k="miniGames.guidesLead" as="p" />
        </div>
        <div className="activities-practice-grid">
          {LEARNING_GUIDES_CATALOG.filter((card) => card.available).map((card) => (
            <Link
              key={card.id}
              to={card.path}
              className="activities-practice-card activities-practice-card--guide"
            >
              <span className="activities-practice-card__tag">{card.tag}</span>
              <h3 className="activities-practice-card__title">{t(card.titleKey)}</h3>
              <p className="activities-practice-card__intro">{t(card.introKey)}</p>
              <span className="activities-practice-card__cta">{t('miniGames.openGuide')} →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
