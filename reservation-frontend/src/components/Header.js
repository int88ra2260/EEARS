import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { LANG_ZH, LANG_EN } from '../context/LanguageContext';
import { useSiteContentPreview } from '../context/SiteContentPreviewShell';
import useMediaQuery from '../hooks/useMediaQuery';
import useStudentSession from '../hooks/useStudentSession';
import { clearStudentSession } from '../utils/studentSession';
import {
  fetchEnglishTestRegistrationEnabledPublic,
  fetchEnglishTestRegistrationEditEnabledPublic,
} from '../services/settingsAdminApi';
import { MOTION_EASE_OUT, backdropMotion, drawerPanelMotion } from '../utils/motionPresets';
import './Header.css';

/** 真正回到頂端才放大。門檻必須貼著 0，避免高度變化把捲動位置推進來又立刻放大。 */
const HEADER_TOP_EXPAND_PX = 1;
/**
 * 要明顯離開頂端才縮小。
 * 這個距離必須大於 header 變高／變矮的佈局差（logo、直向 padding、導覽換行）。
 * 差大約 13–40px；若門檻只有十幾 px，捲動錨定會把 scrollTop 整段推回放大區，header 就會來回抽。
 */
const HEADER_TOP_COLLAPSE_PX = 96;
/** 高度動畫期間先鎖住狀態，避免每一幀的捲動修正又把狀態打回去 */
const HEADER_SIZE_LOCK_MS = 360;
/** 這些頁鎖住視窗捲動，header 尺寸由該頁 CSS 決定 */
const SCROLL_WORLD_PATHS = new Set([
  '/scrollworldtest',
  '/campus-journey-draft',
  '/scroll-world-packs',
]);

function findScrollParent(node) {
  let current = node?.parentElement || null;
  while (current && current !== document.body && current !== document.documentElement) {
    const { overflowY } = window.getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function readScrollTop(scrollParent) {
  if (scrollParent) return scrollParent.scrollTop || 0;
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function isImmersiveHeaderSurface(pathname) {
  if (SCROLL_WORLD_PATHS.has(pathname)) return true;
  if (typeof document === 'undefined') return false;
  return document.body.classList.contains('swt-overlay-open')
    || document.body.classList.contains('swt-lock-scroll')
    || document.documentElement.classList.contains('swt-lock-scroll')
    || document.querySelector('.app-wrapper--scrollworld') != null;
}

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
  const studentSession = useStudentSession();
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
  const headerRef = useRef(null);
  const [immersiveHeader, setImmersiveHeader] = useState(() => isImmersiveHeaderSurface(location.pathname));
  const scrollResizeEnabled = !immersiveHeader;

  useEffect(() => {
    const sync = () => {
      const next = isImmersiveHeaderSurface(location.pathname);
      setImmersiveHeader((prev) => (prev === next ? prev : next));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const wrapper = document.querySelector('.app-wrapper');
    if (wrapper) {
      observer.observe(wrapper, { attributes: true, attributeFilter: ['class'] });
    }
    return () => observer.disconnect();
  }, [location.pathname]);
  const [atTop, setAtTop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return readScrollTop(null) <= HEADER_TOP_EXPAND_PX;
  });
  const atTopRef = useRef(atTop);
  const routeKey = `${location.pathname}?${location.search}`;
  const [trackedRoute, setTrackedRoute] = useState(routeKey);

  if (trackedRoute !== routeKey) {
    setTrackedRoute(routeKey);
    if (!location.hash) {
      atTopRef.current = true;
      setAtTop(true);
    }
  }

  useEffect(() => {
    if (!scrollResizeEnabled) return undefined;

    const scrollParent = findScrollParent(headerRef.current);
    const target = scrollParent || window;
    const suppressNodes = [document.documentElement, document.body];
    let releaseTimer = 0;
    let lockUntil = 0;
    let anchorHeld = false;
    const previousStyles = suppressNodes.map((node) => ({
      node,
      anchor: node.style.overflowAnchor,
      behavior: node.style.scrollBehavior,
    }));

    const releaseSuppression = () => {
      if (!anchorHeld) return;
      previousStyles.forEach(({ node, anchor, behavior }) => {
        node.style.overflowAnchor = anchor;
        node.style.scrollBehavior = behavior;
      });
      anchorHeld = false;
    };

    const read = () => {
      if (performance.now() < lockUntil) return;
      const top = readScrollTop(scrollParent);
      const prev = atTopRef.current;
      const next = top <= HEADER_TOP_EXPAND_PX
        ? true
        : top > HEADER_TOP_COLLAPSE_PX
          ? false
          : prev;
      if (next === prev) return;

      const lockMs = reduceMotion ? 50 : HEADER_SIZE_LOCK_MS;
      lockUntil = performance.now() + lockMs;
      if (!anchorHeld) {
        suppressNodes.forEach((node) => {
          node.style.overflowAnchor = 'none';
          node.style.scrollBehavior = 'auto';
        });
        anchorHeld = true;
      }
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => {
        releaseSuppression();
        lockUntil = 0;
        read();
      }, lockMs);

      atTopRef.current = next;
      setAtTop(next);
    };

    const raf = requestAnimationFrame(read);
    target.addEventListener('scroll', read, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(releaseTimer);
      target.removeEventListener('scroll', read);
      releaseSuppression();
    };
  }, [scrollResizeEnabled, routeKey, reduceMotion]);

  const logoHeight = isMobile ? (atTop ? 64 : 50) : (atTop ? 72 : 52);
  const headerPadY = isMobile ? (atTop ? '0.75rem' : '0.55rem') : (atTop ? '0.95rem' : '0.55rem');
  const sizeTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: MOTION_EASE_OUT };

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

  const logoutStudent = () => {
    clearStudentSession();
    setMenuOpen(false);
  };

  const logoImg = scrollResizeEnabled ? (
    <motion.img
      src="/EMILEGO.png"
      alt="EMI Center Logo"
      className="header-logo-img"
      initial={false}
      animate={{ height: logoHeight }}
      transition={sizeTransition}
    />
  ) : (
    <img src="/EMILEGO.png" alt="EMI Center Logo" className="header-logo-img" />
  );

  const studentAuthLink = (mobile) => {
    if (preview?.isPreview) return null;
    const className = mobile ? 'nav-link-mobile' : 'nav-link';
    if (studentSession) {
      return (
        <>
          <Link to="/student/account" className={className} onClick={() => setMenuOpen(false)}>
            {t('nav.studentAccount')}
          </Link>
          <button type="button" className={`${className} border-0 bg-transparent`} onClick={logoutStudent}>
            {t('nav.studentLogout')}
          </button>
        </>
      );
    }
    return (
      <Link to="/student/login" className={className} onClick={() => setMenuOpen(false)}>
        {t('nav.studentLogin')}
      </Link>
    );
  };

  const headerClassName = `site-header${scrollResizeEnabled && atTop ? ' site-header--at-top' : ''}`;
  const headerBody = (
    <>
      {preview?.isPreview ? (
        <span className="header-logo" aria-label={t('nav.home')}>
          {logoImg}
        </span>
      ) : (
        <Link to="/" className="header-logo" aria-label={t('nav.home')}>
          {logoImg}
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
                  {studentAuthLink(true)}
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
            {studentAuthLink(false)}
            {langToggle}
          </div>
        </nav>
      )}
    </>
  );

  return (
    <header ref={headerRef} className={headerClassName}>
      {scrollResizeEnabled ? (
        <motion.div
          className="header-container"
          initial={false}
          animate={{ paddingTop: headerPadY, paddingBottom: headerPadY }}
          transition={sizeTransition}
        >
          {headerBody}
        </motion.div>
      ) : (
        <div className="header-container">{headerBody}</div>
      )}
    </header>
  );
}
