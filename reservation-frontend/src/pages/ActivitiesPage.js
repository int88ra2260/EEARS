import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import ContentText from '../components/siteContent/ContentText';
import ContentImage from '../components/siteContent/ContentImage';
import PageHeader from '../components/layout/PageHeader';
import ActivityFlowSteps from '../components/activities/ActivityFlowSteps';
import useSessionShuffled from '../hooks/useSessionShuffled';
import useBookableActivityCatalog from '../hooks/useBookableActivityCatalog';
import { LEARNING_GUIDES_CATALOG } from '../constants/learningGuidesCatalog';
import { useSiteContentVisualEdit } from '../context/SiteContentVisualEditContext';
import {
  resolveActivityImageSrc,
  resolveActivitySecondaryCta,
} from '../utils/activityTypeContent';
import './ActivitiesPage.css';
import '../components/guides/ActivityPhrasebook.css';

function cardTitle(card, t) {
  if (card.titleKey) return t(card.titleKey);
  return card.displayName || card.slug;
}



function ActivityCardActions({ card, t }) {
  const visual = useSiteContentVisualEdit();
  const secondary = resolveActivitySecondaryCta(card, t);

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
        <ActivitySecondaryCta
          card={card}
          secondary={secondary}
          visual={visual}
        />
      </div>
    );
  }

  return (
    <div className="activity-card-actions">
      <Link to={`/activities/${card.slug}`} className="btn btn-primary activity-card-cta">
        <ContentText k="homePage.activityReserve" />
      </Link>
      <ActivitySecondaryCta
        card={card}
        secondary={secondary}
        visual={visual}
      />
    </div>
  );
}

function ActivitySecondaryCta({ card, secondary, visual }) {
  if (secondary) {
    const className = 'btn btn-outline-secondary activity-card-cta';
    const label = <ContentText k={secondary.labelKey} />;
    if (secondary.external) {
      return (
        <a
          href={secondary.href}
          className={className}
          target="_blank"
          rel="noopener noreferrer"
        >
          {label}
        </a>
      );
    }
    return (
      <Link to={secondary.href} className={className}>
        {label}
      </Link>
    );
  }

  if (visual?.enabled && card.secondaryCtaLabelKey && visual.isEditable(card.secondaryCtaLabelKey)) {
    return (
      <button
        type="button"
        className="btn btn-outline-secondary activity-card-cta activity-card-cta--placeholder"
        data-content-key={card.secondaryCtaLabelKey}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          visual.selectKey(card.secondaryCtaLabelKey);
        }}
      >
        設定第二按鈕
      </button>
    );
  }

  return null;
}



export default function ActivitiesPage() {

  const { t } = useLanguage();

  const { catalogDisplayCards } = useBookableActivityCatalog();

  const shuffledCatalogCards = useSessionShuffled(catalogDisplayCards, 'activities-catalog');



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
                {card.imageKey ? (
                  <ContentImage
                    k={card.imageKey}
                    src={resolveActivityImageSrc(t, card.imageKey, card.image)}
                    alt={cardTitle(card, t)}
                    className="activity-card-visual__photo"
                    loading="lazy"
                  />
                ) : (
                  <img
                    src={card.image}
                    alt={cardTitle(card, t)}
                    className="activity-card-visual__photo"
                    loading="lazy"
                  />
                )}
                <div className="activity-card-visual__scrim" aria-hidden="true" />
                <span className="activity-card-tag">{card.tag}</span>
                {card.visualKeys?.length ? (
                  <div className="activity-card-visual__track">
                    {card.visualKeys.map((key, index) => (
                      <span key={key} style={{ '--index': index }}>
                        <ContentText k={key} />
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="activity-card-body">

                {card.titleKey ? (

                  <ContentText k={card.titleKey} as="h3" className="activity-card-title" />

                ) : (

                  <h3 className="activity-card-title">{cardTitle(card, t)}</h3>

                )}

                {card.introKey ? (

                  <ContentText k={card.introKey} as="p" className="activity-card-desc" />

                ) : (

                  <p className="activity-card-desc">{t('page.activityCategoryLead')}</p>

                )}

                {card.fitKey && card.formatKey && card.durationKey ? (

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

                ) : null}

                <ActivityCardActions card={card} t={t} />

              </div>

            </article>

          ))}

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

