import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { LANG_ZH, LANG_EN } from '../context/LanguageContext';
import { useSiteContentPreview } from '../context/SiteContentPreviewShell';
import useMediaQuery from '../hooks/useMediaQuery';
import { fetchEnglishTestRegistrationEnabledPublic } from '../services/settingsAdminApi';
import './Header.css';

/** 主選單（資訊導覽） */
const PRIMARY_NAV = [
  { action: 'announcements', path: '/announcements', labelKey: 'nav.announcements' },
  { action: 'activities', path: '/activities', labelKey: 'nav.activitiesIntro' },
  { action: 'learning-resources', path: '/learning-resources', labelKey: 'nav.learningResources' },
  { action: 'regulations-forms', path: '/regulations-forms', labelKey: 'nav.regulationsForms' },
  { action: 'about', path: '/about', labelKey: 'nav.about' },
];

export default function Header() {
  const navigate = useNavigate();
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

  const handleNavClick = (action) => {
    setMenuOpen(false);
    if (preview?.isPreview) return;

    const item = PRIMARY_NAV.find((nav) => nav.action === action);
    if (item) {
      navigate(item.path);
      return;
    }
    if (action === 'english-test') {
      navigate('/register/english-test');
    }
  };

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

  const primaryLinks = (mobile) =>
    PRIMARY_NAV.map((item) => (
      <button
        key={item.action}
        type="button"
        className={`${mobile ? 'nav-link-mobile' : 'nav-link'}${isActive(item.path) ? (mobile ? ' nav-link-mobile--active' : ' nav-link--active') : ''}`}
        onClick={() => handleNavClick(item.action)}
      >
        {t(item.labelKey)}
      </button>
    ));

  const englishTestButton = (mobile) => {
    if (!showEnglishTest) return null;
    if (mobile) {
      return (
        <button
          type="button"
          className={`nav-link-mobile${isActive('/register/english-test') ? ' nav-link-mobile--active' : ''}`}
          onClick={() => handleNavClick('english-test')}
        >
          {t('nav.englishTest')}
        </button>
      );
    }
    return (
      <button
        type="button"
        className={`nav-link nav-link--service${isActive('/register/english-test') ? ' nav-link--active' : ''}`}
        onClick={() => handleNavClick('english-test')}
      >
        {t('nav.englishTest')}
      </button>
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
              {showEnglishTest && (
                <button
                  type="button"
                  className="btn-english-test-mobile"
                  onClick={() => handleNavClick('english-test')}
                >
                  {t('nav.englishTest')}
                </button>
              )}
              {langToggle}
              <button
                type="button"
                className="hamburger"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-label="Menu"
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
                  aria-label="關閉選單"
                  onClick={() => setMenuOpen(false)}
                />
                <nav className="header-nav-mobile" aria-label="Main navigation">
                  {primaryLinks(true)}
                  {englishTestButton(true)}
                </nav>
              </>
            )}
          </>
        ) : (
          <nav className="header-nav" aria-label="Main navigation">
            <div className="header-nav-group header-nav-group--primary">
              {primaryLinks(false)}
            </div>
            <div className="header-nav-group header-nav-group--services">
              {englishTestButton(false)}
              {langToggle}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
