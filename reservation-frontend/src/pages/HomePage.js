import React, { useCallback, useEffect, useState } from 'react';
import HomeHero from '../components/home/HomeHero';
import HomePracticeNow from '../components/home/HomePracticeNow';
import AnnouncementPreview from '../components/home/AnnouncementPreview';
import FAQSection from '../components/home/FAQSection';
import ContactSection from '../components/home/ContactSection';
import useHomeGsap from '../hooks/useHomeGsap';
import ScrollWorldTestPage from './ScrollWorldTestPage';
import '../styles/emi-brand.css';
import '../components/home/home.css';
import '../styles/magic-ui.css';

const DESKTOP_MQ = '(min-width: 861px)';
export const HOME_SW_DISMISSED_KEY = 'eears-home-sw-dismissed';

function readIsDesktop() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(DESKTOP_MQ).matches;
}

function readDismissed() {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(HOME_SW_DISMISSED_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export default function HomePage() {
  const rootRef = useHomeGsap();
  const [isDesktop, setIsDesktop] = useState(readIsDesktop);
  const [dismissed, setDismissed] = useState(readDismissed);
  const showOverlay = isDesktop && !dismissed;

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    const hash = window.location.hash?.slice(1);
    if (!hash || showOverlay) return;
    const el = document.getElementById(hash);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [showOverlay]);

  useEffect(() => {
    const wrapper = document.querySelector('.app-wrapper');
    const main = document.getElementById('main-content');
    if (!showOverlay) {
      document.body.classList.remove('swt-overlay-open');
      wrapper?.classList.remove('app-wrapper--scrollworld');
      main?.classList.remove('public-site--scrollworld');
      return undefined;
    }

    document.body.classList.add('swt-overlay-open');
    wrapper?.classList.add('app-wrapper--scrollworld');
    main?.classList.add('public-site--home', 'public-site--scrollworld');

    return () => {
      document.body.classList.remove('swt-overlay-open');
      wrapper?.classList.remove('app-wrapper--scrollworld');
      main?.classList.remove('public-site--scrollworld');
    };
  }, [showOverlay]);

  const dismissOverlay = useCallback(() => {
    try {
      sessionStorage.setItem(HOME_SW_DISMISSED_KEY, '1');
    } catch (_) {
      /* ignore */
    }
    setDismissed(true);
    window.dispatchEvent(new CustomEvent('eears-sw-overlay-closed'));
  }, []);

  return (
    <>
      <div
        ref={rootRef}
        className="home-page"
        aria-hidden={showOverlay ? true : undefined}
      >
        <HomeHero />
        <HomePracticeNow />
        <AnnouncementPreview />
        <FAQSection />
        <ContactSection />
      </div>

      {showOverlay ? (
        <div className="swt-home-overlay" role="dialog" aria-modal="true" aria-label="沉浸式首頁">
          <ScrollWorldTestPage onClose={dismissOverlay} />
        </div>
      ) : null}
    </>
  );
}
