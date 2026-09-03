import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { siteAuthor } from '../config/author';
import { fetchViewStats } from '../services/statsApi';
import './Footer.css';

export default function Footer() {
  const { t } = useLanguage();
  const showAuthor = siteAuthor.name && siteAuthor.name.trim() !== '';
  const [views, setViews] = useState({ total: null, today: null });

  useEffect(() => {
    let cancelled = false;
    fetchViewStats()
      .then((data) => {
        if (!cancelled) setViews({ total: data.total, today: data.today });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-main">
          <div className="footer-brand">
            <h3 className="footer-title">{t('footer.centerNameShort')}</h3>
            <p className="footer-subtitle">{t('footer.reservationSystem')}</p>
          </div>
          <nav className="footer-links" aria-label="Footer navigation">
            <Link to="/" className="footer-link">{t('nav.home')}</Link>
            <span className="footer-divider">|</span>
            <Link to="/announcements" className="footer-link">{t('nav.announcements')}</Link>
            <span className="footer-divider">|</span>
            <Link to="/activities" className="footer-link">{t('nav.activitiesIntro')}</Link>
            <span className="footer-divider">|</span>
            <Link to="/learning-resources" className="footer-link">{t('nav.learningResources')}</Link>
            <span className="footer-divider">|</span>
            <Link to="/course-guide" className="footer-link">{t('nav.courseGuide')}</Link>
            <span className="footer-divider">|</span>
            <Link to="/regulations-forms" className="footer-link">{t('nav.regulationsForms')}</Link>
            <span className="footer-divider">|</span>
            <Link to="/about" className="footer-link">{t('nav.about')}</Link>
          </nav>
        </div>
        <div className="footer-bottom">
          {(views.total !== null || views.today !== null) && (
            <p className="footer-views">
              <span className="footer-views-item">
                <i className="fas fa-eye me-1" aria-hidden />
                {t('footer.totalViews')}: <strong>{views.total !== null ? views.total.toLocaleString() : '—'}</strong>
              </span>
              <span className="footer-views-divider">|</span>
              <span className="footer-views-item">
                <i className="fas fa-calendar-day me-1" aria-hidden />
                {t('footer.todayViews')}: <strong>{views.today !== null ? views.today.toLocaleString() : '—'}</strong>
              </span>
            </p>
          )}
          <p className="footer-copyright">{t('footer.copyright')}</p>
          {showAuthor && (
            <p className="footer-author">
              {t('footer.developedBy')}
              {siteAuthor.url ? (
                <a
                  href={siteAuthor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-author-link"
                >
                  {siteAuthor.name.trim()}
                </a>
              ) : (
                <span>{siteAuthor.name.trim()}</span>
              )}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
