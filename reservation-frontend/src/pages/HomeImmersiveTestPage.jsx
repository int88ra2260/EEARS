import React from 'react';
import HomeImmersiveHero from '../components/homeImmersive/HomeImmersiveHero';
import HomeImmersiveJourney from '../components/homeImmersive/HomeImmersiveJourney';
import HomeImmersiveQuick from '../components/homeImmersive/HomeImmersiveQuick';
import AnnouncementPreview from '../components/home/AnnouncementPreview';
import FAQSection from '../components/home/FAQSection';
import ContactSection from '../components/home/ContactSection';
import useHomeImmersiveGsap from '../hooks/useHomeImmersiveGsap';
import '../components/home/home.css';
import './HomeImmersiveTestPage.css';

/**
 * A 方案臨時測試頁（/hometest）
 * 不取代正式首頁 `/`
 */
export default function HomeImmersiveTestPage() {
  const { rootRef, scrollToJourneyStep } = useHomeImmersiveGsap();

  return (
    <div ref={rootRef} className="hit-page home-page">
      <div className="hit-test-banner" role="status">
        <span>
          這是沉浸式首頁 <strong>A 方案測試頁</strong>（<code>/hometest</code>
          ）。正式首頁仍為 <code>/</code>。
        </span>
        <a href="/">回正式首頁</a>
      </div>

      <HomeImmersiveHero />
      <HomeImmersiveJourney onSelectStep={scrollToJourneyStep} />
      <HomeImmersiveQuick />
      <AnnouncementPreview />
      <FAQSection />
      <ContactSection />
    </div>
  );
}
