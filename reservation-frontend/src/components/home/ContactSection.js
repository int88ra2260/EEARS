import React from 'react';

import { Link } from 'react-router-dom';

import ContentText from '../siteContent/ContentText';

import { SITE_CONTACT, EMI_CENTER_URL } from '../../config/siteContact';

import './home.css';



export default function ContactSection() {

  const c = SITE_CONTACT;



  return (

    <section id="contact" className="home-section home-section--bone" aria-labelledby="contact-title">

      <div className="home-shell home-reveal">

        <div className="home-contact-grid">

          <div className="home-contact-grid__copy">

            <ContentText k="homePage.contactKicker" as="p" className="home-kicker home-kicker--section" />

            <ContentText k="homePage.contactTitle" as="h2" id="contact-title" className="home-section__title" />

            <ContentText k="homePage.contactLead" as="p" className="home-lead" />

          </div>



          <div className="home-contact-card">

            <h3>{c.name}</h3>

            <dl className="home-contact-dl">

              <div>

                <dt><ContentText k="homePage.contactAddress" /></dt>

                <dd>{c.address}</dd>

              </div>

              <div>

                <dt><ContentText k="homePage.contactPhone" /></dt>

                <dd>{c.phone}</dd>

              </div>

              <div>

                <dt><ContentText k="homePage.contactEmail" /></dt>

                <dd>{c.email}</dd>

              </div>

              <div>

                <dt><ContentText k="homePage.contactHours" /></dt>

                <dd>{c.hours}</dd>

              </div>

            </dl>

            <div className="home-contact-card__actions">

              <a href={`mailto:${c.email}`} className="home-btn home-btn--solid">

                <ContentText k="homePage.contactUs" />

              </a>

              <a

                href={EMI_CENTER_URL}

                target="_blank"

                rel="noopener noreferrer"

                className="home-btn home-btn--ghost"

              >

                <ContentText k="homePage.goToCenter" />

              </a>

              <Link to="/about#contact" className="home-text-link">

                <ContentText k="homePage.contactPageLink" />

                <span aria-hidden="true"> →</span>

              </Link>

            </div>

          </div>

        </div>

      </div>

    </section>

  );

}

