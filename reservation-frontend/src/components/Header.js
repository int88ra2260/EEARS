import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { LANG_ZH, LANG_EN } from '../context/LanguageContext';
import { useSiteContentPreview } from '../context/SiteContentPreviewShell';
import useMediaQuery from '../hooks/useMediaQuery';
import {
  fetchEnglishTestRegistrationEnabledPublic,
  fetchEnglishTestRegistrationEditEnabledPublic,
} from '../services/settingsAdminApi';
import { backdropMotion, drawerPanelMotion } from '../utils/motionPresets';
import './Header.css';

/** 任務導覽：學生最常用的動作 */
const TASK_NAV = [
  { action: 'events', path: '/events', labelKey: 'nav.eventsBooking' },
  {
    action: 'my-record',
    path: '/student/progress',
    labelKey: 'nav.myRecord',
    matchPaths: ['/student/progress', '/my-reservations', '/student/class-credit-allocation'],
  },
];

/** 探索導覽：資訊瀏覽（最新公告／活動介紹／學習資源／修課說明／法規表單／關於我們） */
const EXPLORE_NAV = [
  { action: 'announcements', path: '/announcements', labelKey: 'nav.announcements' },
  { action: 'activities', path: '/activities', labelKey: 'nav.activitiesIntro' },
  { action: 'learning-resources', path: '/learning-resources', labelKey: 'nav.learningResources' },
  { action: 'course-guide', path: '/course-guide', labelKey: 'nav.courseGuide' },
  { action: 'regulations-forms', path: '/regulations-forms', labelKey: 'nav.regulationsForms' },
  { action: 'about', path: '/about', labelKey: 'nav.about' },
];

export default function Header() {
  const location = useLocation();
  const preview = useSiteContentPreview();
  const { t, lang, setLang } = useLanguage();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [menuOpen, setMenuOpen] = useState(false);
  /**
   * 允許狀態：
   * - 個人報名 + 檢視與修正皆開 → 顯示「考試報名」
   * - 僅檢視與修正開 → 顯示「資料修正」
   * - 皆關 → 不顯示
   */
  const [englishTestRegistrationEnabled, setEnglishTestRegistrationEnabled] = useState(false);
  const [englishTestEditEnabled, setEnglishTestEditEnabled] = useState(false);
  const [englishTestNavReady, setEnglishTestNavReady] = useState(false);
  const reduceMotion = useReducedMotion();
  const backdropPresence = backdropMotion(reduceMotion);
  const drawerPresence = drawerPanelMotion(reduceMotion);

  const pathname = preview?.isPreview ? preview.previewPath : location.pathname;
  const isPublicSurface = preview?.isPreview
    ? true
    : location.pathname !== '/login' && !location.pathname.startsWith('/admin');
  const showEnglishTest = isPublicSurface && englishTestNavReady && englishTestEditEnabled;
  const englishTestLabelKey = englishTestRegistrationEnabled
    ? 'nav.englishTest'
    : 'nav.englishTestEdit';

  const pathIsActive = (path) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const itemIsActive = (item) => {
    const paths = item.matchPaths?.length ? item.matchPaths : [item.path];
    return paths.some((path) => pathIsActive(path));
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchEnglishTestRegistrationEnabledPublic(),
      fetchEnglishTestRegistrationEditEnabledPublic(),
    ])
      .then(([registrationEnabled, editEnabled]) => {
        if (cancelled) return;
        setEnglishTestRegistrationEnabled(registrationEnabled);
        setEnglishTestEditEnabled(editEnabled);
        setEnglishTestNavReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        // 失敗時保守顯示考試報名（與後端預設皆開一致）
        setEnglishTestRegistrationEnabled(true);
        setEnglishTestEditEnabled(true);
        setEnglishTestNavReady(true);
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

  const navClass = (mobile, active) =>
    `${mobile ? 'nav-link-mobile' : 'nav-link'}${active ? (mobile ? ' nav-link-mobile--active' : ' nav-link--active') : ''}`;

  const renderLinks = (items, mobile) =>
    items.map((item) => {
      const className = navClass(mobile, itemIsActive(item));
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
    const label = t(englishTestLabelKey);
    const className = mobile
      ? `nav-link-mobile nav-link-mobile--service${pathIsActive('/register/english-test') ? ' nav-link-mobile--active' : ''}`
      : `nav-link nav-link--service nav-link--service-muted${pathIsActive('/register/english-test') ? ' nav-link--active' : ''}`;
    if (preview?.isPreview) {
      return (
        <span className={className} aria-disabled="true">
          {label}
        </span>
      );
    }
    return (
      <Link
        to="/register/english-test"
        className={className}
        onClick={() => setMenuOpen(false)}
      >
        {label}
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
            <AnimatePresence>
              {menuOpen ? (
                <motion.button
                  key="header-drawer-backdrop"
                  type="button"
                  className="header-drawer-backdrop"
                  aria-label={t('a11y.closeMenu')}
                  onClick={() => setMenuOpen(false)}
                  {...backdropPresence}
                />
              ) : null}
              {menuOpen ? (
                <motion.nav
                  key="header-nav-mobile"
                  className="header-nav-mobile"
                  aria-label={t('a11y.mainNavigation')}
                  {...drawerPresence}
                >
                  <div className="nav-group-mobile nav-group-mobile--task" role="group" aria-label={t('nav.groupTask')}>
                    {renderLinks(TASK_NAV, true)}
                  </div>
                  <hr className="nav-divider-mobile" />
                  <div className="nav-group-mobile nav-group-mobile--explore" role="group" aria-label={t('nav.groupExplore')}>
                    {renderLinks(EXPLORE_NAV, true)}
                    {englishTestLink(true)}
                  </div>
                </motion.nav>
              ) : null}
            </AnimatePresence>
          </>
        ) : (
          <nav className="header-nav" aria-label={t('a11y.mainNavigation')}>
            <div className="header-nav-group header-nav-group--primary">
              {renderLinks(TASK_NAV, false)}
            </div>
            <div className="header-nav-group header-nav-group--explore">
              {renderLinks(EXPLORE_NAV, false)}
              {englishTestLink(false)}
            </div>
            <div className="header-nav-group header-nav-group--services">
              {langToggle}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
