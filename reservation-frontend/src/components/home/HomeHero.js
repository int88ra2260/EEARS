import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ContentText from '../siteContent/ContentText';
import { fetchEnabledSurveys } from '../../services/surveyPublicApi';
import { ShimmerButton } from './MagicHeroEffects';
import './home.css';

const HERO_QUICK_LINKS = [
  {
    to: '/my-reservations',
    titleKey: 'homePage.quickMyReservation',
    descKey: 'homePage.quickMyReservationDesc',
  },
  {
    to: '/survey/choice',
    titleKey: 'homePage.quickSurvey',
    descKey: 'homePage.quickSurveyDesc',
    idleDescKey: 'homePage.quickSurveyDescIdle',
  },
  {
    to: '/learning-resources',
    titleKey: 'homePage.quickPractice',
    descKey: 'homePage.quickPracticeDesc',
  },
  {
    to: '/student/english-learning-passport',
    titleKey: 'homePage.quickPassport',
    descKey: 'homePage.quickPassportDesc',
  },
];

export default function HomeHero() {
  const [surveyCount, setSurveyCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchEnabledSurveys()
      .then((list) => {
        if (!cancelled) setSurveyCount(Array.isArray(list) ? list.length : 0);
      })
      .catch(() => {
        if (!cancelled) setSurveyCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="home-hero home-hero--desk" aria-labelledby="home-hero-title">
      <div className="home-shell home-hero__inner">
        <div className="home-hero-desk">
          <div className="home-hero-desk__copy">
            <ContentText k="homePage.heroEyebrow" as="p" className="home-hero-desk__eyebrow" />
            <ContentText
              k="homePage.heroTitle"
              as="h1"
              id="home-hero-title"
              className="home-hero-panel__title"
            />
            <ContentText k="homePage.heroTagline" as="p" className="home-hero-panel__tagline" />
            <ContentText k="homePage.heroDescClassic" as="p" className="home-hero-panel__desc" />

            <div className="home-hero-desk__actions">
              <ShimmerButton
                to="/events"
                variant="hero"
                className="home-hero-panel__cta"
              >
                <ContentText k="homePage.heroCtaBook" />
              </ShimmerButton>
              <Link to="/activities" className="home-btn home-btn--ghost">
                <ContentText k="homePage.heroCtaActivities" />
              </Link>
            </div>
          </div>

          <aside className="home-hero-panel__quick" aria-labelledby="home-quick-title">
            <div className="home-hero-panel__quick-header">
              <ContentText k="homePage.quickActionsTitle" as="p" className="home-kicker home-kicker--section" />
              <ContentText k="homePage.quickPanelTitle" as="h2" id="home-quick-title" />
            </div>
            <div className="home-hero-panel__grid" role="list">
              {HERO_QUICK_LINKS.map((item) => {
                const descKey = item.idleDescKey && surveyCount === 0
                  ? item.idleDescKey
                  : item.descKey;
                return (
                  <div key={item.to} role="listitem">
                    <Link to={item.to} className="home-hero-quick-card">
                      <div className="home-hero-quick-card__top">
                        <ContentText k={item.titleKey} as="span" className="home-hero-quick-card__title" />
                      </div>
                      <ContentText k={descKey} as="span" className="home-hero-quick-card__desc" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
