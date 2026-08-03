import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import ContentText from '../components/siteContent/ContentText';
import PageHeader from '../components/layout/PageHeader';
import './PrivacyPage.css';

export default function PrivacyPage() {
  const { t } = useLanguage();

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('homePage.footerPrivacy') },
  ];

  const sections = [
    { titleKey: 'section1Title', bodyKey: 'section1Body' },
    { titleKey: 'section2Title', bodyKey: 'section2Body' },
    { titleKey: 'section3Title', bodyKey: 'section3Body' },
    { titleKey: 'section4Title', bodyKey: 'section4Body' },
    { titleKey: 'section5Title', bodyKey: 'section5Body' },
  ];

  return (
    <div className="privacy-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={<ContentText k="privacyPage.title" />}
        lead={<ContentText k="privacyPage.lastUpdated" />}
      />
      <div className="privacy-page-content">
        <ContentText k="privacyPage.intro" as="p" className="privacy-page-intro" />
        {sections.map(({ titleKey, bodyKey }) => (
          <section key={titleKey} className="privacy-page-section">
            <ContentText k={`privacyPage.${titleKey}`} as="h2" />
            <ContentText k={`privacyPage.${bodyKey}`} as="p" />
          </section>
        ))}
      </div>
    </div>
  );
}
