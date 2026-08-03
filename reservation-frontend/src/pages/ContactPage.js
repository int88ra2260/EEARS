import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import ContentText from '../components/siteContent/ContentText';
import { SITE_CONTACT, EMI_CENTER_URL } from '../config/siteContact';
import PageHeader from '../components/layout/PageHeader';
import './ContactPage.css';

export default function ContactPage() {
  const { t } = useLanguage();

  const breadcrumbs = [
    { label: t('nav.home'), path: '/' },
    { label: t('nav.contact') },
  ];

  return (
    <div className="contact-page">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={<ContentText k="homePage.contactTitle" />}
      />
      <div className="contact-page-card public-card">
        <h2 className="contact-page-name">{SITE_CONTACT.name}</h2>
        <dl className="contact-page-dl">
          <dt><ContentText k="homePage.contactAddress" /></dt>
          <dd><ContentText k="homePage.contactAddressValue" /></dd>
          <dt><ContentText k="homePage.contactPhone" /></dt>
          <dd><ContentText k="homePage.contactPhoneValue" /></dd>
          <dt><ContentText k="homePage.contactEmail" /></dt>
          <dd>
            <a href={`mailto:${t('homePage.contactEmailValue')}`}>
              <ContentText k="homePage.contactEmailValue" />
            </a>
          </dd>
          <dt><ContentText k="homePage.contactHours" /></dt>
          <dd><ContentText k="homePage.contactHoursValue" /></dd>
        </dl>
        <a href={EMI_CENTER_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          <ContentText k="homePage.goToCenter" />
        </a>
      </div>
    </div>
  );
}
