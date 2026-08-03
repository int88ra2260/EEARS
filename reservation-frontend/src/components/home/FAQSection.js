import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import ContentText from '../siteContent/ContentText';
import useFaqItems, { pickLocalizedText } from '../../hooks/useFaqItems';
import './home.css';

export default function FAQSection() {
  const { lang } = useLanguage();
  const { faqItems } = useFaqItems();
  const [openId, setOpenId] = useState(null);

  return (
    <section id="faq" className="home-section home-section--flat" aria-labelledby="faq-title">
      <div className="home-shell home-reveal">
        <header className="home-section__header">
          <ContentText k="homePage.faqKicker" as="p" className="home-kicker home-kicker--section" />
          <ContentText k="homePage.faqTitle" as="h2" id="faq-title" className="home-section__title" />
        </header>

        <div className="home-faq">
          {faqItems.map((item) => {
            const itemId = item.id;
            const isOpen = openId === itemId;
            const question = pickLocalizedText(item.question, lang);
            const answer = pickLocalizedText(item.answer, lang);
            return (
              <div key={String(itemId)} className={`home-faq__item${isOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="home-faq__trigger"
                  aria-expanded={isOpen}
                  aria-controls={`${itemId}-answer`}
                  id={`${itemId}-q`}
                  onClick={() => setOpenId(isOpen ? null : itemId)}
                >
                  <span>{question}</span>
                  <span className="home-faq__icon" aria-hidden="true">
                    {isOpen ? '-' : '+'}
                  </span>
                </button>
                <div
                  id={`${itemId}-answer`}
                  role="region"
                  aria-labelledby={`${itemId}-q`}
                  className="home-faq__panel"
                  hidden={!isOpen}
                >
                  {answer}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
