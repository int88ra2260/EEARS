import React from 'react';
import { Link } from 'react-router-dom';
import ContentText from '../siteContent/ContentText';
import { HOME_IMMERSIVE_QUICK_LINKS } from '../../constants/homeImmersiveTestConfig';

/** Hero 下方：常用服務（自第一屏降級） */
export default function HomeImmersiveQuick() {
  return (
    <section className="hit-quick home-section home-section--flat" aria-labelledby="hit-quick-title">
      <div className="home-shell home-reveal">
        <header className="home-section__header">
          <ContentText k="homePage.quickActionsTitle" as="p" className="home-kicker home-kicker--section" />
          <ContentText
            k="homePage.quickPanelTitle"
            as="h2"
            id="hit-quick-title"
            className="home-section__title"
          />
        </header>

        <div className="hit-quick__grid" role="list">
          {HOME_IMMERSIVE_QUICK_LINKS.map((item) => (
            <div key={item.to} role="listitem">
              <Link to={item.to} className="hit-quick__card home-scroll-item">
                <ContentText k={item.titleKey} as="span" className="hit-quick__card-title" />
                <ContentText k={item.descKey} as="span" className="hit-quick__card-desc" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
