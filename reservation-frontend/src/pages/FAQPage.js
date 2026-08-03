import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import useFaqItems, { pickLocalizedText } from '../hooks/useFaqItems';
import PageHeader from '../components/layout/PageHeader';
import './FAQPage.css';

export default function FAQPage() {
  const { t, lang } = useLanguage();
  const { faqItems } = useFaqItems();
  const [openId, setOpenId] = useState(null);

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.faq') },
  ];

  return (
    <div className="faq-page">
      <PageHeader breadcrumbs={breadcrumbs} title={t('faq.title')} />
      <div className="faq-page-list">
        {faqItems.map((item) => {
          const itemId = item.id;
          const isOpen = openId === itemId;
          const question = pickLocalizedText(item.question, lang);
          const answer = pickLocalizedText(item.answer, lang);
          return (
            <div key={String(itemId)} className="faq-page-item">
              <button
                type="button"
                className="faq-page-question"
                aria-expanded={isOpen}
                aria-controls={`faq-${itemId}-answer`}
                id={`faq-${itemId}-q`}
                onClick={() => setOpenId(isOpen ? null : itemId)}
              >
                <span>{question}</span>
                <span className="faq-page-icon" aria-hidden>{isOpen ? '-' : '+'}</span>
              </button>
              <div
                id={`faq-${itemId}-answer`}
                role="region"
                aria-labelledby={`faq-${itemId}-q`}
                className="faq-page-answer"
                hidden={!isOpen}
              >
                {answer}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
