import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import ContentText from '../components/siteContent/ContentText';
import PageHeader from '../components/layout/PageHeader';
import './TermsPage.css';

export default function TermsPage() {
  const { t } = useLanguage();

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('homePage.footerTerms') },
  ];

  const sections = [
    { titleKey: 'section1Title', bodyKey: 'section1Body' },
    { titleKey: 'section2Title', bodyKey: 'section2Body' },
    { titleKey: 'section3Title', bodyKey: 'section3Body' },
    { titleKey: 'section4Title', bodyKey: 'section4Body' },
    { titleKey: 'section5Title', bodyKey: 'section5Body' },
  ];

  return (
    <div className="terms-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={<ContentText k="termsPage.title" />}
        lead={<ContentText k="termsPage.lastUpdated" />}
      />
      <div className="terms-page-content">
        <ContentText k="termsPage.intro" as="p" className="terms-page-intro" />
        {sections.map(({ titleKey, bodyKey }) => (
          <section key={titleKey} className="terms-page-section">
            <ContentText k={`termsPage.${titleKey}`} as="h2" />
            <ContentText k={`termsPage.${bodyKey}`} as="p" />
          </section>
        ))}
      </div>
    </div>
  );
}
