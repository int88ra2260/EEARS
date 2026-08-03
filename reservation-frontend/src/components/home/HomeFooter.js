import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import ContentText from '../siteContent/ContentText';
import { siteAuthor } from '../../config/author';
import { fetchViewStats } from '../../services/statsApi';
import '../../styles/site-footer.css';

const EMI_CENTER_URL = 'https://emicenter.siwan.nsysu.edu.tw/';

/**
 * 全站統一頁尾（以原 HomeFooter 為主體，整合品牌區、瀏覽次數、EMI 連結、作者、隱私權／使用條款）
 * 於 PublicLayout 對所有公開前台頁面顯示。
 */
export default function HomeFooter() {
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
    <footer className="home-footer" role="contentinfo">
      <div className="home-footer-inner">
        {/* 品牌區 */}
        <div className="home-footer-brand">
          <h3 className="home-footer-title">{t('footer.centerNameShort')}</h3>
          <p className="home-footer-subtitle">{t('footer.reservationSystem')}</p>
        </div>

        <nav className="home-footer-links" aria-label="Footer navigation">
          <Link to="/"><ContentText k="homePage.footerHome" /></Link>
          <Link to="/announcements"><ContentText k="homePage.footerAnnouncements" /></Link>
          <Link to="/activities"><ContentText k="homePage.footerActivities" /></Link>
          <Link to="/learning-resources"><ContentText k="homePage.footerLearningResources" /></Link>
          <Link to="/regulations-forms"><ContentText k="homePage.footerRegulationsForms" /></Link>
          <Link to="/about"><ContentText k="homePage.footerAbout" /></Link>
          <span className="home-footer-divider">|</span>
          <Link to="/privacy"><ContentText k="homePage.footerPrivacy" /></Link>
          <Link to="/terms"><ContentText k="homePage.footerTerms" /></Link>
          <span className="home-footer-divider">|</span>
          <a
            href={EMI_CENTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="home-footer-extlink"
          >
            <i className="fas fa-external-link-alt me-1" aria-hidden />
            {t('footer.linkToCenter')}
          </a>
          <span className="home-footer-divider">|</span>
          <Link to="/login"><ContentText k="homePage.footerAdmin" /></Link>
        </nav>

        {/* 瀏覽次數 */}
        {(views.total !== null || views.today !== null) && (
          <p className="home-footer-views">
            <span className="home-footer-views-item">
              <i className="fas fa-eye me-1" aria-hidden />
              {t('footer.totalViews')}: <strong>{views.total !== null ? views.total.toLocaleString() : '—'}</strong>
            </span>
            <span className="home-footer-views-divider">|</span>
            <span className="home-footer-views-item">
              <i className="fas fa-calendar-day me-1" aria-hidden />
              {t('footer.todayViews')}: <strong>{views.today !== null ? views.today.toLocaleString() : '—'}</strong>
            </span>
          </p>
        )}

        <p className="home-footer-copyright">{t('footer.copyright')}</p>
        {showAuthor && (
          <p className="home-footer-author">
            {t('footer.developedBy')}
            {siteAuthor.url ? (
              <a
                href={siteAuthor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="home-footer-author-link"
              >
                {siteAuthor.name.trim()}
              </a>
            ) : (
              <span>{siteAuthor.name.trim()}</span>
            )}
          </p>
        )}
      </div>
    </footer>
  );
}
