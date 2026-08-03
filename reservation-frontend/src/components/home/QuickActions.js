import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import './home.css';

export default function QuickActions() {
  const { t } = useLanguage();

  const actions = [
    {
      to: '/events',
      icon: '📅',
      titleKey: 'homePage.quickBook',
      descKey: 'homePage.quickBookDesc',
    },
    {
      to: '/my-reservations',
      icon: '🔍',
      titleKey: 'homePage.quickMyReservation',
      descKey: 'homePage.quickMyReservationDesc',
    },
    {
      to: '/survey/choice',
      icon: '📋',
      titleKey: 'homePage.quickSurvey',
      descKey: 'homePage.quickSurveyDesc',
    },
    {
      to: '/about#faq',
      icon: '📌',
      titleKey: 'homePage.quickRules',
      descKey: 'homePage.quickRulesDesc',
    },
  ];

  return (
    <section className="home-section" aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title" className="home-section-title">
        {t('homePage.quickActionsTitle')}
      </h2>
      <div className="home-quick-actions">
        {actions.map((item, idx) => {
          const content = (
            <>
              <div className="icon-wrap" aria-hidden>{item.icon}</div>
              <h3>{t(item.titleKey)}</h3>
              <p>{t(item.descKey)}</p>
            </>
          );
          if (item.to) {
            return (
              <Link
                key={idx}
                to={item.to}
                className="home-quick-card"
              >
                {content}
              </Link>
            );
          }
          return (
            <button
              key={idx}
              type="button"
              className="home-quick-card"
              style={{ border: '1px solid var(--home-warm)', cursor: 'pointer', background: '#fff' }}
              onClick={item.onClick}
            >
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );
}
