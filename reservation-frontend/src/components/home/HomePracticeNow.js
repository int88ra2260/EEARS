import React from 'react';
import { Link } from 'react-router-dom';
import ContentText from '../siteContent/ContentText';
import { MINI_GAMES_CATALOG } from '../../constants/miniGamesCatalog';
import { useLanguage } from '../../context/LanguageContext';

export default function HomePracticeNow() {
  const { t } = useLanguage();
  const games = MINI_GAMES_CATALOG.filter((g) => g.available);

  return (
    <section
      className="home-section home-section--practice home-practice-now"
      aria-labelledby="home-practice-title"
    >
      <div className="home-shell home-reveal">
        <header className="home-section__header home-practice-now__header">
          <ContentText k="homePage.practiceNowKicker" as="p" className="home-kicker home-kicker--section" />
          <ContentText k="homePage.practiceNowTitle" as="h2" id="home-practice-title" className="home-section__title" />
          <ContentText k="homePage.practiceNowLead" as="p" className="home-practice-now__lead home-section__lead" />
        </header>
        <div className="home-practice-now__grid">
          {games.map((game, index) => (
            <Link key={game.id} to={game.path} className="home-practice-now__card">
              <span className="home-practice-now__index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="home-practice-now__tag">{t(game.timeKey || 'miniGames.startPractice')}</span>
              <span className="home-practice-now__title">{t(game.titleKey)}</span>
              <span className="home-practice-now__desc">{t(game.introKey)}</span>
            </Link>
          ))}
          <Link to="/learning-resources" className="home-practice-now__card home-practice-now__card--more">
            <span className="home-practice-now__index" aria-hidden="true">→</span>
            <span className="home-practice-now__title">{t('homePage.practiceNowCtaMore')}</span>
            <span className="home-practice-now__desc">{t('nav.learningResources')}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
