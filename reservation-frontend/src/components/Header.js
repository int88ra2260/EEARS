import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { LANG_ZH, LANG_EN } from '../context/LanguageContext';
import { useSiteContentPreview } from '../context/SiteContentPreviewShell';
import useMediaQuery from '../hooks/useMediaQuery';
import { fetchEnglishTestRegistrationEnabledPublic } from '../services/settingsAdminApi';
import './Header.css';

/** 任務導覽：學生最常用的動作 */
const TASK_NAV = [
  { action: 'events', path: '/events', labelKey: 'nav.eventsBooking' },
  { action: 'my-reservations', path: '/my-reservations', labelKey: 'nav.myReservations' },
  { action: 'progress', path: '/student/progress', labelKey: 'nav.myProgress' },
];

/** 探索導覽：資訊瀏覽 */
const EXPLORE_NAV = [
  { action: 'announcements', path: '/announcements', labelKey: 'nav.announcements' },
  { action: 'activities', path: '/activities', labelKey: 'nav.activitiesIntro' },
  { action: 'learning-resources', path: '/learning-resources', labelKey: 'nav.learningResources' },
  { action: 'regulations-forms', path: '/regulations-forms', labelKey: 'nav.regulationsForms' },
  { action: 'about', path: '/about', labelKey: 'nav.about' },
];

export default function Header() {
  const location = useLocation();
  const preview = useSiteContentPreview();
  const { t, lang, setLang } = useLanguage();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [menuOpen, setMenuOpen] = useState(false);
  const [englishTestEnabled, setEnglishTestEnabled] = useState(true);

  const pathname = preview?.isPreview ? preview.previewPath : location.pathname;
  const isPublicSurface = preview?.isPreview
    ? true
    : location.pathname !== '/login' && !location.pathname.startsWith('/admin');
  const showEnglishTest = isPublicSurface && englishTestEnabled;

  const isActive = (path) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  useEffect(() => {
    let cancelled = false;
    fetchEnglishTestRegistrationEnabledPublic()
      .then((enabled) => {
        if (!cancelled) setEnglishTestEnabled(enabled);
      })
      .catch(() => {
        if (!cancelled) setEnglishTestEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleLang = () => {
    setLang(lang === LANG_ZH ? LANG_EN : LANG_ZH);
  };

  useEffect(() => {
    if (!menuOpen || !isMobile) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen, isMobile]);

  const langToggle = (
    <button
      type="button"
      className="lang-toggle"
      onClick={toggleLang}
      title={lang === LANG_ZH ? 'Switch to English' : '切換至中文'}
      aria-label={lang === LANG_ZH ? 'English' : '中文'}
    >
      {lang === LANG_ZH ? 'EN' : '中文'}
    </button>
  );

  const navClass = (mobile, path) =>
    `${mobile ? 'nav-link-mobile' : 'nav-link'}${isActive(path) ? (mobile ? ' nav-link-mobile--active' : ' nav-link--active') : ''}`;

  const renderLinks = (items, mobile) =>
    items.map((item) => {
      const className = navClass(mobile, item.path);
      if (preview?.isPreview) {
        return (
          <span key={item.action} className={className} aria-disabled="true">
            {t(item.labelKey)}
          </span>
        );
      }
      return (
        <Link
          key={item.action}
          to={item.path}
          className={className}
          onClick={() => setMenuOpen(false)}
        >
          {t(item.labelKey)}
        </Link>
      );
    });

  const englishTestLink = (mobile) => {
    if (!showEnglishTest) return null;
    const className = mobile
      ? `nav-link-mobile${isActive('/register/english-test') ? ' nav-link-mobile--active' : ''}`
      : `nav-link nav-link--service${isActive('/register/english-test') ? ' nav-link--active' : ''}`;
    if (preview?.isPreview) {
      return (
        <span className={className} aria-disabled="true">
          {t('nav.englishTest')}
        </span>
      );
    }
    return (
      <Link
        to="/register/english-test"
        className={className}
        onClick={() => setMenuOpen(false)}
      >
        {t('nav.englishTest')}
      </Link>
    );
  };

  return (
    <header className="site-header">
      <div className="header-container">
        {preview?.isPreview ? (
          <span className="header-logo" aria-label={t('nav.home')}>
            <img src="/EMILEGO.png" alt="EMI Center Logo" className="header-logo-img" />
          </span>
        ) : (
          <Link to="/" className="header-logo" aria-label={t('nav.home')}>
            <img src="/EMILEGO.png" alt="EMI Center Logo" className="header-logo-img" />
          </Link>
        )}

        {isMobile ? (
          <>
            <div className="header-actions-mobile">
              {langToggle}
              <button
                type="button"
                className="hamburger"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-label={menuOpen ? t('a11y.closeMenu') : t('a11y.openMenu')}
              >
                <span />
                <span />
                <span />
              </button>
            </div>
            {menuOpen && (
              <>
                <button
                  type="button"
                  className="header-drawer-backdrop"
                  aria-label={t('a11y.closeMenu')}
                  onClick={() => setMenuOpen(false)}
                />
                <nav className="header-nav-mobile" aria-label={t('a11y.mainNavigation')}>
                  <div className="nav-group-mobile nav-group-mobile--task" role="group" aria-label={t('nav.groupTask')}>
                    {renderLinks(TASK_NAV, true)}
                  </div>
                  <hr className="nav-divider-mobile" />
                  <div className="nav-group-mobile nav-group-mobile--explore" role="group" aria-label={t('nav.groupExplore')}>
                    {renderLinks(EXPLORE_NAV, true)}
                    {englishTestLink(true)}
                  </div>
                </nav>
              </>
            )}
          </>
        ) : (
          <nav className="header-nav" aria-label={t('a11y.mainNavigation')}>
            <div className="header-nav-group header-nav-group--primary">
              {renderLinks(TASK_NAV, false)}
            </div>
            <div className="header-nav-group header-nav-group--explore">
              {renderLinks(EXPLORE_NAV, false)}
            </div>
            <div className="header-nav-group header-nav-group--services">
              {englishTestLink(false)}
              {langToggle}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
