import React from 'react';
import { Link } from 'react-router-dom';
import ContentText from '../siteContent/ContentText';
import { ShimmerButton } from '../home/MagicHeroEffects';

/**
 * A 方案 Hero：第一屏只放品牌、一句話、CTA；快捷服務另段
 */
export default function HomeImmersiveHero() {
  return (
    <section className="hit-hero" aria-labelledby="hit-hero-title" data-hit-hero>
      <div className="hit-hero__atmosphere" aria-hidden="true">
        <div className="hit-hero__wash" />
        <div className="hit-hero__glow" />
        <div className="hit-hero__grain" />
      </div>

      <div className="hit-shell hit-hero__inner">
        <p className="hit-hero__badge" data-hit-reveal>
          A 方案測試頁 · 不影響正式首頁
        </p>
        <ContentText
          k="homePage.heroEyebrow"
          as="p"
          className="hit-hero__eyebrow"
          data-hit-reveal
        />
        <ContentText
          k="aboutPage.heroTitle"
          as="h1"
          id="hit-hero-title"
          className="hit-hero__title"
          data-hit-reveal
        />
        <ContentText k="aboutPage.heroLead" as="p" className="hit-hero__lead" data-hit-reveal />

        <div className="hit-hero__actions" data-hit-reveal>
          <ShimmerButton to="/events" variant="hero" className="hit-hero__cta">
            <ContentText k="homePage.heroCtaBook" />
          </ShimmerButton>
          <Link to="/about" className="hit-btn hit-btn--ghost">
            <ContentText k="nav.about" />
          </Link>
        </div>

        <p className="hit-hero__scroll-hint" data-hit-reveal aria-hidden="true">
          <span>往下探索中心服務</span>
          <i />
        </p>
      </div>
    </section>
  );
}
