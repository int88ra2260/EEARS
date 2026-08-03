import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import './home.css';

const STEP_KEYS = ['homePage.step1', 'homePage.step2', 'homePage.step3', 'homePage.step4'];

export default function ReservationSteps() {
  const { t } = useLanguage();

  return (
    <section className="home-section home-section--bone" aria-labelledby="steps-title">
      <div className="home-shell home-reveal">
        <header className="home-section__header home-section__header--left">
          <p className="home-kicker home-kicker--section">{t('homePage.stepsKicker')}</p>
          <h2 id="steps-title" className="home-section__title">
            {t('homePage.stepsTitle')}
          </h2>
        </header>

        <ol className="home-steps-rail">
          {STEP_KEYS.map((key, index) => (
            <li key={key} className="home-steps-rail__item" style={{ '--index': index }}>
              <span className="home-steps-rail__num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p>{t(key)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
